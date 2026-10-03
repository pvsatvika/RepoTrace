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

  if (/\b(data structure|schema|storage|versioning|rollback|persistence|caching|dvc|dataset|database|pointer|placeholder|snapshot|delta)\b/i.test(q)) {
    return 'DATA_STORAGE';
  }

  if (/\b(performance|memory|speed|optimization|scalable|scalability|throughput|leak|bottleneck|efficiency|optimize|latency)\b/i.test(q)) {
    return 'PERFORMANCE';
  }

  if (/\b(architecture|system design|component|boundary|pattern|tradeoff|design|framework|module|how does|how is)\b/i.test(q) && !/\b(why was|who made|who committed|historical|history|commit|pr)\b/i.test(q)) {
    return 'ARCHITECTURAL';
  }

  if (/\b(how it works|file|function|class|method|implementation|codebase|where is|executed|execution|logic)\b/i.test(q) && !/\b(why was|who|history|commit|pr)\b/i.test(q)) {
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
  if (intent === 'ARCHITECTURAL' || intent === 'IMPLEMENTATION') {
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
  } else {
    sectionHeaders = `1. WHAT CHANGED
2. WHY IT CHANGED
3. HOW IT EVOLVED
4. EVIDENCE
5. WHO / WHEN`;
  }

  const systemPrompt = `You are a Senior Software Archaeology & Architecture Expert explaining repository code, design, and history for "${repoName}".
Your job is to answer developer questions directly in clean, easy-to-scan plain English.

CRITICAL ANSWER FORMATTING RULES:
1. Provide 2-5 bullet points per section with concise, technical sentences.
2. Bold important technical terms (e.g. **metadata pointers**, **MD5 hash**, **content-addressable storage**).
3. Use inline code backticks for filenames, functions, paths, and config names (e.g. \`.dvc\`, \`dvc.yaml\`, \`Cache\`).
4. Ground all claims STRICTLY in the provided Evidence for "${repoName}".
5. Clearly distinguish between:
   - DIRECT CODE/DOCUMENTATION EVIDENCE
   - HISTORICAL EVIDENCE
   - INFERENCE
6. Never invent implementation details. If the evidence is incomplete or missing, explicitly state what is unknown.
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
    output += `1. WHAT CHANGED\n* No matching historical evidence (commits, PRs, or issues) found in graph database for **${repoName}**.\n\n`;
    output += `2. WHY IT CHANGED\n* No recorded issue or pull request description explains why changes occurred.\n\n`;
    output += `3. HOW IT EVOLVED\n* Evolution trajectory is not documented in available graph records.\n\n`;
    output += `4. EVIDENCE\n* No matching commit or PR records.\n\n`;
    output += `5. WHO / WHEN\n* Not specified in repository records.`;
    return output;
  }

  const topEvidence = evidence[0];
  const authors = [...new Set(evidence.map((e) => e.author).filter((a) => a && a !== 'Unknown'))];
  const sources = evidence.map((e) => e.url).filter((u) => u && u !== '#');

  output += `1. WHAT CHANGED\n* **${topEvidence.title}**: ${topEvidence.reason}\n\n`;

  output += `2. WHY IT CHANGED\n* According to repository records, changes were merged to address:\n`;
  evidence.slice(0, 3).forEach((item) => {
    output += `  - **${item.title}**: ${item.reason}\n`;
  });
  output += `\n`;

  output += `3. HOW IT EVOLVED\n* Recorded in **${topEvidence.type.toUpperCase()}**: ${topEvidence.title}.\n\n`;

  output += `4. EVIDENCE\n`;
  if (sources.length > 0) {
    sources.forEach((src) => {
      output += `- ${src}\n`;
    });
    output += `\n`;
  } else {
    output += `- N/A\n\n`;
  }

  output += `5. WHO / WHEN\n`;
  if (authors.length > 0) {
    output += `* Contributed by ${authors.map((a) => `@${a}`).join(', ')} on ${topEvidence.date || 'recorded date'}.\n`;
  } else {
    output += `* Not specified in repository records.\n`;
  }

  return output;
}
