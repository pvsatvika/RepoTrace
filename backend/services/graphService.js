import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
import { detectQuestionIntent } from './sarvamService.js';

dotenv.config();

const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

let driver;

function getDriver() {
  if (!driver) {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }
  return driver;
}

export async function verifyConnection() {
  try {
    const d = getDriver();
    const serverInfo = await d.getServerInfo();
    console.log(`[Neo4j Service] Connected to server: ${serverInfo.address}`);
    return { connected: true, error: null };
  } catch (err) {
    console.warn(`[Neo4j Service] Connection check failed: ${err.message}`);
    return { connected: false, error: err.message };
  }
}

/**
 * Safely converts Neo4j Integers / BigInt / Objects into clean JS primitives.
 */
function safeValue(val, defaultVal = '') {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'string' || typeof val === 'boolean') return val;
  if (typeof val === 'number') return val;
  if (typeof val === 'bigint') return Number(val);
  if (typeof val === 'object') {
    if (typeof val.toNumber === 'function') return val.toNumber();
    if (val.low !== undefined) return val.low;
    if (typeof val.toString === 'function') return val.toString();
  }
  return String(val);
}

/**
 * Extracts Decision text signals with provenance.
 */
function extractDecisionSignal(text, sourceType, sourceId, sourceUrl, author, date, repoId) {
  if (!text || typeof text !== 'string') return null;

  const decisionRegex = /\b(because|reason|chose|decided|instead|due to|workaround|breaking change|migration|deprecated|performance|compatibility|security|refactor|update|redesign|implement|support)\b/i;
  if (!decisionRegex.test(text)) return null;

  const cleanText = text.trim().substring(0, 300);
  const hash = Math.abs(cleanText.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0));
  
  return {
    id: `dec_${sourceType}_${sourceId}_${hash}`,
    text: cleanText,
    sourceType,
    sourceId: String(sourceId),
    sourceUrl: sourceUrl || '#',
    author: author || 'Unknown',
    date: date || '',
    repoId,
    confidence: 'supported',
  };
}

/**
 * Extracts Incident text signals with provenance.
 */
function extractIncidentSignal(text, sourceType, sourceId, sourceUrl, author, date, repoId) {
  if (!text || typeof text !== 'string') return null;

  const incidentRegex = /\b(bug|fix|regression|crash|vulnerability|failure|panic|memory leak|outage|issue|error|prevent|solve)\b/i;
  if (!incidentRegex.test(text)) return null;

  const cleanText = text.trim().substring(0, 300);
  const hash = Math.abs(cleanText.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0));

  return {
    id: `inc_${sourceType}_${sourceId}_${hash}`,
    text: cleanText,
    sourceType,
    sourceId: String(sourceId),
    sourceUrl: sourceUrl || '#',
    author: author || 'Unknown',
    date: date || '',
    repoId,
    confidence: 'supported',
  };
}

/**
 * Clears old graph nodes specifically for the target repository to enable clean re-ingestion.
 */
export async function clearRepositoryGraph(owner, repo) {
  const d = getDriver();
  const session = d.session();
  const repoId = `${owner}/${repo}`;
  try {
    console.log(`[Neo4j Service] Clearing previous graph data for ${repoId}...`);
    await session.executeWrite((tx) =>
      tx.run(
        `
        MATCH (r:Repository { id: $repoId })
        OPTIONAL MATCH (r)-[:HAS_COMMIT]->(c:Commit)
        OPTIONAL MATCH (r)-[:HAS_PULL_REQUEST]->(pr:PullRequest)
        OPTIONAL MATCH (r)-[:HAS_ISSUE]->(i:Issue)
        OPTIONAL MATCH (r)-[:HAS_FILE]->(f:File)
        OPTIONAL MATCH (c)-[:SUPPORTS]->(dec1:Decision)
        OPTIONAL MATCH (pr)-[:IMPLEMENTS]->(dec2:Decision)
        OPTIONAL MATCH (i)-[:DESCRIBES]->(inc:Incident)
        OPTIONAL MATCH (pr)-[:HAS_DISCUSSION]->(d:Discussion)
        DETACH DELETE r, c, pr, i, dec1, dec2, inc, d, f
        `,
        { repoId }
      )
    );
  } catch (err) {
    console.warn(`[Neo4j Service] Repository clear warning:`, err.message);
  } finally {
    await session.close();
  }
}

/**
 * Builds Phase 3.5 Decision Graph in Neo4j with complete node & relationship connectivity.
 * Nodes: Repository, Commit, PullRequest, Issue, Developer, File, CodeEntity, Discussion, Decision, Incident
 */
export async function buildDecisionGraph(repoData) {
  const { metadata, commits = [], pullRequests = [], issues = [] } = repoData;
  const { owner, repo, url: repoUrl } = metadata;
  const repoId = `${owner}/${repo}`;

  console.log(`[Neo4j Service] Constructing repository-isolated Decision Graph for ${repoId}...`);

  // Clear target repository graph first for idempotent re-ingestion
  await clearRepositoryGraph(owner, repo);

  const d = getDriver();
  const session = d.session();

  try {
    // 1. Repository Node
    await session.executeWrite((tx) =>
      tx.run(
        `
        MERGE (r:Repository { id: $repoId })
        SET r.name = $repo,
            r.owner = $owner,
            r.url = $repoUrl,
            r.ingestedAt = timestamp()
        `,
        { repoId, repo, owner, repoUrl }
      )
    );

    // 2. Commits, Developers, Files, Decisions, Incidents
    for (const commit of commits) {
      const { sha, message, author, date, url: commitUrl, files = [] } = commit;

      await session.executeWrite((tx) =>
        tx.run(
          `
          MATCH (r:Repository { id: $repoId })
          MERGE (c:Commit { sha: $sha })
          SET c.message = $message,
              c.date = $date,
              c.url = $commitUrl,
              c.repoId = $repoId
          MERGE (r)-[:HAS_COMMIT]->(c)

          MERGE (dev:Developer { username: $author })
          MERGE (dev)-[:AUTHORED]->(c)
          `,
          { repoId, sha, message, date: date || '', commitUrl: commitUrl || '', author }
        )
      );

      // Create Canonical File & CodeEntity Nodes
      for (const file of files) {
        const fileId = `${repoId}/${file.filename}`;
        await session.executeWrite((tx) =>
          tx.run(
            `
            MATCH (c:Commit { sha: $sha })
            MERGE (f:File { id: $fileId })
            SET f:CodeEntity,
                f.filename = $filename,
                f.repoId = $repoId
            MERGE (c)-[:MODIFIES]->(f)
            `,
            { sha, fileId, filename: file.filename, repoId }
          )
        );
      }

      // Commit Decision Signal
      const decSignal = extractDecisionSignal(message, 'commit', sha, commitUrl, author, date, repoId);
      if (decSignal) {
        await session.executeWrite((tx) =>
          tx.run(
            `
            MATCH (c:Commit { sha: $sha })
            MERGE (dec:Decision { id: $id })
            SET dec.text = $text,
                dec.sourceType = $sourceType,
                dec.sourceId = $sourceId,
                dec.sourceUrl = $sourceUrl,
                dec.author = $author,
                dec.date = $date,
                dec.confidence = $confidence,
                dec.repoId = $repoId
            MERGE (c)-[:SUPPORTS]->(dec)
            MERGE (dec)-[:IMPLEMENTED_BY]->(c)
            `,
            { sha, ...decSignal }
          )
        );

        for (const file of files) {
          const fileId = `${repoId}/${file.filename}`;
          await session.executeWrite((tx) =>
            tx.run(
              `
              MATCH (dec:Decision { id: $id })
              MATCH (f:File { id: $fileId })
              MERGE (dec)-[:AFFECTS]->(f)
              `,
              { id: decSignal.id, fileId }
            )
          );
        }
      }

      // Commit Incident Signal
      const incSignal = extractIncidentSignal(message, 'commit', sha, commitUrl, author, date, repoId);
      if (incSignal) {
        await session.executeWrite((tx) =>
          tx.run(
            `
            MATCH (c:Commit { sha: $sha })
            MERGE (inc:Incident { id: $id })
            SET inc.text = $text,
                inc.sourceType = $sourceType,
                inc.sourceId = $sourceId,
                inc.sourceUrl = $sourceUrl,
                inc.author = $author,
                inc.date = $date,
                inc.confidence = $confidence,
                inc.repoId = $repoId
            MERGE (c)-[:ADDRESSES]->(inc)
            MERGE (inc)-[:ADDRESSED_BY]->(c)
            `,
            { sha, ...incSignal }
          )
        );
      }
    }

    // 3. Pull Requests, Developers, PR Commits, Discussions, Decisions
    for (const pr of pullRequests) {
      const prId = `${repoId}#${pr.number}`;

      await session.executeWrite((tx) =>
        tx.run(
          `
          MATCH (r:Repository { id: $repoId })
          MERGE (pr:PullRequest { id: $prId })
          SET pr.number = $number,
              pr.title = $title,
              pr.body = $body,
              pr.merged_at = $mergedAt,
              pr.url = $prUrl,
              pr.repoId = $repoId
          MERGE (r)-[:HAS_PULL_REQUEST]->(pr)

          MERGE (dev:Developer { username: $author })
          MERGE (dev)-[:AUTHORED]->(pr)
          `,
          {
            repoId,
            prId,
            number: neo4j.int(pr.number),
            title: pr.title,
            body: pr.body,
            mergedAt: pr.merged_at || '',
            prUrl: pr.url || '',
            author: pr.author,
          }
        )
      );

      // Link PR-associated commits reliably
      for (const prCommitSha of pr.pr_commits || []) {
        await session.executeWrite((tx) =>
          tx.run(
            `
            MATCH (pr:PullRequest { id: $prId })
            MERGE (c:Commit { sha: $sha })
            SET c.repoId = $repoId
            MERGE (c)-[:RELATED_TO]->(pr)
            `,
            { prId, sha: prCommitSha, repoId }
          )
        );
      }

      // Check PR Title/Body for Decision Signals
      const prDecSignal = extractDecisionSignal(`${pr.title}\n${pr.body}`, 'pull_request', pr.number, pr.url, pr.author, pr.merged_at, repoId);
      if (prDecSignal) {
        await session.executeWrite((tx) =>
          tx.run(
            `
            MATCH (pr:PullRequest { id: $prId })
            MERGE (dec:Decision { id: $id })
            SET dec.text = $text,
                dec.sourceType = $sourceType,
                dec.sourceId = $sourceId,
                dec.sourceUrl = $sourceUrl,
                dec.author = $author,
                dec.date = $date,
                dec.confidence = $confidence,
                dec.repoId = $repoId
            MERGE (pr)-[:IMPLEMENTS]->(dec)
            MERGE (dec)-[:MADE_IN]->(pr)
            `,
            { prId, ...prDecSignal }
          )
        );
      }

      // Check PR for Incident Signal
      const prIncSignal = extractIncidentSignal(`${pr.title}\n${pr.body}`, 'pull_request', pr.number, pr.url, pr.author, pr.merged_at, repoId);
      if (prIncSignal) {
        await session.executeWrite((tx) =>
          tx.run(
            `
            MATCH (pr:PullRequest { id: $prId })
            MERGE (inc:Incident { id: $id })
            SET inc.text = $text,
                inc.sourceType = $sourceType,
                inc.sourceId = $sourceId,
                inc.sourceUrl = $sourceUrl,
                inc.author = $author,
                inc.date = $date,
                inc.confidence = $confidence,
                inc.repoId = $repoId
            MERGE (pr)-[:ADDRESSES]->(inc)
            MERGE (inc)-[:ADDRESSED_BY]->(pr)
            `,
            { prId, ...prIncSignal }
          )
        );
      }

      // Process Discussions (Comments & Code Review Comments)
      for (const comment of pr.comments || []) {
        await session.executeWrite((tx) =>
          tx.run(
            `
            MATCH (pr:PullRequest { id: $prId })
            MERGE (d:Discussion { id: $commentId })
            SET d.user = $user,
                d.body = $body,
                d.type = $type,
                d.date = $date,
                d.repoId = $repoId
            MERGE (pr)-[:HAS_DISCUSSION]->(d)

            MERGE (dev:Developer { username: $user })
            MERGE (dev)-[:PARTICIPATED_IN]->(d)
            MERGE (d)-[:INVOLVES]->(dev)
            `,
            {
              prId,
              commentId: String(comment.id),
              user: comment.user,
              body: comment.body,
              type: comment.type,
              date: comment.date || '',
              repoId,
            }
          )
        );

        if (comment.path) {
          const fileId = `${repoId}/${comment.path}`;
          await session.executeWrite((tx) =>
            tx.run(
              `
              MATCH (pr:PullRequest { id: $prId })
              MATCH (d:Discussion { id: $commentId })
              MERGE (f:File { id: $fileId })
              SET f:CodeEntity,
                  f.filename = $path,
                  f.repoId = $repoId
              MERGE (pr)-[:DISCUSSES]->(f)
              MERGE (d)-[:ABOUT]->(f)
              `,
              { prId, commentId: String(comment.id), fileId, path: comment.path, repoId }
            )
          );
        }

        // Discussion Decision Signal
        const discDecSignal = extractDecisionSignal(comment.body, 'discussion', comment.id, pr.url, comment.user, comment.date, repoId);
        if (discDecSignal) {
          await session.executeWrite((tx) =>
            tx.run(
              `
              MATCH (d:Discussion { id: $commentId })
              MERGE (dec:Decision { id: $id })
              SET dec.text = $text,
                  dec.sourceType = $sourceType,
                  dec.sourceId = $sourceId,
                  dec.sourceUrl = $sourceUrl,
                  dec.author = $author,
                  dec.date = $date,
                  dec.confidence = $confidence,
                  dec.repoId = $repoId
              MERGE (d)-[:SUPPORTS]->(dec)
              MERGE (dec)-[:SUPPORTED_BY]->(d)
              `,
              { commentId: String(comment.id), ...discDecSignal }
            )
          );
        }
      }
    }

    // 4. Issues & Incidents
    for (const issue of issues) {
      const issueId = `${repoId}#${issue.number}`;

      await session.executeWrite((tx) =>
        tx.run(
          `
          MATCH (r:Repository { id: $repoId })
          MERGE (i:Issue { id: $issueId })
          SET i.number = $number,
              i.title = $title,
              i.body = $body,
              i.state = $state,
              i.url = $issueUrl,
              i.repoId = $repoId
          MERGE (r)-[:HAS_ISSUE]->(i)

          MERGE (dev:Developer { username: $author })
          MERGE (dev)-[:CREATED]->(i)
          `,
          {
            repoId,
            issueId,
            number: neo4j.int(issue.number),
            title: issue.title,
            body: issue.body,
            state: issue.state,
            issueUrl: issue.url || '',
            author: issue.author,
          }
        )
      );

      // Link Issue to PR if PR references issue number
      await session.executeWrite((tx) =>
        tx.run(
          `
          MATCH (i:Issue { id: $issueId })
          MATCH (pr:PullRequest { repoId: $repoId })
          WHERE pr.body CONTAINS ('#' + toString($number))
             OR pr.title CONTAINS ('#' + toString($number))
          MERGE (i)-[:RELATED_TO]->(pr)
          MERGE (pr)-[:ADDRESSES]->(i)
          `,
          { issueId, number: neo4j.int(issue.number), repoId }
        )
      );

      // Create Incident node if Issue describes bug/incident
      const issueIncSignal = extractIncidentSignal(`${issue.title}\n${issue.body}`, 'issue', issue.number, issue.url, issue.author, issue.created_at, repoId);
      if (issueIncSignal) {
        await session.executeWrite((tx) =>
          tx.run(
            `
            MATCH (i:Issue { id: $issueId })
            MERGE (inc:Incident { id: $id })
            SET inc.text = $text,
                inc.sourceType = $sourceType,
                inc.sourceId = $sourceId,
                inc.sourceUrl = $sourceUrl,
                inc.author = $author,
                inc.date = $date,
                inc.confidence = $confidence,
                inc.repoId = $repoId
            MERGE (i)-[:DESCRIBES]->(inc)
            `,
            { issueId, ...issueIncSignal }
          )
        );
      }
    }

    // Ingest File nodes
    const files = repoData.files || [];
    for (const fileObj of files) {
      const fileId = `${repoId}:${fileObj.path}`;
      await session.executeWrite((tx) =>
        tx.run(
          `
          MATCH (r:Repository { id: $repoId })
          MERGE (f:File { id: $fileId })
          SET f.path = $path,
              f.content = $content,
              f.url = $url,
              f.repoId = $repoId
          MERGE (r)-[:HAS_FILE]->(f)
          `,
          { repoId, fileId, path: fileObj.path, content: fileObj.content, url: fileObj.url }
        )
      );
    }

    console.log(`[Neo4j Service] Decision Graph built successfully for ${repoId} (${files.length} file nodes).`);
    return { success: true, repository: repoId };
  } catch (err) {
    console.error(`[Neo4j Service] Decision graph build error:`, err.message);
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * Repository-Isolated Multi-hop GraphRAG Search Engine.
 * Strictly scopes all Cypher queries to the target repository (or active repository).
 * 
 * @param {string} question - Natural language developer question
 * @param {string} [repository] - Target repository (e.g. "sriyukthach/SmartBundle-AI")
 * @returns {Promise<{ evidence: Array<Object>, structuredContext: Object }>}
 */
export async function querySubgraph(question, repository = null) {
  if (!question || typeof question !== 'string') {
    return { evidence: [], structuredContext: {} };
  }

  const d = getDriver();
  const session = d.session();

  try {
    // Determine active target repository ID
    let repoId = repository ? repository.trim() : null;
    if (!repoId) {
      const activeRepoRes = await session.executeRead((tx) =>
        tx.run(`MATCH (r:Repository) RETURN r.id AS id ORDER BY r.ingestedAt DESC LIMIT 1`)
      );
      if (activeRepoRes.records.length > 0) {
        repoId = safeValue(activeRepoRes.records[0].get('id'));
      }
    }

    const intent = detectQuestionIntent(question);
    const isHistorical = intent === 'HISTORICAL';

    console.log(`[Neo4j Service] Repository-isolated GraphRAG query for repo: "${repoId || 'ALL'}" | Question: "${question}" | Intent: "${intent}"...`);

    const words = question
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !['why', 'what', 'how', 'when', 'where', 'was', 'were', 'the', 'this', 'that', 'with', 'from', 'does', 'have', 'been', 'developer', 'trying', 'solve', 'code', 'changed'].includes(w));

    const keyword = words[0] || '';

    let cypher = '';
    if (isHistorical) {
      // Historical Query: Prioritize Commits, PRs, Decisions with rank = 1 over File nodes (rank = 10)
      cypher = `
        MATCH (r:Repository { id: $repoId })-[:HAS_COMMIT]->(c:Commit)
        OPTIONAL MATCH (dev:Developer)-[:AUTHORED]->(c)
        RETURN 'commit' AS type,
               c.sha AS id,
               ('Commit ' + substring(c.sha, 0, 7) + ': ' + c.message) AS title,
               dev.username AS author,
               c.date AS date,
               c.url AS url,
               ('Commit ' + substring(c.sha, 0, 7) + ' by @' + coalesce(dev.username, 'contributor') + ' on ' + coalesce(c.date, 'recorded date') + ': ' + c.message) AS reason,
               1 AS rank

        UNION

        MATCH (r:Repository { id: $repoId })-[:HAS_PULL_REQUEST]->(pr:PullRequest)
        OPTIONAL MATCH (dev:Developer)-[:AUTHORED]->(pr)
        RETURN 'pull_request' AS type,
               pr.id AS id,
               ('PR #' + toString(pr.number) + ': ' + pr.title) AS title,
               dev.username AS author,
               pr.merged_at AS date,
               pr.url AS url,
               ('Pull Request #' + toString(pr.number) + ' merged on ' + coalesce(pr.merged_at, 'date') + ': ' + pr.title + ' - ' + substring(pr.body, 0, 180)) AS reason,
               1 AS rank

        UNION

        MATCH (r:Repository { id: $repoId })-[:HAS_COMMIT|HAS_PULL_REQUEST*1..2]->(parent)
        MATCH (parent)-[:SUPPORTS|IMPLEMENTS|MADE_IN*1..2]-(dec:Decision)
        OPTIONAL MATCH (dec)-[:MADE_IN]->(pr:PullRequest)
        OPTIONAL MATCH (dec)-[:IMPLEMENTED_BY]->(c:Commit)
        RETURN 'decision' AS type,
               dec.id AS id,
               ('Architectural Decision: ' + dec.text) AS title,
               dec.author AS author,
               dec.date AS date,
               coalesce(dec.sourceUrl, pr.url, c.url, '#') AS url,
               ('Decision (' + dec.sourceType + '): ' + dec.text) AS reason,
               1 AS rank

        UNION

        MATCH (r:Repository { id: $repoId })-[:HAS_FILE]->(f:File)
        WHERE (toLower(f.path) CONTAINS 'readme' OR toLower(f.path) CONTAINS 'architecture')
        RETURN 'file' AS type,
               f.id AS id,
               ('File: ' + f.path) AS title,
               'Repository Source' AS author,
               'Current Codebase' AS date,
               f.url AS url,
               ('Current Doc / File (' + f.path + '): ' + substring(f.content, 0, 300)) AS reason,
               10 AS rank
      `;
    } else {
      // Non-Historical (Architectural / Data Storage / Implementation / Performance): Prioritize Files & Docs
      cypher = `
        MATCH (r:Repository { id: $repoId })-[:HAS_FILE]->(f:File)
        WHERE ($keyword = '' OR toLower(f.path) CONTAINS toLower($keyword) OR toLower(f.content) CONTAINS toLower($keyword) OR toLower(f.path) CONTAINS 'readme' OR toLower(f.path) CONTAINS 'architecture' OR toLower(f.path) CONTAINS 'dvc' OR toLower(f.path) CONTAINS 'dataset')
        RETURN 'file' AS type,
               f.id AS id,
               ('File: ' + f.path) AS title,
               'Repository Source' AS author,
               'Current Codebase' AS date,
               f.url AS url,
               ('Source File / Doc (' + f.path + '): ' + substring(f.content, 0, 450)) AS reason,
               1 AS rank

        UNION

        MATCH (r:Repository { id: $repoId })-[:HAS_COMMIT|HAS_PULL_REQUEST*1..2]->(parent)
        MATCH (parent)-[:SUPPORTS|IMPLEMENTS|MADE_IN*1..2]-(dec:Decision)
        WHERE ($keyword = '' OR toLower(dec.text) CONTAINS toLower($keyword))
        OPTIONAL MATCH (dec)-[:MADE_IN]->(pr:PullRequest)
        OPTIONAL MATCH (dec)-[:IMPLEMENTED_BY]->(c:Commit)
        RETURN 'decision' AS type,
               dec.id AS id,
               ('Architectural Decision: ' + dec.text) AS title,
               dec.author AS author,
               dec.date AS date,
               coalesce(dec.sourceUrl, pr.url, c.url, '#') AS url,
               ('Decision (' + dec.sourceType + '): ' + dec.text) AS reason,
               2 AS rank

        UNION

        MATCH (r:Repository { id: $repoId })-[:HAS_PULL_REQUEST]->(pr:PullRequest)
        WHERE ($keyword = '' OR toLower(pr.title) CONTAINS toLower($keyword) OR toLower(pr.body) CONTAINS toLower($keyword))
        OPTIONAL MATCH (dev:Developer)-[:AUTHORED]->(pr)
        RETURN 'pull_request' AS type,
               pr.id AS id,
               ('PR #' + toString(pr.number) + ': ' + pr.title) AS title,
               dev.username AS author,
               pr.merged_at AS date,
               pr.url AS url,
               ('Pull Request #' + toString(pr.number) + ': ' + pr.title + ' - ' + substring(pr.body, 0, 180)) AS reason,
               3 AS rank

        UNION

        MATCH (r:Repository { id: $repoId })-[:HAS_COMMIT]->(c:Commit)
        WHERE ($keyword = '' OR toLower(c.message) CONTAINS toLower($keyword))
        OPTIONAL MATCH (dev:Developer)-[:AUTHORED]->(c)
        RETURN 'commit' AS type,
               c.sha AS id,
               ('Commit ' + substring(c.sha, 0, 7) + ': ' + c.message) AS title,
               dev.username AS author,
               c.date AS date,
               c.url AS url,
               ('Commit ' + substring(c.sha, 0, 7) + ': ' + c.message) AS reason,
               4 AS rank
      `;
    }

    const result = await session.executeRead((tx) => tx.run(cypher, { repoId, keyword }));

    let rawEvidence = result.records.map((record) => ({
      type: safeValue(record.get('type'), 'evidence'),
      id: safeValue(record.get('id'), 'N/A'),
      title: safeValue(record.get('title'), 'Historical Evidence'),
      author: safeValue(record.get('author'), 'Unknown'),
      date: safeValue(record.get('date'), 'N/A'),
      url: safeValue(record.get('url'), '#'),
      reason: safeValue(record.get('reason'), ''),
      rank: Number(safeValue(record.get('rank'), 99)) || 99,
    }));

    // If keyword search yielded 0 items, run fallback repository-scoped query to get repo's files & commits
    if (rawEvidence.length === 0 && repoId) {
      console.log(`[Neo4j Service] No keyword match for "${keyword}". Executing fallback query for repo "${repoId}"...`);
      const fallbackCypher = `
        MATCH (r:Repository { id: $repoId })
        OPTIONAL MATCH (r)-[:HAS_FILE]->(f:File)
        OPTIONAL MATCH (r)-[:HAS_COMMIT]->(c:Commit)
        OPTIONAL MATCH (dev:Developer)-[:AUTHORED]->(c)
        RETURN 'file' AS type,
               f.id AS id,
               ('File: ' + f.path) AS title,
               'Repository Source' AS author,
               'Current Codebase' AS date,
               f.url AS url,
               ('Source File / Doc (' + f.path + '): ' + substring(f.content, 0, 400)) AS reason,
               1 AS rank
        LIMIT 10
      `;
      const fallbackRes = await session.executeRead((tx) => tx.run(fallbackCypher, { repoId }));
      const fallbackRecords = fallbackRes.records
        .filter(rec => rec.get('id') !== null)
        .map((record) => ({
          type: safeValue(record.get('type'), 'evidence'),
          id: safeValue(record.get('id'), 'N/A'),
          title: safeValue(record.get('title'), 'Repository File'),
          author: safeValue(record.get('author'), 'Repository Source'),
          date: safeValue(record.get('date'), 'Current Codebase'),
          url: safeValue(record.get('url'), '#'),
          reason: safeValue(record.get('reason'), ''),
          rank: Number(safeValue(record.get('rank'), 99)) || 99,
        }));
      if (fallbackRecords.length > 0) {
        rawEvidence = fallbackRecords;
      }
    }

    // FAILSAFE GUARANTEE: Filter strictly to repoId
    if (repoId) {
      rawEvidence = rawEvidence.filter((item) => {
        if (!item.url || item.url === '#') return true;
        // If it's a GitHub URL, it MUST contain repoId (e.g. sriyukthach/SmartBundle-AI)
        if (item.url.startsWith('http') && item.url.includes('github.com')) {
          return item.url.toLowerCase().includes(repoId.toLowerCase());
        }
        return true;
      });
    }

    // Sort evidence by rank priority
    const evidence = rawEvidence.sort((a, b) => a.rank - b.rank);

    // Group into structured context object
    const structuredContext = {
      question,
      keyword,
      repository: repoId,
      decisions: evidence.filter((e) => e.type === 'decision'),
      incidents: evidence.filter((e) => e.type === 'incident'),
      pullRequests: evidence.filter((e) => e.type === 'pull_request'),
      issues: evidence.filter((e) => e.type === 'issue'),
      commits: evidence.filter((e) => e.type === 'commit'),
      discussions: evidence.filter((e) => e.type === 'discussion'),
    };

    console.log(`[Neo4j Service] Repository-isolated GraphRAG search for "${repoId}" returned ${evidence.length} evidence records.`);
    return { evidence, structuredContext };
  } catch (err) {
    console.error(`[Neo4j Service] GraphRAG query error:`, err.message);
    throw err;
  } finally {
    await session.close();
  }
}
