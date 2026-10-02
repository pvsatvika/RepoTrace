import React from 'react';

export default function WhyThisAnswer({ evidenceCount = 0, confidence = 'supported' }) {
  const isSupported = confidence === 'supported';

  const pipelineStages = [
    { num: '01', title: 'HISTORY', desc: `${evidenceCount} records parsed` },
    { num: '02', title: 'DATABASE', desc: 'Neo4j Commit Graph' },
    { num: '03', title: 'RATIONALE', desc: 'Decision Chain' },
    { num: '04', title: 'MODEL', desc: 'Sarvam AI Model' },
    { num: '05', title: 'OUTPUT', desc: 'Grounded Answer' }
  ];

  return (
    <div className="bg-theme-card border border-theme rounded-2xl p-5 sm:p-6 space-y-3 font-mono text-xs shadow-xs">
      <div className="flex items-center justify-between text-theme-muted">
        <span className="font-bold uppercase tracking-wider text-[var(--accent-purple)]">PIPELINE PROVENANCE</span>
        <span className={isSupported ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
          {isSupported ? 'VERIFIED GROUNDED ANSWER' : 'LIMITED GRAPH CONTEXT'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs text-theme-primary">
        {pipelineStages.map(stg => (
          <div key={stg.num} className="p-2.5 border border-theme rounded-xl bg-theme-input space-y-0.5">
            <span className="text-theme-muted font-bold block text-[10px]">{stg.num} {stg.title}</span>
            <span className="font-semibold text-theme-primary">{stg.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
