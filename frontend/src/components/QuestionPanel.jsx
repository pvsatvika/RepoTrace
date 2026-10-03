import React from 'react';

export default function QuestionPanel({
  question,
  setQuestion,
  handleQuery,
  queryLoading,
  queryError,
  backendUnavailable
}) {
  return (
    <div className="py-6 space-y-6" id="query-section">
      
      {/* LABEL & HEADING */}
      <div className="space-y-1.5">
        <div className="text-xs font-mono font-bold text-[var(--accent-blue)] uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-[var(--accent-blue)] rounded-full" /> ASK WHY
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-theme-primary tracking-tight">
          What do you want to know?
        </h2>
        <p className="text-sm sm:text-base text-theme-secondary font-sans">
          Ask a question about the repository and get clear, contextual answers.
        </p>
      </div>

      {/* QUESTION INPUT BAR */}
      <form onSubmit={handleQuery} className="space-y-4">
        <div className="relative flex flex-col sm:flex-row items-stretch gap-3 bg-theme-card p-2.5 rounded-2xl border border-theme shadow-theme-sm transition-all duration-200">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about this repository..."
            disabled={queryLoading || backendUnavailable}
            className="flex-1 bg-transparent px-4 py-3.5 text-sm sm:text-base font-sans text-theme-primary placeholder:text-theme-muted focus:outline-none transition-all duration-200 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={queryLoading || !question.trim() || backendUnavailable}
            className="gradient-accent-bg gradient-accent-bg-hover text-white font-sans text-sm font-bold px-8 py-3.5 rounded-xl transition-all duration-200 cursor-pointer shadow-theme-sm disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2"
          >
            <span>{queryLoading ? 'Tracing Graph...' : 'Ask'}</span>
            <span className="text-base">↗</span>
          </button>
        </div>
      </form>

      {/* QUERY ERROR */}
      {queryError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-xs font-mono text-rose-500 rounded-xl flex items-center justify-between gap-3">
          <span>{queryError}</span>
        </div>
      )}

    </div>
  );
}
