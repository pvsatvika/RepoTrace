import React, { useState, useEffect } from 'react';
import axios from 'axios';

import Header from './components/Header';
import RepositoryInput from './components/RepositoryInput';
import WorkspaceHeader from './components/WorkspaceHeader';
import QuestionPanel from './components/QuestionPanel';
import AnswerPanel from './components/AnswerPanel';
import DecisionChain from './components/DecisionChain';
import EvidencePanel from './components/EvidencePanel';
import WhyThisAnswer from './components/WhyThisAnswer';
import HistoryTimeline from './components/HistoryTimeline';

export default function App() {
  // Theme State ('dark' | 'light')
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark';
  });

  // Navigation State ('explore' | 'ask-why' | 'history' | 'how-it-works' | 'contact')
  const [activeSection, setActiveSection] = useState('explore');
  const [contactModalOpen, setContactModalOpen] = useState(false);

  // Backend & Service Health State
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [backendUnavailable, setBackendUnavailable] = useState(false);

  // Ingestion State
  const [repository, setRepository] = useState('');
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState(null);
  const [ingestError, setIngestError] = useState(null);
  const [activeRepoStats, setActiveRepoStats] = useState(null);

  // Query State
  const [question, setQuestion] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);

  // Interactive Evidence Filter State
  const [evidenceFilter, setEvidenceFilter] = useState('all');

  // Derived Repo & Stats State
  const hasAnalyzedRepo = Boolean(ingestSuccess || activeRepoStats);
  const currentRepoName = ingestSuccess?.repository || repository || 'Active Repository';
  const currentStats = activeRepoStats || ingestSuccess?.stats;

  // Sync theme class to document element
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Check Health on Mount via Vite Proxy (/api/health)
  useEffect(() => {
    checkHealth();
  }, []);

  // Section Routing & Hash Sync
  useEffect(() => {
    const validSections = ['explore', 'ask-why', 'history', 'how-it-works'];
    const syncHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (validSections.includes(hash)) {
        setActiveSection(hash);
        setTimeout(() => {
          const el = document.getElementById(hash);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 80);
      }
    };

    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  // IntersectionObserver to update active navigation tab as user scrolls
  useEffect(() => {
    const sections = ['explore', 'ask-why', 'history', 'how-it-works'];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.2) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: [0.2] }
    );

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const navigateToSection = (sectionId) => {
    if (sectionId === 'contact') {
      setContactModalOpen(true);
      return;
    }
    setActiveSection(sectionId);
    window.location.hash = sectionId;
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const checkHealth = async () => {
    setHealthLoading(true);
    setBackendUnavailable(false);
    try {
      const res = await axios.get('/api/health');
      setHealth(res.data);
    } catch (err) {
      console.error('Health check failed:', err);
      setBackendUnavailable(true);
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  // Handle Repository Ingestion (POST /api/ingest)
  const handleIngest = async (e) => {
    e?.preventDefault();
    if (!repository.trim()) return;

    setIngestLoading(true);
    setIngestError(null);
    setIngestSuccess(null);
    setActiveRepoStats(null);
    setQueryResult(null);
    setQueryError(null);

    try {
      const res = await axios.post('/api/ingest', { repository: repository.trim() });
      setIngestSuccess(res.data);
      if (res.data.stats) {
        setActiveRepoStats(res.data.stats);
      }
    } catch (err) {
      console.error('Ingestion error:', err);
      const status = err.response?.status;
      const data = err.response?.data;

      if (!err.response) {
        setIngestError('Backend server unavailable. Please check Node backend server connection.');
      } else if (status === 404 || data?.errorType === 'REPO_NOT_FOUND') {
        setIngestError(`Repository '${repository}' was not found on GitHub or is private.`);
      } else if (status === 401 || data?.errorType === 'GITHUB_UNAUTHORIZED') {
        setIngestError('GitHub API authentication failed. Check GITHUB_TOKEN in .env file.');
      } else if (status === 403 || data?.errorType === 'GITHUB_RATE_LIMIT') {
        setIngestError('GitHub API rate limit reached. Ensure GITHUB_TOKEN is configured in backend.');
      } else {
        setIngestError(data?.message || err.message || 'GitHub repository ingestion failed.');
      }
    } finally {
      setIngestLoading(false);
    }
  };

  // Handle Question Query (POST /api/query)
  const handleQuery = async (e) => {
    e?.preventDefault();
    if (!question.trim()) return;

    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    setEvidenceFilter('all');

    try {
      const res = await axios.post('/api/query', {
        question: question.trim(),
        repository: repository.trim()
      });
      setQueryResult(res.data);
    } catch (err) {
      console.error('Query execution error:', err);
      if (!err.response) {
        setQueryError('Backend server unavailable. Please check backend connection.');
      } else {
        setQueryError(err.response?.data?.message || err.message || 'Query execution failed.');
      }
    } finally {
      setQueryLoading(false);
    }
  };

  const handleReset = () => {
    setQueryResult(null);
    setQueryError(null);
  };

  return (
    <div className="min-h-screen bg-theme-main text-theme-primary font-sans selection:bg-[var(--accent-blue)]/30 transition-colors duration-200">
      
      {/* HEADER */}
      <Header
        repository={repository}
        health={health}
        healthLoading={healthLoading}
        backendUnavailable={backendUnavailable}
        onReset={queryResult ? handleReset : null}
        activeSection={activeSection}
        onNavigate={navigateToSection}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenContact={() => setContactModalOpen(true)}
      />

      {/* DESKTOP-FIRST WORKSPACE CONTAINER (MAX-WIDTH: 1360PX) */}
      <main className="max-w-[1360px] mx-auto px-6 sm:px-10 py-6 space-y-12 sm:space-y-16">
        
        {/* 1. EXPLORE / HERO SECTION */}
        <section id="explore" className="scroll-mt-24 py-4 sm:py-6 space-y-10 border-b border-theme">
          
          {/* HERO LAYOUT: 2-COLUMN ON DESKTOP */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
            
            {/* HERO TEXT COLUMN (7 COLS) */}
            <div className="lg:col-span-7 space-y-5">
              
              {/* TAGLINE PILL */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--badge-bg)] border border-[var(--badge-border)] text-[var(--accent-blue)] font-mono text-xs font-semibold">
                Understand · Learn · Build Better
              </div>

              {/* GIANT HEADLINE */}
              <h1 className="text-4xl sm:text-6xl lg:text-[68px] font-extrabold text-theme-primary tracking-tight leading-[1.05]">
                WHY THE CODE<br />
                IS LIKE <span className="gradient-accent-text">THIS</span>
              </h1>

              {/* SUBTITLE */}
              <p className="text-lg sm:text-xl font-bold text-[var(--accent-blue)] font-sans">
                Understand the decisions behind the code.
              </p>

              {/* DESCRIPTION */}
              <p className="text-sm sm:text-base text-theme-secondary font-sans leading-relaxed max-w-2xl">
                Connect a public GitHub repository and uncover the historical decisions, commits, PR discussions, and architecture to see why the code is the way it is.
              </p>
            </div>

            {/* HERO ILLUSTRATION COLUMN (5 COLS) */}
            <div className="lg:col-span-5 relative">
              {/* AMBIENT GLOW BACKDROP */}
              <div className="absolute -inset-4 bg-gradient-to-r from-[var(--accent-blue)]/20 to-[var(--accent-purple)]/20 rounded-3xl blur-2xl opacity-60 pointer-events-none" />

              {/* CODE EDITOR WINDOW MOCKUP */}
              <div className="relative bg-theme-card border border-theme rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                
                {/* WINDOW TITLE BAR */}
                <div className="flex items-center justify-between border-b border-theme pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <div className="text-[11px] font-mono text-theme-muted">
                    architecture.ts — why-the-code
                  </div>
                </div>

                {/* CODE LINES REPRESENTATION */}
                <div className="space-y-2.5 font-mono text-xs py-2">
                  <div className="flex items-center gap-3 text-theme-muted">
                    <span className="w-4 text-right text-theme-muted/50 select-none">1</span>
                    <span className="text-[var(--accent-purple)] font-bold">async function</span>
                    <span className="text-[var(--accent-blue)] font-bold">queryGraphRAG</span>
                    <span className="text-theme-primary">(question) &#123;</span>
                  </div>

                  <div className="flex items-center gap-3 text-theme-muted pl-4">
                    <span className="w-4 text-right text-theme-muted/50 select-none">2</span>
                    <span className="text-theme-secondary">// Trace historical commits & rationale</span>
                  </div>

                  <div className="flex items-center gap-3 text-theme-muted pl-4">
                    <span className="w-4 text-right text-theme-muted/50 select-none">3</span>
                    <span className="text-[var(--accent-purple)]">const</span>
                    <span className="text-theme-primary">evidence = </span>
                    <span className="text-[var(--accent-purple)]">await</span>
                    <span className="text-[var(--accent-blue)]">neo4j.traverse</span>
                    <span className="text-theme-primary">();</span>
                  </div>

                  <div className="flex items-center gap-3 text-theme-muted pl-4">
                    <span className="w-4 text-right text-theme-muted/50 select-none">4</span>
                    <span className="text-[var(--accent-purple)]">const</span>
                    <span className="text-theme-primary">explanation = </span>
                    <span className="text-[var(--accent-purple)]">await</span>
                    <span className="text-[var(--accent-blue)] font-bold">sarvam.synthesize</span>
                    <span className="text-theme-primary">(evidence);</span>
                  </div>

                  <div className="flex items-center gap-3 text-theme-muted pl-4">
                    <span className="w-4 text-right text-theme-muted/50 select-none">5</span>
                    <span className="text-[var(--accent-purple)]">return</span>
                    <span className="text-emerald-500 font-semibold">explanation;</span>
                  </div>

                  <div className="flex items-center gap-3 text-theme-muted">
                    <span className="w-4 text-right text-theme-muted/50 select-none">6</span>
                    <span className="text-theme-primary">&#125;</span>
                  </div>
                </div>

                {/* OVERLAPPING FLOATING CODE BADGE */}
                <div className="absolute -bottom-4 -right-4 gradient-accent-bg text-white font-mono font-bold text-base px-4 py-2.5 rounded-xl shadow-lg border border-white/20 flex items-center gap-2">
                  <span>&lt;/&gt;</span>
                </div>

              </div>
            </div>

          </div>

          {/* REPOSITORY INGESTION INTERACTION */}
          <RepositoryInput
            repository={repository}
            setRepository={setRepository}
            handleIngest={handleIngest}
            ingestLoading={ingestLoading}
            ingestSuccess={ingestSuccess}
            ingestError={ingestError}
            backendUnavailable={backendUnavailable}
          />

          {/* ACTIVE REPOSITORY CONTEXT BANNER */}
          {ingestSuccess && (
            <WorkspaceHeader
              repository={ingestSuccess.repository || repository}
              stats={activeRepoStats || ingestSuccess.stats}
            />
          )}

        </section>


        {/* 2. ASK WHY SECTION */}
        <section id="ask-why" className="scroll-mt-24 py-8 space-y-8 border-b border-theme">
          
          {/* ASK WHY QUERY COMMAND INTERFACE */}
          <QuestionPanel
            question={question}
            setQuestion={setQuestion}
            handleQuery={handleQuery}
            queryLoading={queryLoading}
            queryError={queryError}
            backendUnavailable={backendUnavailable}
          />

          {/* QUERY RESULT CANVAS */}
          {queryResult ? (
            <div className="space-y-10 pt-4 border-t border-theme">
              
              {/* HORIZONTAL GRAPH REASONING TRAIL */}
              <DecisionChain
                question={question}
                evidence={queryResult.evidence}
                selectedType={evidenceFilter}
                onSelectType={(type) => setEvidenceFilter(type)}
              />

              {/* TWO-COLUMN RESULTS CANVAS: MAIN ANSWER (LEFT) & SUPPORTING EVIDENCE (RIGHT) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                
                {/* MAIN WHY ANSWER CANVAS (7 COLS ON DESKTOP) */}
                <div className="lg:col-span-7 space-y-8">
                  <AnswerPanel queryResult={queryResult} />

                  <WhyThisAnswer
                    evidenceCount={queryResult.evidence?.length || 0}
                    confidence={queryResult.confidence}
                  />
                </div>

                {/* SUPPORTING EVIDENCE FOR THIS QUESTION (5 COLS ON DESKTOP) */}
                <div className="lg:col-span-5 space-y-8">
                  <EvidencePanel
                    evidence={queryResult.evidence}
                    activeFilter={evidenceFilter}
                    setActiveFilter={(type) => setEvidenceFilter(type)}
                  />
                </div>

              </div>

            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-theme-card border border-theme text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--badge-bg)] text-[var(--accent-blue)] font-mono text-xl font-bold border border-[var(--badge-border)]">
                ?
              </div>
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-bold text-theme-primary font-sans">
                  Ready to query {repository || 'a repository'}?
                </h3>
                <p className="text-xs sm:text-sm text-theme-secondary font-sans max-w-lg mx-auto">
                  Type any natural language question to trace historical commit rationale and architectural decisions.
                </p>
              </div>
            </div>
          )}
        </section>


        {/* 3. HISTORY SECTION */}
        <section id="history" className="scroll-mt-24 py-8 space-y-8 border-b border-theme">
          
          <div className="space-y-1.5">
            <div className="text-xs font-mono font-bold text-[var(--accent-blue)] uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Repository History
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-theme-primary tracking-tight">
              Repository History
            </h2>
            <p className="text-xs sm:text-sm text-theme-secondary font-sans">
              Explore commits, PRs, and discussions to see the full story.
            </p>
          </div>

          {ingestLoading ? (
            /* STATE B: ANALYZING REPOSITORY */
            <div className="p-12 rounded-2xl bg-theme-card border border-theme text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--badge-bg)] text-[var(--accent-blue)] font-mono text-xl font-bold animate-pulse border border-[var(--badge-border)]">
                ⏳
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-theme-primary font-sans animate-pulse">
                  ANALYZING REPOSITORY...
                </h3>
                <p className="text-xs text-theme-secondary font-sans max-w-lg mx-auto">
                  Ingesting commits, pull requests, and issue discussions into Neo4j graph nodes for <span className="font-mono text-[var(--accent-blue)] font-bold">{repository}</span>.
                </p>
              </div>
            </div>
          ) : !hasAnalyzedRepo ? (
            /* STATE A: RESTRAINED EMPTY STATE (MATCHING REFERENCE UI) */
            <div className="p-12 rounded-2xl bg-theme-card border border-theme text-center space-y-4 shadow-xs">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--badge-bg)] text-[var(--accent-blue)] border border-[var(--badge-border)]">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              </div>

              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-theme-primary font-sans">
                  Connect a repository to explore its history.
                </h3>
                <p className="text-xs sm:text-sm text-theme-secondary font-sans leading-relaxed">
                  View commits, pull requests, discussions and more — all in one place.
                </p>
              </div>
            </div>
          ) : (
            /* STATE C: REPOSITORY ANALYZED STATS & TIMELINE */
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-theme-card border border-theme space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-4">
                  <div>
                    <span className="text-xs font-mono text-[var(--accent-blue)] font-bold uppercase">
                      GRAPH-INDEXED EVOLUTION NODES
                    </span>
                    <h3 className="text-xl font-extrabold text-theme-primary font-sans mt-0.5">
                      Historical Context Nodes for {currentRepoName}
                    </h3>
                  </div>

                  <button
                    onClick={() => navigateToSection('ask-why')}
                    className="gradient-accent-bg text-white font-mono text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-xs hover:-translate-y-0.5"
                  >
                    QUERY REPOSITORY HISTORY →
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-theme-input border border-theme">
                    <div className="text-xs font-mono text-theme-muted uppercase">Git Commits</div>
                    <div className="text-2xl font-extrabold text-[var(--accent-blue)] font-mono mt-1">
                      {currentStats?.nodes?.commit ?? currentStats?.commits ?? 0}
                    </div>
                    <div className="text-[11px] text-theme-muted font-sans mt-1">Sha, author & timestamp</div>
                  </div>

                  <div className="p-4 rounded-xl bg-theme-input border border-theme">
                    <div className="text-xs font-mono text-theme-muted uppercase">Pull Requests</div>
                    <div className="text-2xl font-extrabold text-[var(--accent-purple)] font-mono mt-1">
                      {currentStats?.nodes?.pull_request ?? currentStats?.pullRequests ?? 0}
                    </div>
                    <div className="text-[11px] text-theme-muted font-sans mt-1">Reviewer discussions & PR logs</div>
                  </div>

                  <div className="p-4 rounded-xl bg-theme-input border border-theme">
                    <div className="text-xs font-mono text-theme-muted uppercase">Issues & Incidents</div>
                    <div className="text-2xl font-extrabold text-[var(--accent-blue)] font-mono mt-1">
                      {currentStats?.nodes?.issue ?? currentStats?.issues ?? 0}
                    </div>
                    <div className="text-[11px] text-theme-muted font-sans mt-1">Bug reports & workarounds</div>
                  </div>

                  <div className="p-4 rounded-xl bg-theme-input border border-theme">
                    <div className="text-xs font-mono text-theme-muted uppercase">Decision Nodes</div>
                    <div className="text-2xl font-extrabold text-[var(--accent-purple)] font-mono mt-1">
                      {currentStats?.nodes?.decision ?? 0}
                    </div>
                    <div className="text-[11px] text-theme-muted font-sans mt-1">Refactor rationale nodes</div>
                  </div>
                </div>
              </div>

              {/* TIMELINE */}
              {queryResult?.evidence && queryResult.evidence.length > 0 ? (
                <div className="p-6 rounded-2xl bg-theme-card border border-theme">
                  <HistoryTimeline evidence={queryResult.evidence} />
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-theme-card border border-theme text-center space-y-2">
                  <div className="text-theme-secondary font-sans text-xs">
                    Chronological evidence timeline for <span className="font-mono text-[var(--accent-blue)]">{currentRepoName}</span> will be generated when a query is executed.
                  </div>
                </div>
              )}
            </div>
          )}
        </section>


        {/* 4. HOW IT WORKS SECTION (MATCHING REFERENCE UI) */}
        <section id="how-it-works" className="scroll-mt-24 py-8 space-y-8">
          
          {/* SECTION HEADER */}
          <div className="space-y-1.5">
            <div className="text-xs font-mono font-bold text-[var(--accent-blue)] uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18h6m-5 3h4m-7-6a7 7 0 1 1 12 0c0 2.5-1.5 4-3 5.5s-2 2.5-2 4.5H10c0-2-.5-3-2-4.5S6 14.5 6 12a7 7 0 0 1 3-6" />
              </svg>
              How Why The Code Is Like This Works
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-theme-primary tracking-tight">
              How Why The Code Is Like This Works
            </h2>
            <p className="text-xs sm:text-sm text-theme-secondary font-sans">
              From repository to answers — in just a few steps
            </p>
          </div>

          {/* 3 STEPS HORIZONTAL LAYOUT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            {[
              {
                num: 1,
                title: 'Connect Repo',
                desc: 'Link a public GitHub repository.'
              },
              {
                num: 2,
                title: 'Analyze',
                desc: 'We read the code, commits and PRs.'
              },
              {
                num: 3,
                title: 'Ask & Learn',
                desc: 'Get clear, contextual explanations.'
              }
            ].map((step, idx) => (
              <div
                key={step.num}
                className="p-6 rounded-2xl bg-theme-card border border-theme flex items-center gap-4 relative group hover:border-[var(--accent-blue)] transition-all duration-200 shadow-xs"
              >
                {/* NUMBERED CIRCLE */}
                <div className="w-10 h-10 rounded-full gradient-accent-bg text-white font-mono font-bold flex items-center justify-center text-sm shrink-0 shadow-xs">
                  {step.num}
                </div>

                {/* CONTENT */}
                <div className="space-y-0.5 flex-1 min-w-0">
                  <h3 className="font-bold text-theme-primary text-base font-sans">
                    {step.title}
                  </h3>
                  <p className="text-xs text-theme-secondary font-sans truncate">
                    {step.desc}
                  </p>
                </div>

                {/* DIRECTIONAL ARROW (IF NOT LAST) */}
                {idx < 2 && (
                  <span className="hidden md:block text-theme-muted text-sm font-bold pl-2">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>

        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-theme py-8 text-center text-xs text-theme-muted font-mono">
        WhyTheCodeIsLikeThis :: Graph-Grounded Code Archaeology Engine
      </footer>

      {/* CONTACT MODAL */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-theme-card border border-theme rounded-2xl p-6 sm:p-8 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-theme-primary font-sans">Contact & Support</h3>
              <button
                onClick={() => setContactModalOpen(false)}
                className="text-theme-muted hover:text-theme-primary text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-theme-secondary font-sans leading-relaxed">
              WhyTheCodeIsLikeThis is a developer-tool designed to trace repository decision rationale using Neo4j GraphRAG and Sarvam AI synthesis.
            </p>

            <div className="space-y-2 font-mono text-xs text-theme-primary pt-2 border-t border-theme">
              <div className="flex items-center justify-between">
                <span className="text-theme-muted">GitHub Repository:</span>
                <a href="https://github.com/pvsatvika/why-the-code-is-like-this" target="_blank" rel="noreferrer" className="text-[var(--accent-blue)] hover:underline">
                  pvsatvika/why-the-code-is-like-this
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-theme-muted">Engine:</span>
                <span>GraphRAG + Sarvam AI</span>
              </div>
            </div>

            <div className="pt-3">
              <button
                onClick={() => setContactModalOpen(false)}
                className="w-full gradient-accent-bg text-white font-sans text-xs font-bold py-2.5 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
