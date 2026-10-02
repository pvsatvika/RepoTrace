import React from 'react';

function FormattedAnswerText({ text }) {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <div className="space-y-4 text-theme-primary text-base leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;

        const isSectionHeader = /^\d+\.\s+[A-Z\s\?]+$/.test(trimmed) || trimmed.startsWith('### ');
        if (isSectionHeader) {
          const title = trimmed.replace(/^###\s+/, '');
          return (
            <div key={idx} className="pt-5 pb-1 border-b border-theme flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-wider font-mono uppercase text-[var(--accent-blue)]">
                {title}
              </h3>
            </div>
          );
        }

        if (trimmed.startsWith('#### ')) {
          return (
            <h4 key={idx} className="text-base font-bold text-theme-primary font-mono pt-2">
              {trimmed.replace('#### ', '')}
            </h4>
          );
        }

        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={idx} className="border-l-2 border-[var(--accent-purple)] bg-theme-input p-4 rounded-xl text-theme-primary text-sm italic my-3 border border-theme">
              {trimmed.replace('> ', '')}
            </blockquote>
          );
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.substring(2);
          return (
            <li key={idx} className="ml-4 list-disc text-theme-primary">
              <span dangerouslySetInnerHTML={{ __html: formatInlineCode(content) }} />
            </li>
          );
        }

        return (
          <p key={idx} className="text-theme-primary" dangerouslySetInnerHTML={{ __html: formatInlineCode(line) }} />
        );
      })}
    </div>
  );
}

function formatInlineCode(str) {
  if (!str) return '';
  return str.replace(
    /`([^`]+)`/g,
    '<code class="bg-[var(--badge-bg)] text-[var(--accent-blue)] border border-[var(--badge-border)] px-1.5 py-0.5 rounded text-xs font-mono font-semibold">$1</code>'
  );
}

export default function AnswerPanel({ queryResult }) {
  if (!queryResult || !queryResult.answer) return null;

  const isSupported = queryResult.confidence === 'supported';
  const evidenceCount = queryResult.evidence?.length || 0;

  return (
    <div className="py-4 space-y-6">
      
      {/* CANVAS HEADLINE & CONFIDENCE BADGE */}
      <div className="space-y-3 border-b border-theme pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <span className="text-xs font-bold text-[var(--accent-purple)] uppercase tracking-wider">
            SYNTHESIZED HISTORICAL RATIONALE
          </span>

          <div className="flex items-center gap-3 text-xs">
            <span className={`font-bold px-3 py-0.5 rounded-full text-xs ${
              isSupported ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
            }`}>
              {isSupported ? 'CONFIDENCE: SUPPORTED' : 'LIMITED EVIDENCE'}
            </span>
            <span>·</span>
            <span className="text-theme-muted"><strong className="text-theme-primary">{evidenceCount}</strong> SOURCES RETRIEVED</span>
          </div>
        </div>

        <h2 className="text-3xl sm:text-4xl font-extrabold text-theme-primary tracking-tight leading-tight">
          WHY THE CODE IS LIKE THIS
        </h2>
      </div>

      {!isSupported && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-xs font-mono text-rose-500 rounded-xl">
          Neo4j graph contained limited explicit records for this query. Synthesis represents best-effort context.
        </div>
      )}

      {/* SYNTHESIZED REASONING BODY */}
      <div className="bg-theme-card border border-theme rounded-2xl p-6 sm:p-8 shadow-xs">
        <FormattedAnswerText text={queryResult.answer} />
      </div>

    </div>
  );
}
