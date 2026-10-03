import React from 'react';

/**
 * Formats inline Markdown elements:
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 * - Code: `code`
 * - Links: [label](url)
 * - Raw URLs: https://...
 */
function formatMarkdownInline(str) {
  if (!str) return '';
  
  // Escape HTML tags to prevent XSS
  let safe = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 1. Inline code: `code`
  safe = safe.replace(
    /`([^`]+)`/g,
    '<code class="bg-[var(--badge-bg)] text-[var(--accent-blue)] border border-[var(--badge-border)] px-1.5 py-0.5 rounded text-xs font-mono font-semibold break-all">$1</code>'
  );

  // 2. Bold text: **text** or __text__
  safe = safe.replace(
    /(\*\*|__)(.*?)\1/g,
    '<strong class="font-bold text-theme-primary">$2</strong>'
  );

  // 3. Italic text: *text* or _text_
  safe = safe.replace(
    /(\*|_)(.*?)\1/g,
    '<em class="italic text-theme-secondary">$2</em>'
  );

  // 4. Markdown links: [label](url)
  safe = safe.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[var(--accent-blue)] hover:underline font-semibold inline-flex items-center gap-0.5">$1 <span class="text-[10px]">↗</span></a>'
  );

  // 5. Raw URLs: https://...
  safe = safe.replace(
    /(?<!href="|">)(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-[var(--accent-blue)] hover:underline font-semibold break-all">$1 ↗</a>'
  );

  return safe;
}

/**
 * Helper to extract a 2-3 sentence Executive Gist summary from the answer text.
 */
function extractSummaryGist(text) {
  if (!text) return null;

  let cleanText = text;
  
  // Try finding section 1 (WHAT HAPPENED?) or section 3 (WHY WAS IT CHANGED?)
  const whatHappenedMatch = text.match(/(?:1\.\s+WHAT HAPPENED\?|###\s+WHAT HAPPENED\?)\n+([\s\S]*?)(?=\n+\d+\.|\n+###|$)/i);
  const whyChangedMatch = text.match(/(?:3\.\s+WHY WAS IT CHANGED\?|###\s+WHY WAS IT CHANGED\?)\n+([\s\S]*?)(?=\n+\d+\.|\n+###|$)/i);

  let sourceSnippet = '';
  if (whatHappenedMatch && whatHappenedMatch[1].trim()) {
    sourceSnippet = whatHappenedMatch[1].trim();
  } else if (whyChangedMatch && whyChangedMatch[1].trim()) {
    sourceSnippet = whyChangedMatch[1].trim();
  } else {
    sourceSnippet = cleanText.trim();
  }

  // Remove markdown bullet points / headers from snippet
  const sentences = sourceSnippet
    .split('\n')
    .filter(line => !line.trim().match(/^\d+\.\s+[A-Z]/))
    .join(' ')
    .replace(/^[-*]\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 10);

  if (sentences.length === 0) return null;

  // Return top 2-3 sentences
  return sentences.slice(0, 3).join(' ');
}

/**
 * Parses full answer text into clean, structured sections & blocks.
 */
function FormattedAnswerText({ text }) {
  if (!text) return null;

  // Split into lines
  const lines = text.split('\n');
  const sections = [];
  let currentSection = { title: null, number: null, blocks: [] };
  let currentList = null;

  const pushCurrentList = () => {
    if (currentList && currentList.length > 0) {
      currentSection.blocks.push({ type: 'list', items: currentList });
      currentList = null;
    }
  };

  const pushCurrentSection = () => {
    pushCurrentList();
    if (currentSection.title || currentSection.blocks.length > 0) {
      sections.push(currentSection);
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    // Check section header like "1. WHAT HAPPENED?" or "### WHAT HAPPENED?"
    const sectionMatch = trimmed.match(/^(\d+)\.\s+(.+)$/) || trimmed.match(/^###\s+(.+)$/);
    if (sectionMatch && (sectionMatch[2] === sectionMatch[2].toUpperCase() || trimmed.startsWith('###'))) {
      pushCurrentSection();
      currentSection = {
        number: sectionMatch[1] && !trimmed.startsWith('###') ? sectionMatch[1] : null,
        title: sectionMatch[2] || sectionMatch[1],
        blocks: []
      };
      return;
    }

    if (!trimmed) {
      pushCurrentList();
      return;
    }

    // Bullet point line
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.substring(2);
      if (!currentList) currentList = [];
      currentList.push(content);
      return;
    }

    // Blockquote line
    if (trimmed.startsWith('> ')) {
      pushCurrentList();
      currentSection.blocks.push({ type: 'blockquote', content: trimmed.replace('> ', '') });
      return;
    }

    // Subheader ####
    if (trimmed.startsWith('#### ')) {
      pushCurrentList();
      currentSection.blocks.push({ type: 'subheader', content: trimmed.replace('#### ', '') });
      return;
    }

    // Regular paragraph line
    pushCurrentList();
    currentSection.blocks.push({ type: 'paragraph', content: trimmed });
  });

  pushCurrentSection();

  return (
    <div className="space-y-6">
      {sections.map((sec, secIdx) => {
        const hasUncertainty = sec.blocks.some(b => 
          typeof b.content === 'string' && (
            b.content.includes("couldn't find enough historical evidence") ||
            b.content.includes("No matching commit") ||
            b.content.includes("Not specified in repository records")
          )
        );

        return (
          <div 
            key={secIdx}
            className="p-5 sm:p-6 rounded-2xl bg-theme-input/30 border border-theme space-y-4 shadow-theme-sm transition-all duration-200 hover:border-theme/80"
          >
            {sec.title && (
              <div className="flex items-center justify-between border-b border-theme/60 pb-3">
                <div className="flex items-center gap-2.5">
                  {sec.number && (
                    <span className="px-2 py-0.5 rounded-md bg-[var(--badge-bg)] text-[var(--accent-blue)] border border-[var(--badge-border)] text-xs font-mono font-bold">
                      0{sec.number}
                    </span>
                  )}
                  <h3 className="text-sm sm:text-base font-bold text-theme-primary font-mono uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-blue)] inline-block" />
                    {sec.title}
                  </h3>
                </div>

                {hasUncertainty && (
                  <span className="text-[11px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-semibold">
                    LIMITED DATA
                  </span>
                )}
              </div>
            )}

            <div className="space-y-3 font-sans">
              {sec.blocks.map((block, bIdx) => {
                if (block.type === 'list') {
                  return (
                    <ul key={bIdx} className="space-y-2.5 my-3 pl-1">
                      {block.items.map((item, iIdx) => (
                        <li key={iIdx} className="flex items-start gap-3 text-theme-primary text-sm sm:text-base leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] mt-2 shrink-0 inline-block" />
                          <span 
                            className="flex-1"
                            dangerouslySetInnerHTML={{ __html: formatMarkdownInline(item) }} 
                          />
                        </li>
                      ))}
                    </ul>
                  );
                }

                if (block.type === 'blockquote') {
                  return (
                    <blockquote key={bIdx} className="border-l-3 border-[var(--accent-purple)] bg-theme-card p-4 rounded-xl text-theme-secondary text-sm italic my-3 border border-theme">
                      <span dangerouslySetInnerHTML={{ __html: formatMarkdownInline(block.content) }} />
                    </blockquote>
                  );
                }

                if (block.type === 'subheader') {
                  return (
                    <h4 key={bIdx} className="text-sm font-bold text-theme-primary font-mono pt-2">
                      {block.content}
                    </h4>
                  );
                }

                const isUncertaintyLine = typeof block.content === 'string' && block.content.includes("couldn't find enough historical evidence");

                if (isUncertaintyLine) {
                  return (
                    <div key={bIdx} className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs font-mono flex items-center gap-2.5 my-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 inline-block animate-pulse" />
                      <span>{block.content}</span>
                    </div>
                  );
                }

                return (
                  <p key={bIdx} className="text-theme-primary text-sm sm:text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: formatMarkdownInline(block.content) }} />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnswerPanel({ queryResult }) {
  if (!queryResult || !queryResult.answer) return null;

  const isSupported = queryResult.confidence === 'supported';
  const evidenceCount = queryResult.evidence?.length || 0;
  const summaryGist = extractSummaryGist(queryResult.answer);

  return (
    <div className="py-4 space-y-6">
      
      {/* CANVAS HEADLINE & CONFIDENCE BADGE */}
      <div className="space-y-3 border-b border-theme pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <span className="text-xs font-bold text-[var(--accent-purple)] uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-purple)] inline-block" />
            SYNTHESIZED HISTORICAL RATIONALE
          </span>

          <div className="flex items-center gap-3 text-xs">
            <span className={`font-bold px-3 py-0.5 rounded-full text-xs ${
              isSupported ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
            }`}>
              {isSupported ? 'CONFIDENCE: SUPPORTED' : 'LIMITED EVIDENCE'}
            </span>
            <span className="text-theme-muted">·</span>
            <span className="text-theme-muted"><strong className="text-theme-primary">{evidenceCount}</strong> SOURCES RETRIEVED</span>
          </div>
        </div>

        <h2 className="text-3xl sm:text-4xl font-extrabold text-theme-primary tracking-tight leading-tight">
          WHY THE CODE IS LIKE THIS
        </h2>
      </div>

      {/* EXECUTIVE SUMMARY GIST CARD */}
      {summaryGist && (
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[var(--badge-bg)] to-transparent border border-[var(--badge-border)] shadow-theme-sm space-y-2.5 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-[var(--accent-blue)] uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-blue)] inline-block animate-pulse" />
              EXECUTIVE SUMMARY GIST
            </span>
            <span className="text-theme-muted text-[11px]">DIRECT CONCLUSION</span>
          </div>
          <p className="text-theme-primary text-base sm:text-lg font-semibold leading-relaxed">
            {summaryGist}
          </p>
        </div>
      )}

      {!isSupported && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-500 rounded-xl flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span>Neo4j graph contained limited explicit records for this query. Synthesis represents best-effort rationale.</span>
        </div>
      )}

      {/* SYNTHESIZED REASONING BODY */}
      <div className="bg-theme-card border border-theme rounded-2xl p-6 sm:p-8 shadow-theme-sm space-y-6">
        <FormattedAnswerText text={queryResult.answer} />
      </div>

    </div>
  );
}
