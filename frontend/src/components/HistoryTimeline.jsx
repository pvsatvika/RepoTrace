import React from 'react';

function getHumanReadableTitle(item) {
  if (!item) return 'Repository Event';
  let title = item.title || item.reason || 'Repository Change';
  title = title
    .replace(/^(Commit\s+[a-f0-9]+:\s*)/i, '')
    .replace(/^(PR\s*#\d+:\s*)/i, '')
    .replace(/^(Pull Request\s*#\d+:\s*)/i, '')
    .replace(/^(Issue\s*#\d+:\s*)/i, '')
    .replace(/^(Architectural Decision:\s*)/i, '')
    .replace(/^(Incident \/ Problem:\s*)/i, '')
    .replace(/^(Decision \([^)]+\):\s*)/i, '')
    .replace(/^(Incident \([^)]+\):\s*)/i, '')
    .trim();

  if (!title || /^[a-f0-9]{7,40}$/i.test(title)) {
    title = item.reason ? item.reason.split('\n')[0].substring(0, 120) : (item.title || 'Repository Change');
  }
  return title;
}

function getTechnicalId(item) {
  if (!item || !item.id) return null;
  if (item.type === 'commit' || /^[a-f0-9]{7,40}$/i.test(item.id)) {
    return item.id.length > 7 ? item.id.substring(0, 7) : item.id;
  }
  if (item.type === 'pull_request' || item.type === 'issue') {
    return item.id.includes('#') ? `#${item.id.split('#')[1]}` : item.id;
  }
  return item.id;
}

function formatChangeTypeLabel(type) {
  switch (type) {
    case 'commit': return 'Commit';
    case 'pull_request': return 'Pull Request';
    case 'issue': return 'Issue';
    case 'discussion': return 'Discussion';
    case 'decision': return 'Decision';
    case 'incident': return 'Incident';
    default: return type || 'Event';
  }
}

export default function HistoryTimeline({ evidence = [] }) {
  if (!evidence || evidence.length === 0) return null;

  const timelineItems = [...evidence].slice(0, 10);

  return (
    <div className="py-4 space-y-6">
      
      {/* HEADER */}
      <div>
        <h3 className="text-lg font-extrabold text-theme-primary tracking-tight font-sans">
          Chronological Evolution Timeline
        </h3>
        <p className="text-xs text-theme-secondary font-sans mt-0.5">
          Chronological sequence of repository changes, refactors, and historical context.
        </p>
      </div>

      {/* CHRONOLOGICAL RAIL */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-theme">
        {timelineItems.map((item, idx) => {
          const hasUrl = item.url && item.url !== '#' && item.url.startsWith('http');
          const humanTitle = getHumanReadableTitle(item);
          const techId = getTechnicalId(item);

          return (
            <div key={idx} className="relative group pl-3 space-y-2">
              {/* NODE DOT */}
              <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-[var(--accent-blue)] ring-4 ring-theme-main transition-transform group-hover:scale-125" />

              {/* CHANGE TYPE & DATE */}
              <div className="flex items-center justify-between text-xs font-mono text-theme-muted">
                <span className="text-[var(--accent-blue)] font-bold uppercase tracking-wider bg-[var(--badge-bg)] px-2 py-0.5 border border-[var(--badge-border)] rounded-md">
                  {formatChangeTypeLabel(item.type)}
                </span>
                <span>{item.date || 'Historical Event'}</span>
              </div>

              {/* HUMAN READABLE TITLE */}
              <h4 className="font-bold text-theme-primary text-sm sm:text-base font-sans leading-snug">
                {humanTitle}
              </h4>

              {/* REASON EXCERPT */}
              {item.reason && (
                <p className="text-xs sm:text-sm text-theme-secondary font-sans italic leading-relaxed pl-3 border-l-2 border-[var(--accent-purple)]">
                  "{item.reason}"
                </p>
              )}

              {/* METADATA & SOURCE LINK */}
              <div className="flex flex-wrap items-center justify-between text-xs font-sans text-theme-muted pt-1 gap-2 border-t border-theme/50">
                <div className="flex items-center gap-3">
                  <span className="text-theme-secondary font-medium">@{item.author || 'contributor'}</span>
                  {techId && (
                    <span className="font-mono text-[11px] text-theme-muted bg-theme-input px-2 py-0.5 rounded border border-theme">
                      commit: {techId}
                    </span>
                  )}
                </div>

                {hasUrl && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-[var(--accent-blue)] hover:underline font-bold flex items-center gap-1"
                  >
                    <span>VIEW SOURCE</span>
                    <span>→</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
