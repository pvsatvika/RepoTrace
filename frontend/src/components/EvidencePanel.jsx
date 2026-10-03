import React, { useState } from 'react';

function getHumanReadableTitle(item) {
  if (!item) return 'Historical Evidence Record';
  let title = item.title || item.reason || 'Repository Code Change';
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
    title = item.reason ? item.reason.split('\n')[0].substring(0, 120) : (item.title || 'Repository Code Change');
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
    default: return type || 'Evidence';
  }
}

export default function EvidencePanel({ evidence = [], activeFilter = 'all', setActiveFilter }) {
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(null);

  if (!evidence) return null;

  const filterTypes = [
    { key: 'all', label: 'ALL', count: evidence.length },
    { key: 'decision', label: 'DECISIONS', count: evidence.filter(e => e.type === 'decision').length },
    { key: 'incident', label: 'INCIDENTS', count: evidence.filter(e => e.type === 'incident').length },
    { key: 'pull_request', label: 'PULL REQUESTS', count: evidence.filter(e => e.type === 'pull_request').length },
    { key: 'commit', label: 'COMMITS', count: evidence.filter(e => e.type === 'commit').length },
    { key: 'discussion', label: 'DISCUSSIONS', count: evidence.filter(e => e.type === 'discussion').length },
    { key: 'issue', label: 'ISSUES', count: evidence.filter(e => e.type === 'issue').length }
  ];

  const filteredEvidence = activeFilter === 'all'
    ? evidence
    : activeFilter === 'code_entity'
    ? evidence.filter(e => e.type === 'file' || e.type === 'code_entity')
    : evidence.filter(item => item.type === activeFilter);

  return (
    <div className="py-4 space-y-4">
      
      {/* HEADER & FILTER CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-3">
        <div>
          <h3 className="text-lg font-extrabold text-theme-primary tracking-tight font-sans">
            Source Material Evidence
          </h3>
          <p className="text-xs text-theme-secondary font-sans mt-0.5">
            Empirical repository evidence retrieved for this question.
          </p>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-1.5 overflow-x-auto font-mono text-xs">
          {filterTypes.map(ft => (
            ft.count > 0 || ft.key === 'all' ? (
              <button
                key={ft.key}
                onClick={() => setActiveFilter && setActiveFilter(ft.key)}
                className={`px-2.5 py-1 rounded-lg border transition-all duration-200 whitespace-nowrap cursor-pointer text-[11px] ${
                  activeFilter === ft.key
                    ? 'bg-[var(--badge-bg)] text-[var(--accent-blue)] border-[var(--accent-blue)] font-bold'
                    : 'bg-transparent text-theme-muted border-transparent hover:text-theme-primary'
                }`}
              >
                {ft.label} ({ft.count})
              </button>
            ) : null
          ))}
        </div>
      </div>

      {/* VERTICAL RESEARCH FEED */}
      {filteredEvidence.length === 0 ? (
        <div className="py-8 text-center text-theme-muted text-xs font-mono bg-theme-card border border-theme rounded-xl">
          No records match filter '{activeFilter}'.
        </div>
      ) : (
        <div className="divide-y divide-theme">
          {filteredEvidence.map((item, idx) => {
            const hasUrl = item.url && item.url !== '#' && item.url.startsWith('http');
            const isSelected = selectedEvidenceId === idx;
            const humanTitle = getHumanReadableTitle(item);
            const techId = getTechnicalId(item);

            return (
              <div
                key={idx}
                onClick={() => {
                  setSelectedEvidenceId(idx);
                  if (setActiveFilter && item.type) {
                    setActiveFilter(item.type);
                  }
                }}
                className={`py-4 space-y-2.5 transition-all duration-200 cursor-pointer px-3.5 rounded-xl ${
                  isSelected
                    ? 'bg-theme-card border border-[var(--accent-purple)] shadow-theme-sm'
                    : 'hover:bg-theme-card/70 hover:-translate-y-0.5'
                }`}
              >
                {/* 1. TITLE & SOURCE LINK */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-[var(--accent-blue)]">
                      <span className="bg-[var(--badge-bg)] px-2 py-0.5 border border-[var(--badge-border)] rounded-md">
                        {formatChangeTypeLabel(item.type)}
                      </span>
                    </div>
                    <h4 className="font-bold text-theme-primary text-sm sm:text-base font-sans leading-snug">
                      {humanTitle}
                    </h4>
                  </div>

                  {hasUrl && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-xs text-[var(--accent-blue)] hover:underline whitespace-nowrap font-bold flex items-center gap-1 shrink-0 mt-0.5"
                    >
                      <span>VIEW SOURCE</span>
                      <span>→</span>
                    </a>
                  )}
                </div>

                {/* 2. EXCERPT */}
                {item.reason && (
                  <p className="text-xs sm:text-sm text-theme-secondary font-sans pl-3 border-l-2 border-[var(--accent-purple)] my-2 leading-relaxed">
                    "{item.reason}"
                  </p>
                )}

                {/* METADATA */}
                <div className="text-xs text-theme-muted font-sans flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-theme/60">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-theme-secondary">
                      @{item.author || 'contributor'}
                    </span>
                    <span>·</span>
                    <span className="text-theme-muted">
                      {item.date || 'Historical Record'}
                    </span>
                  </div>

                  {techId && (
                    <span className="font-mono text-[11px] text-theme-muted bg-theme-input px-2 py-0.5 rounded border border-theme">
                      id: {techId}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
