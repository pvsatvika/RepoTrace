import React from 'react';

export default function WorkspaceHeader({ repository, stats }) {
  if (!repository) return null;

  return (
    <div className="bg-theme-card border border-theme rounded-xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono shadow-xs">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-blue)] shadow-[0_0_8px_var(--accent-blue)]" />
        <span className="text-theme-muted">ACTIVE REPOSITORY CONTEXT:</span>
        <span className="font-bold text-theme-primary text-sm">{repository}</span>
      </div>

      <div className="flex items-center gap-5 text-theme-secondary">
        {stats?.commits !== undefined && (
          <span><strong className="text-theme-primary text-xs">{stats.commits}</strong> COMMITS</span>
        )}
        {stats?.pullRequests !== undefined && (
          <span><strong className="text-theme-primary text-xs">{stats.pullRequests}</strong> PRS</span>
        )}
        {stats?.issues !== undefined && (
          <span><strong className="text-theme-primary text-xs">{stats.issues}</strong> ISSUES</span>
        )}
        <span className="text-[var(--accent-blue)] font-bold bg-[var(--badge-bg)] border border-[var(--badge-border)] px-2.5 py-1 rounded-md">
          NEO4J GRAPH READY
        </span>
      </div>
    </div>
  );
}
