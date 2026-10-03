import React, { useState, useEffect } from 'react';

export default function RepositoryInput({
  repository,
  setRepository,
  handleIngest,
  ingestLoading,
  ingestSuccess,
  ingestError,
  backendUnavailable
}) {
  const [activeStage, setActiveStage] = useState(0);

  const stages = [
    { key: 'CONNECT', label: '01 CONNECT' },
    { key: 'FETCH', label: '02 FETCH' },
    { key: 'PARSE', label: '03 PARSE' },
    { key: 'INDEX', label: '04 INDEX' },
    { key: 'BUILD GRAPH', label: '05 BUILD GRAPH' },
    { key: 'READY', label: '06 READY' }
  ];

  useEffect(() => {
    let timer;
    if (ingestLoading) {
      setActiveStage(1);
      timer = setInterval(() => {
        setActiveStage(prev => (prev < 4 ? prev + 1 : prev));
      }, 700);
    } else if (ingestSuccess) {
      setActiveStage(5);
    } else {
      setActiveStage(0);
    }
    return () => clearInterval(timer);
  }, [ingestLoading, ingestSuccess]);

  const onSubmitForm = (e) => {
    e.preventDefault();
    // Sanitize URL if user pasted full GitHub URL
    let cleanRepo = repository.trim();
    if (cleanRepo.startsWith('https://github.com/')) {
      cleanRepo = cleanRepo.replace('https://github.com/', '');
    } else if (cleanRepo.startsWith('http://github.com/')) {
      cleanRepo = cleanRepo.replace('http://github.com/', '');
    }
    cleanRepo = cleanRepo.replace(/\/$/, '');
    
    if (cleanRepo !== repository) {
      setRepository(cleanRepo);
    }
    
    handleIngest(e);
  };

  return (
    <div className="py-6 space-y-8" id="repository-section">
      
      {/* HEADING & SUBTITLE */}
      <div className="space-y-1.5">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-theme-primary tracking-tight">
          Start with a repository.
        </h2>
        <p className="text-sm sm:text-base text-theme-secondary font-sans">
          Connect a public GitHub repository and automatically build the history behind its code.
        </p>
      </div>

      {/* REPOSITORY INPUT BAR */}
      <form onSubmit={onSubmitForm} className="space-y-4">
        <div className="relative flex flex-col sm:flex-row items-stretch gap-3 bg-theme-card p-2 rounded-2xl border border-theme shadow-theme-sm">
          
          <div className="relative flex-1 flex items-center pl-4 pr-3">
            {/* GITHUB CAT ICON */}
            <svg className="w-5 h-5 text-theme-muted shrink-0 mr-3" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>

            <input
              type="text"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              placeholder="Enter a GitHub repository URL"
              disabled={ingestLoading || backendUnavailable}
              className="w-full bg-transparent py-3 text-sm sm:text-base font-sans text-theme-primary placeholder:text-[var(--placeholder-color)] focus:outline-none transition-all duration-200 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={ingestLoading || !repository.trim() || backendUnavailable}
            className="bg-[var(--accent-blue)] text-[var(--accent-foreground)] font-sans text-sm font-bold px-6 py-3.5 rounded-xl transition-all duration-200 cursor-pointer shadow-theme-sm disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2"
          >
            <span>{ingestLoading ? 'Analyzing...' : 'Analyze Repository'}</span>
            <span className="text-base">→</span>
          </button>
        </div>
      </form>

      {/* PIPELINE PROGRESS */}
      {(ingestLoading || ingestSuccess) && (
        <div className="p-4 rounded-xl bg-theme-card border border-theme space-y-3">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-theme-secondary font-bold">GRAPH PIPELINE PROGRESS</span>
            <span className="text-[var(--accent-blue)] font-bold">{stages[activeStage]?.key}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 font-mono text-xs">
            {stages.map((stg, idx) => {
              const isCompleted = idx < activeStage || (idx === activeStage && ingestSuccess);
              const isActive = idx === activeStage && ingestLoading;

              return (
                <div
                  key={stg.key}
                  className={`px-2.5 py-1.5 rounded-lg border text-center transition-all duration-200 text-[11px] ${
                    isCompleted
                      ? 'bg-[var(--badge-bg)] border-[var(--accent-blue)] text-[var(--accent-blue)] font-bold'
                      : isActive
                      ? 'bg-[var(--accent-blue)] text-[var(--accent-foreground)] font-bold animate-pulse'
                      : 'bg-theme-main border-theme text-theme-muted'
                  }`}
                >
                  {stg.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* INGEST ERROR */}
      {ingestError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-xs font-mono text-rose-500 rounded-xl">
          {ingestError}
        </div>
      )}

    </div>
  );
}
