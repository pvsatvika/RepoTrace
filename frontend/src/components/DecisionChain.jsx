import React from 'react';

export default function DecisionChain({ question, evidence = [], selectedType = 'all', onSelectType }) {
  if (!evidence || evidence.length === 0) return null;

  const chainNodes = [
    { key: 'all', label: 'QUESTION', count: 1, desc: 'Query Lead' },
    { key: 'code_entity', label: 'CODE CHANGE', count: evidence.filter(e => e.type === 'file' || e.type === 'code_entity').length || 1, desc: 'Target File' },
    { key: 'commit', label: 'COMMIT', count: evidence.filter(e => e.type === 'commit').length, desc: 'Git Commit' },
    { key: 'pull_request', label: 'PULL REQUEST', count: evidence.filter(e => e.type === 'pull_request').length, desc: 'PR Review' },
    { key: 'discussion', label: 'DISCUSSION', count: evidence.filter(e => e.type === 'discussion' || e.type === 'issue').length, desc: 'Debate' },
    { key: 'decision', label: 'DECISION', count: evidence.filter(e => e.type === 'decision' || e.type === 'incident').length, desc: 'Rationale' }
  ];

  return (
    <div className="py-4 space-y-3">
      
      {/* HEADER */}
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-[var(--accent-purple)] font-bold uppercase tracking-wider">
          HISTORICAL TRACEABILITY TRAIL
        </span>
        <span className="text-theme-muted text-xs">Click node to filter evidence</span>
      </div>

      {/* HORIZONTAL CONNECTED RESEARCH GRAPH TRAIL */}
      <div className="relative py-2">
        {/* THIN CONNECTING LINE */}
        <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-theme -translate-y-1/2 z-0 hidden md:block" />

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 relative z-10 font-mono text-xs">
          {chainNodes.map((node, idx) => {
            const isSelected = selectedType === node.key || (selectedType === 'all' && node.key === 'all');
            const hasData = node.count > 0;

            return (
              <button
                key={node.key}
                type="button"
                onClick={() => onSelectType && onSelectType(node.key)}
                className={`p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'gradient-accent-bg text-white border-transparent shadow-md -translate-y-0.5 font-bold'
                    : hasData
                    ? 'bg-theme-card text-theme-secondary border-theme hover:text-theme-primary hover:border-[var(--accent-blue)]'
                    : 'bg-theme-card/50 text-theme-muted border-theme/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className={isSelected ? 'text-white' : 'text-theme-muted'}>
                    0{idx + 1}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-theme-input text-theme-muted'
                  }`}>
                    {node.count}
                  </span>
                </div>

                <div className="font-bold text-xs uppercase tracking-wide truncate mt-1">
                  {node.label}
                </div>

                <div className={`text-[11px] font-sans truncate mt-0.5 ${
                  isSelected ? 'text-white/90' : 'text-theme-muted'
                }`}>
                  {node.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
