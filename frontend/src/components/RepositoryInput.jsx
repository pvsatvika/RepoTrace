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

  const exampleRepos = [
    {
      id: 'why-the-code-is-like-this',
      name: 'why-the-code-is-like-this',
      desc: 'Explore the thinking behind the code.',
      icon: 'github'
    },
    {
      id: 'facebook/react',
      name: 'facebook/react',
      desc: 'Look at real-world architecture decisions.',
      icon: 'react'
    },
    {
      id: 'microsoft/vscode',
      name: 'microsoft/vscode',
      desc: 'Understand complex codebases.',
      icon: 'code'
    }
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

  const handleSelectExample = (repoName) => {
    setRepository(repoName);
  };

  const onSubmitForm = (e) => {
    e.preventDefault();
    // Sanitize URL if user pasted full GitHub URL
    let cleanRepo = repository.trim();
    if (cleanRepo.startsWith('https://github.com/')) {
      cleanRepo = cleanRepo.replace('https://github.com/', '');
    } else if (cleanRepo.startsWith('http://github.com/')) {
      cleanRepo = cleanRepo.replace('http://github.com/', '');
    }
    // Remove trailing slash
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
        <div className="relative flex flex-col sm:flex-row items-stretch gap-3 bg-theme-card p-2 rounded-2xl border border-theme shadow-xs">
          
          <div className="relative flex-1 flex items-center pl-4 pr-3">
            {/* GITHUB CAT ICON */}
            <svg className="w-5 h-5 text-theme-muted shrink-0 mr-3" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>

            <input
              type="text"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              placeholder="https://github.com/username/repository"
              disabled={ingestLoading || backendUnavailable}
              className="w-full bg-transparent py-3 text-sm sm:text-base font-sans text-theme-primary placeholder:text-theme-muted focus:outline-none transition-all duration-200 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={ingestLoading || !repository.trim() || backendUnavailable}
            className="gradient-accent-bg gradient-accent-bg-hover text-white font-sans text-sm font-bold px-6 py-3.5 rounded-xl transition-all duration-200 cursor-pointer shadow-sm disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2"
          >
            <span>{ingestLoading ? 'Analyzing...' : 'Analyze Repository'}</span>
            <span className="text-base">→</span>
          </button>
        </div>
      </form>

      {/* EXAMPLE REPOSITORIES SECTION */}
      <div className="space-y-3 pt-1">
        <div className="text-xs font-mono text-theme-muted flex items-center gap-1.5 uppercase tracking-wider">
          <span className="text-[var(--accent-blue)]">+</span> Example repositories
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {exampleRepos.map((repo) => (
            <button
              key={repo.id}
              onClick={() => handleSelectExample(repo.name)}
              className="p-4 rounded-xl bg-theme-card border border-theme hover:border-[var(--accent-blue)] transition-all duration-200 text-left group cursor-pointer flex items-center justify-between gap-3 shadow-xs hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-[var(--badge-bg)] border border-[var(--badge-border)] flex items-center justify-center text-[var(--accent-blue)] shrink-0">
                  {repo.icon === 'github' && (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                  )}
                  {repo.icon === 'react' && (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="2" fill="currentColor" />
                      <ellipse cx="12" cy="12" rx="9" ry="3.5" />
                      <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)" />
                      <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)" />
                    </svg>
                  )}
                  {repo.icon === 'code' && (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                  )}
                </div>

                <div className="overflow-hidden">
                  <div className="font-mono text-xs font-bold text-theme-primary group-hover:text-[var(--accent-blue)] transition-colors truncate">
                    {repo.name}
                  </div>
                  <div className="text-[11px] text-theme-secondary truncate">
                    {repo.desc}
                  </div>
                </div>
              </div>

              <span className="text-xs text-theme-muted group-hover:text-[var(--accent-blue)] transition-colors shrink-0">
                ↗
              </span>
            </button>
          ))}
        </div>
      </div>

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
                      ? 'gradient-accent-bg text-white font-bold animate-pulse'
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
