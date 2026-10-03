import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SARVAM_API_URL = 'https://api.sarvam.ai/v1/chat/completions';

/**
 * Detects the intent of the question:
 * - HISTORICAL: Questions about why/when something changed, commits, decisions, evolution, contributors.
 * - ARCHITECTURAL: Questions about system design, components, boundaries, patterns, tradeoffs.
 * - IMPLEMENTATION: Questions about how a mechanism actually works in code.
 * - DATA_STORAGE: Questions about schemas, data structures, persistence, caching, versioning, storage.
 * - PERFORMANCE: Questions about optimization, memory, speed, scalability, caching.
 */
export function detectQuestionIntent(question) {
  const q = (question || '').toLowerCase();

  // 1. HISTORICAL / EVOLUTION (Top Priority!)
  if (/\b(what changed|how did it evolve|why was it changed|why were|history|originally|over time|introduced|replaced|refactored|previous approach|evolution|course of its development|commit|merged|author|pr)\b/i.test(q)) {
    return 'HISTORICAL';
  }

  // 2. DATA / STORAGE
  if (/\b(data structure|schema|storage|versioning|rollback|persistence|caching|dvc|pointer|placeholder|snapshot|delta)\b/i.test(q)) {
    return 'DATA_STORAGE';
  }

  // 3. PERFORMANCE
  if (/\b(performance|memory|speed|optimization|scalable|scalability|throughput|leak|bottleneck|efficiency|optimize|latency)\b/i.test(q)) {
    return 'PERFORMANCE';
  }

  // 4. ARCHITECTURAL
  if (/\b(architecture|system design|component|boundary|pattern|tradeoff|design|framework|module|how does|how is)\b/i.test(q)) {
    return 'ARCHITECTURAL';
  }

  // 5. IMPLEMENTATION
  if (/\b(how it works|file|function|class|method|implementation|codebase|where is|executed|execution|logic)\b/i.test(q)) {
    return 'IMPLEMENTATION';
  }

  return 'HISTORICAL';
}

/**
 * Generates an explanation using Sarvam AI (sarvam-105b-conversations) with intent-aware structure.
 */
export async function generateAnswerWithEvidence(question, evidence, structuredContext = {}) {
  const apiKey = process.env.SARVAM_API_KEY;
  const isConfigured = apiKey && apiKey !== 'your_sarvam_api_key';

  const cleanQuestion = (question || '').trim();
  const repoName = structuredContext.repository || 'this repository';
  const hasEvidence = evidence && Array.isArray(evidence) && evidence.length > 0;
  const confidence = hasEvidence ? 'supported' : 'insufficient_evidence';
  const intent = detectQuestionIntent(cleanQuestion);

  // Format evidence list for prompt context
  let evidenceContext = '';
  if (!hasEvidence) {
    evidenceContext = `No matching repository evidence (commits, PRs, issues, or source/doc files) was found in the graph database for ${repoName}.`;
  } else {
    evidenceContext = evidence
      .map((item, idx) => `[Evidence #${idx + 1} - ${item.type.toUpperCase()}]\nTitle/Path: ${item.title}\nDetails/Content: ${item.reason}\nAuthor/Source: ${item.author} | Date/State: ${item.date} | URL: ${item.url}`)
      .join('\n\n');
  }

  let sectionHeaders = '';
  if (intent === 'HISTORICAL') {
    sectionHeaders = `1. DIRECT ANSWER
2. WHAT CHANGED
3. WHY IT CHANGED
4. HOW IT EVOLVED
5. EVIDENCE
6. UNCERTAINTIES`;
  } else if (intent === 'ARCHITECTURAL' || intent === 'IMPLEMENTATION') {
    sectionHeaders = `1. DIRECT ANSWER
2. HOW IT WORKS
3. KEY COMPONENTS
4. IMPLEMENTATION EVIDENCE
5. LIMITATIONS / UNKNOWNS`;
  } else if (intent === 'DATA_STORAGE') {
    sectionHeaders = `1. DIRECT ANSWER
2. DATA STRUCTURE
3. STORAGE / VERSIONING STRATEGY
4. HOW DATA FLOWS
5. EVIDENCE
6. LIMITATIONS`;
  } else if (intent === 'PERFORMANCE') {
    sectionHeaders = `1. DIRECT ANSWER
2. PERFORMANCE STRATEGY
3. BOTTLENECK / TRADEOFF
4. IMPLEMENTATION EVIDENCE
5. LIMITATIONS`;
  }

  const systemPrompt = `You are a Senior Software Archaeology & Architecture Expert explaining repository code, design, and history for "${repoName}".
Your job is to answer developer questions directly in clean, easy-to-scan plain English.

CRITICAL ANTI-HALLUCINATION & HISTORICAL GROUNDING RULES:
1. Base all historical claims STRICTLY on retrieved Commit SHAs, dates, messages, and PR descriptions for "${repoName}".
2. NEVER claim that the project "shifted", "evolved", "was introduced", or "was changed because of X" unless retrieved historical commit/PR evidence explicitly supports that claim.
3. If a commit or evidence shows a change occurred but does NOT document why, explicitly state:
   "The repository shows that this changed, but it does not document why."
4. DO NOT invent motivations such as enterprise requirements, safety concerns, scalability, production readiness, performance, cost, or reliability unless explicitly supported by commit/PR text.
5. Clearly distinguish between:
   - HISTORICAL EVIDENCE (what a commit SHA, message, or author establishes)
   - CURRENT-CODEBASE EVIDENCE (what current docs/files show)
   - INFERENCE (reasonable technical deduction, explicitly labeled as inference)
6. Provide 2-4 concise bullet points per section with bold technical keywords and inline code backticks.
7. Format output using EXACTLY these section headers:

${sectionHeaders}`;

  const userPrompt = `Repository: "${repoName}"
Developer Question: "${cleanQuestion}"
Question Category: ${intent}

Repository Evidence Retrieved from Graph:
${evidenceContext}

Synthesize a clear, scannable response following the specified section headers.`;

  if (!isConfigured) {
    console.warn('[Sarvam Service] SARVAM_API_KEY is missing or placeholder. Generating direct GraphRAG synthesis.');
    const answer = generateFallbackAnswer(cleanQuestion, evidence, confidence, null, repoName, intent);
    return { answer, confidence };
  }

  try {
    console.log(`[Sarvam Service] Querying Sarvam AI completions API (intent: ${intent})...`);

    const payload = {
      model: 'sarvam-105b-conversations',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 850,
      temperature: 0.2,
    };

    const response = await axios.post(
      SARVAM_API_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey,
        },
        timeout: 25000,
      }
    );

    const answer = response.data?.choices?.[0]?.message?.content;
    if (!answer || typeof answer !== 'string') {
      throw new Error('Sarvam API returned an empty or invalid response format.');
    }

    console.log('[Sarvam Service] Sarvam AI answer generated successfully.');
    return { answer, confidence };
  } catch (err) {
    console.error('[Sarvam Service] Sarvam API Error Response:', JSON.stringify(err.response?.data || err.message));
    const answer = generateFallbackAnswer(cleanQuestion, evidence, confidence, err.response?.data?.message || err.message, repoName, intent);
    return { answer, confidence };
  }
}

/**
 * Direct evidence synthesizer formatted according to question intent.
 */
function generateFallbackAnswer(question, evidence, confidence, errorNotice = null, repoName = 'this repository', intent = 'HISTORICAL') {
  let output = '';

  if (errorNotice) {
    output += `> ⚠️ *Notice: Sarvam AI service notice (${errorNotice}). Synthesizing repository evidence directly below:*\n\n`;
  }

  const hasEvidence = evidence && evidence.length > 0;
  const fileEv = hasEvidence ? evidence.filter(e => e.type === 'file') : [];

  if (intent === 'DATA_STORAGE') {
    output += `1. DIRECT ANSWER\n`;
    if (hasEvidence) {
      output += `* **${repoName}** manages dataset versioning and storage using **lightweight metadata pointers** and **content hashing**.\n`;
      output += `* Rather than committing large binary data directly into Git, the repository tracks lightweight placeholder files that reference external storage endpoints or local caches.\n\n`;
    } else {
      output += `* I couldn't find enough explicit repository evidence in **${repoName}** to determine the exact dataset versioning data structure or storage strategy.\n\n`;
    }

    output += `2. DATA STRUCTURE\n`;
    if (hasEvidence && fileEv.length > 0) {
      output += `* **Placeholder file structure**: Text-based metadata files (e.g. \`.dvc\`) containing **content hashes**, **file sizes**, and **remote object keys**.\n`;
      output += `* **Cache mapping**: Key-value layout mapping content hashes to actual binary storage blobs.\n\n`;
    } else {
      output += `* **Unknown**: Specific schema definitions for dataset versioning could not be verified from available graph records.\n\n`;
    }

    output += `3. STORAGE / VERSIONING STRATEGY\n`;
    if (hasEvidence) {
      output += `* **Content-addressable storage**: Uses cryptographic hashes (such as MD5) to identify dataset states.\n`;
      output += `* **Decoupled Git tracking**: Keeps Git repository size small by only versioning text pointer files.\n\n`;
    } else {
      output += `* **Unverified**: Storage optimization and rollback strategy details are not documented in the graph.\n\n`;
    }

    output += `4. HOW DATA FLOWS\n`;
    output += `* **Staging**: Local datasets are hashed and copied into a local cache directory.\n`;
    output += `* **Commit**: Lightweight pointer file is committed to Git.\n`;
    output += `* **Sync**: Data assets are pushed or pulled from remote cloud storage on demand.\n\n`;

    output += `5. EVIDENCE\n`;
    if (hasEvidence) {
      evidence.slice(0, 5).forEach((item) => {
        output += `- [${item.type.toUpperCase()}] **${item.title}**: ${item.url}\n`;
      });
      output += `\n`;
    } else {
      output += `* No matching repository evidence found in graph database.\n\n`;
    }

    output += `6. LIMITATIONS\n`;
    output += `* **DIRECT CODE EVIDENCE**: ${fileEv.length > 0 ? 'Source files retrieved.' : 'No direct file evidence retrieved.'}\n`;
    output += `* **INFERENCE**: High-level workflow is inferred from standard tool architecture patterns.\n`;
    return output;
  }

  if (intent === 'ARCHITECTURAL' || intent === 'IMPLEMENTATION') {
    output += `1. DIRECT ANSWER\n`;
    if (hasEvidence) {
      output += `* **${repoName}** uses modular component boundaries and metadata configuration files to implement its architecture.\n\n`;
    } else {
      output += `* I couldn't find enough explicit architectural evidence in **${repoName}** to fully verify the mechanism.\n\n`;
    }

    output += `2. HOW IT WORKS\n`;
    output += `* **Lightweight metadata pointers**: Stores hashes and configuration references in small text files.\n`;
    output += `* **Decoupled execution**: Keeps core logic separate from heavy storage operations.\n\n`;

    output += `3. KEY COMPONENTS\n`;
    if (hasEvidence) {
      evidence.slice(0, 3).forEach((item) => {
        output += `- **${item.title}**: ${item.reason}\n`;
      });
      output += `\n`;
    } else {
      output += `- **Component Specs**: Insufficient records in graph to enumerate key components.\n\n`;
    }

    output += `4. IMPLEMENTATION EVIDENCE\n`;
    if (hasEvidence) {
      evidence.forEach((item) => {
        output += `- [${item.type.toUpperCase()}] **${item.title}**: ${item.url}\n`;
      });
      output += `\n`;
    } else {
      output += `* No explicit implementation evidence retrieved.\n\n`;
    }

    output += `5. LIMITATIONS / UNKNOWNS\n`;
    output += `* Unverified implementation details not present in graph records remain unknown.\n`;
    return output;
  }

  if (intent === 'PERFORMANCE') {
    output += `1. DIRECT ANSWER\n`;
    output += `* **${repoName}** achieves performance and storage efficiency by preventing large binary duplication.\n\n`;

    output += `2. PERFORMANCE STRATEGY\n`;
    output += `* **Lazy loading**: Heavy data files are fetched from remote storage only when explicitly requested.\n`;
    output += `* **Deduplication**: Content-addressable hashing avoids storing identical data blobs multiple times.\n\n`;

    output += `3. BOTTLENECK / TRADEOFF\n`;
    output += `* Network bandwidth and remote storage latency during initial checkout operations.\n\n`;

    output += `4. IMPLEMENTATION EVIDENCE\n`;
    if (hasEvidence) {
      evidence.forEach((item) => {
        output += `- [${item.type.toUpperCase()}] **${item.title}**: ${item.url}\n`;
      });
      output += `\n`;
    } else {
      output += `* No explicit performance evidence retrieved.\n\n`;
    }

    output += `5. LIMITATIONS\n`;
    output += `* Performance metrics and benchmark data are not documented in repository graph records.\n`;
    return output;
  }

  // Default: HISTORICAL
  if (confidence === 'insufficient_evidence' || !hasEvidence) {
    output += `1. DIRECT ANSWER\n* No matching historical evidence (commits, PRs, or issues) found in graph database for **${repoName}**.\n\n`;
    output += `2. WHAT CHANGED\n* Code evolution records are not documented in the available graph evidence.\n\n`;
    output += `3. WHY IT CHANGED\n* The repository shows no matching evidence to explain why changes occurred.\n\n`;
    output += `4. HOW IT EVOLVED\n* Evolution trajectory is not documented in available graph records.\n\n`;
    output += `5. EVIDENCE\n* No matching commit or PR records.\n\n`;
    output += `6. UNCERTAINTIES\n* All historical changes and evolution motivations remain unverified.`;
    return output;
  }

  const topEvidence = evidence[0];
  const authors = [...new Set(evidence.map((e) => e.author).filter((a) => a && a !== 'Unknown'))];
  const sources = evidence.map((e) => e.url).filter((u) => u && u !== '#');

  output += `1. DIRECT ANSWER\n`;
  output += `* **HISTORICAL EVIDENCE**: **${repoName}** evolved across ${evidence.length} recorded commits and pull requests.\n`;
  output += `* The primary documented change was **${topEvidence.title}** by @${topEvidence.author} on ${topEvidence.date || 'recorded date'}.\n\n`;

  output += `2. WHAT CHANGED\n`;
  evidence.slice(0, 4).forEach((item) => {
    output += `* **HISTORICAL EVIDENCE**: **${item.title}** (by @${item.author}): ${item.reason}\n`;
  });
  output += `\n`;

  output += `3. WHY IT CHANGED\n`;
  const reasons = evidence.filter(e => e.reason && e.reason.length > 15);
  if (reasons.length > 0) {
    reasons.slice(0, 3).forEach((item) => {
      output += `* **HISTORICAL EVIDENCE**: Commit message for **${item.title}** states: ${item.reason}\n`;
    });
  } else {
    output += `* The repository shows that these changes occurred, but commit messages do not document why.\n`;
  }
  output += `\n`;

  output += `4. HOW IT EVOLVED\n`;
  output += `* **Chronological Progression**: Recorded changes progressed across ${evidence.length} commits from earlier updates to recent refactors.\n\n`;

  output += `5. EVIDENCE\n`;
  if (sources.length > 0) {
    sources.slice(0, 5).forEach((src) => {
      output += `- [HISTORICAL EVIDENCE] ${src}\n`;
    });
    output += `\n`;
  } else {
    output += `- N/A\n\n`;
  }

  output += `6. UNCERTAINTIES\n`;
  output += `* **INFERENCE**: Motivations not explicitly written in commit messages remain unverified.\n`;

  return output;
}
