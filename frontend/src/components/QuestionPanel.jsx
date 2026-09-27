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
    <div className="py-8 space-y-6 border-b border-[#1f2430]" id="query-section">
      
      {/* SECTION HEADING & SUPPORTING TEXT */}
      <div className="space-y-2">
        <div className="text-xs font-mono font-bold text-[#06b6d4] uppercase tracking-wider">
          GraphRAG Query Interface
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-[#f8fafc] tracking-tight">
          ASK WHY
        </h2>
        <p className="text-base text-[#9ca3af] font-sans">
          What do you want to understand about this code?
        </p>
      </div>

      {/* LARGE QUESTION INPUT FORM */}
      <form onSubmit={handleQuery} className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question..."
            disabled={queryLoading || backendUnavailable}
            className="flex-1 bg-[#0d0e14] border border-[#1f2430] rounded-xl px-6 py-5 text-base font-sans text-[#f8fafc] placeholder-[#6b7280] focus:outline-none focus:border-[#8b5cf6] focus:ring-1 focus:ring-[#8b5cf6] transition-all duration-200 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={queryLoading || !question.trim() || backendUnavailable}
            className="bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-50 text-[#f8fafc] font-mono text-sm font-bold px-9 py-5 rounded-xl transition-all duration-200 cursor-pointer shadow-lg shadow-[#8b5cf6]/25 whitespace-nowrap hover:-translate-y-0.5"
          >
            {queryLoading ? 'TRACING GRAPH...' : 'ASK WHY'}
          </button>
        </div>
      </form>

      {/* QUERY ERROR */}
      {queryError && (
        <div className="p-4 bg-[#ef4444]/10 border border-[#ef4444]/40 text-xs font-mono text-[#ef4444] rounded-xl">
          {queryError}
        </div>
      )}

    </div>
  );
}
