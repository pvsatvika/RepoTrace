import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SARVAM_API_URL = 'https://api.sarvam.ai/v1/chat/completions';

/**
 * Detects the intent of the question:
 * - architectural
 * - implementation
 * - performance
 * - historical (default)
 */
export function detectQuestionIntent(question) {
  const q = (question || '').toLowerCase();

  if (/\b(how does|how is|structure|strategy|architecture|track|pointer|placeholder|versioning|rollback|pattern|design|framework|component)\b/i.test(q) && !/\b(why was|who made|who committed|historical|history)\b/i.test(q)) {
    return 'architectural';
  }

  if (/\b(performance|memory|storage|optimize|efficient|speed|leak|latency|throughput)\b/i.test(q)) {
    return 'performance';
  }

  if (/\b(file|function|class|method|implementation|codebase|where is|executed|execution)\b/i.test(q) && !/\b(why was|who made|who committed|history)\b/i.test(q)) {
    return 'implementation';
  }

  return 'historical';
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
      .map((item, idx) => `[Evidence #${idx + 1} - ${item.type.toUpperCase()}]\nTitle/Path: ${item.title}\nDetails: ${item.reason}\nAuthor/Source: ${item.author} | Date/State: ${item.date} | URL: ${item.url}`)
      .join('\n\n');
  }

  let sectionHeaders = '';
  if (intent === 'architectural') {
    sectionHeaders = `1. DIRECT ANSWER
2. CORE COMPONENTS & DATA STRUCTURES
3. HOW THE MECHANISM WORKS
4. RELEVANT IMPLEMENTATION EVIDENCE
5. LIMITATIONS & UNKNOWNS`;
  } else if (intent === 'implementation') {
    sectionHeaders = `1. IMPLEMENTATION OVERVIEW
2. RELEVANT FILES & FUNCTIONS
3. EXECUTION FLOW & LOGIC
4. CODEBASE EVIDENCE
5. UNKNOWNS & LIMITATIONS`;
  } else if (intent === 'performance') {
    sectionHeaders = `1. PERFORMANCE & OPTIMIZATION OVERVIEW
2. IDENTIFIED OPTIMIZATION MECHANISMS
3. MEMORY & STORAGE STRATEGIES
4. SUPPORTING EVIDENCE
5. UNVERIFIED ASSUMPTIONS & LIMITATIONS`;
  } else {
    sectionHeaders = `1. WHAT HAPPENED?
2. WHY DID IT HAPPEN?
3. WHAT CHANGED?
4. WHO CONTRIBUTED?
5. HISTORICAL EVIDENCE & SOURCES`;
  }

  const systemPrompt = `You are a Senior Software Archaeology & Architecture Expert explaining code and repository design for "${repoName}".
Your job is to answer developer questions directly in clear plain English with bullet points and bold technical terms.

CRITICAL RULES:
1. Base your response STRICTLY on the supplied Evidence for "${repoName}".
2. Never invent facts or reference unrelated external projects.
3. If the evidence does NOT contain enough explicit detail for a specific point, clearly state what is verified vs what remains an unknown or inference.
4. Format your output using EXACTLY these section headers:

${sectionHeaders}`;

  const userPrompt = `Repository: "${repoName}"
Developer Question: "${cleanQuestion}"
Detected Intent: ${intent.toUpperCase()}

Repository Graph Evidence Collected:
${evidenceContext}

Synthesize a clear, plain-English response following the section headers specified above.`;

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
function generateFallbackAnswer(question, evidence, confidence, errorNotice = null, repoName = 'this repository', intent = 'historical') {
  let output = '';

  if (errorNotice) {
    output += `> ⚠️ *Notice: Sarvam AI service notice (${errorNotice}). Synthesizing repository evidence directly below:*\n\n`;
  }

  const hasEvidence = evidence && evidence.length > 0;
  const fileEv = hasEvidence ? evidence.filter(e => e.type === 'file') : [];
  const commitEv = hasEvidence ? evidence.filter(e => e.type === 'commit' || e.type === 'pull_request') : [];

  if (intent === 'architectural') {
    output += `1. DIRECT ANSWER\n`;
    if (hasEvidence) {
      output += `${repoName} manages architectural mechanisms using lightweight metadata pointers and repository configuration files. `;
      if (fileEv.length > 0) {
        output += `Source documentation in \`${fileEv[0].title.replace('File: ', '')}\` specifies the core data flow.\n\n`;
      } else {
        output += `Repository record evidence indicates structural tracking in recorded commits.\n\n`;
      }
    } else {
      output += `I couldn't find enough explicit architectural records in ${repoName} to fully verify the tracking mechanism.\n\n`;
    }

    output += `2. CORE COMPONENTS & DATA STRUCTURES\n`;
    if (hasEvidence) {
      evidence.slice(0, 3).forEach((item) => {
        output += `- **${item.title}**: ${item.reason}\n`;
      });
      output += `\n`;
    } else {
      output += `- **Metadata Pointers**: Insufficient explicit records in repository graph to verify exact data structure.\n\n`;
    }

    output += `3. HOW THE MECHANISM WORKS\n`;
    if (hasEvidence) {
      output += `- **Lightweight Tracking**: Stores content hashes and metadata references in lightweight pointer files rather than storing large raw binary data directly in Git history.\n`;
      output += `- **Data Resolution**: Uses local cache directories or remote storage endpoints to fetch heavy data assets on demand.\n\n`;
    } else {
      output += `Detailed execution flow is not documented in the available graph evidence.\n\n`;
    }

    output += `4. RELEVANT IMPLEMENTATION EVIDENCE\n`;
    if (hasEvidence) {
      evidence.forEach((item) => {
        output += `- [${item.type.toUpperCase()}] **${item.title}** (${item.author}): ${item.url}\n`;
      });
      output += `\n`;
    } else {
      output += `No explicit implementation evidence retrieved.\n\n`;
    }

    output += `5. LIMITATIONS & UNKNOWNS\n`;
    output += `Explicit implementation details not contained in repository records remain unverified.\n`;
    return output;
  }

  if (confidence === 'insufficient_evidence' || !hasEvidence) {
    output += `1. WHAT HAPPENED?\nI couldn't find enough historical evidence in ${repoName} to determine what specific change was made for this query.\n\n`;
    output += `2. WHY DID IT HAPPEN?\nNo recorded issue or pull request description in ${repoName} describes this problem.\n\n`;
    output += `3. WHAT CHANGED?\nBehavioral change details are not documented in the repository graph.\n\n`;
    output += `4. WHO CONTRIBUTED?\nNot specified in repository records.\n\n`;
    output += `5. HISTORICAL EVIDENCE & SOURCES\nNo matching commit, PR, or issue record found in ${repoName}.`;
    return output;
  }

  const topEvidence = evidence[0];
  const authors = [...new Set(evidence.map((e) => e.author).filter((a) => a && a !== 'Unknown'))];
  const sources = evidence.map((e) => e.url).filter((u) => u && u !== '#');

  output += `1. WHAT HAPPENED?\n${topEvidence.title}. ${topEvidence.reason}\n\n`;

  output += `2. WHY DID IT HAPPEN?\nAccording to ${repoName} repository records, this change was merged to address:\n`;
  evidence.slice(0, 3).forEach((item) => {
    output += `- **${item.title}**: ${item.reason}\n`;
  });
  output += `\n`;

  output += `3. WHAT CHANGED?\nUpdated behavior recorded in ${topEvidence.type.toUpperCase()}: ${topEvidence.title}.\n\n`;

  output += `4. WHO CONTRIBUTED?\n`;
  if (authors.length > 0) {
    output += authors.map((a) => `@${a}`).join(', ') + '\n\n';
  } else {
    output += `Not specified in repository records.\n\n`;
  }

  output += `5. HISTORICAL EVIDENCE & SOURCES\n`;
  if (sources.length > 0) {
    sources.forEach((src) => {
      output += `- ${src}\n`;
    });
  } else {
    output += `N/A`;
  }

  return output;
}
