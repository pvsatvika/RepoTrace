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
  // Navigation State ('explore' | 'ask-why' | 'history' | 'how-it-works')
  const [activeSection, setActiveSection] = useState('explore');

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

  const navigateToSection = (sectionId) => {
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

    // Immediately reset previous repository state and query results
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
    <div className="min-h-screen bg-[#08090d] text-[#f8fafc] font-sans selection:bg-[#8b5cf6]/30 selection:text-white">
      
      {/* HEADER */}
      <Header
        repository={repository}
        health={health}
        healthLoading={healthLoading}
        backendUnavailable={backendUnavailable}
        onReset={queryResult ? handleReset : null}
        activeSection={activeSection}
        onNavigate={navigateToSection}
      />

      {/* DESKTOP-FIRST WORKSPACE CONTAINER (MAX-WIDTH: 1360PX) */}
      <main className="max-w-[1360px] mx-auto px-6 sm:px-10 py-6 space-y-16">
        
        {/* 1. EXPLORE SECTION */}
        <section id="explore" className="scroll-mt-24 py-6 space-y-10 border-b border-[#1f2430]">
          
          {/* HERO SECTION */}
          <div className="space-y-6 max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 text-[#8b5cf6] font-mono text-xs font-semibold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#8b5cf6]" />
              Developer Code Archaeology Engine
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-[76px] font-extrabold text-[#f8fafc] tracking-tight leading-[1.05]">
              WHY THE CODE<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f8fafc] via-[#f8fafc] to-[#06b6d4]">
                IS LIKE THIS
              </span>
            </h1>

            <p className="text-xl sm:text-2xl font-bold text-[#06b6d4] font-mono">
              Understand the decisions behind the code.
            </p>

            <p className="text-base sm:text-lg text-[#9ca3af] font-sans leading-relaxed max-w-3xl">
              Connect a public GitHub repository and reconstruct the historical decisions, commits, PR discussions, and architectural trade-offs behind any line of code.
            </p>
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

          {/* QUICK SECTION LINKING CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <button
              onClick={() => navigateToSection('ask-why')}
              className="p-5 rounded-xl bg-[#12141d]/70 border border-[#1f2430] hover:border-[#8b5cf6] text-left transition-all duration-200 group cursor-pointer"
            >
              <div className="text-xs font-mono text-[#8b5cf6] font-bold uppercase mb-1">
                STEP 1 · ASK QUESTIONS
              </div>
              <div className="text-base font-bold text-[#f8fafc] group-hover:text-[#8b5cf6] transition-colors">
                Ask Why Interface →
              </div>
              <p className="text-xs text-[#9ca3af] mt-1">
                Query specific code changes or refactor trade-offs.
              </p>
            </button>

            <button
              onClick={() => navigateToSection('history')}
              className="p-5 rounded-xl bg-[#12141d]/70 border border-[#1f2430] hover:border-[#06b6d4] text-left transition-all duration-200 group cursor-pointer"
            >
              <div className="text-xs font-mono text-[#06b6d4] font-bold uppercase mb-1">
                STEP 2 · REPOSITORY EVIDENCE
              </div>
              <div className="text-base font-bold text-[#f8fafc] group-hover:text-[#06b6d4] transition-colors">
                Historical Evidence Rail →
              </div>
              <p className="text-xs text-[#9ca3af] mt-1">
                Inspect commits, PR discussions, and issue logs.
              </p>
            </button>

            <button
              onClick={() => navigateToSection('how-it-works')}
              className="p-5 rounded-xl bg-[#12141d]/70 border border-[#1f2430] hover:border-[#9ca3af] text-left transition-all duration-200 group cursor-pointer"
            >
              <div className="text-xs font-mono text-[#9ca3af] font-bold uppercase mb-1">
                STEP 3 · ENGINE DETAILS
              </div>
              <div className="text-base font-bold text-[#f8fafc] group-hover:text-[#f8fafc] transition-colors">
                How It Works →
              </div>
              <p className="text-xs text-[#9ca3af] mt-1">
                Learn how GraphRAG and Sarvam AI synthesize reasons.
              </p>
            </button>
          </div>
        </section>


        {/* 2. ASK WHY SECTION */}
        <section id="ask-why" className="scroll-mt-24 py-10 space-y-10 border-b border-[#1f2430]">
          
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
            <div className="space-y-12 pt-6 border-t border-[#1f2430]">
              
              {/* HORIZONTAL GRAPH REASONING TRAIL */}
              <DecisionChain
                question={question}
                evidence={queryResult.evidence}
                selectedType={evidenceFilter}
                onSelectType={(type) => setEvidenceFilter(type)}
              />

              {/* TWO-COLUMN RESULTS CANVAS: MAIN ANSWER (LEFT) & SUPPORTING EVIDENCE (RIGHT) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                
                {/* MAIN WHY ANSWER CANVAS (7 COLS ON DESKTOP) */}
                <div className="lg:col-span-7 space-y-12">
                  <AnswerPanel queryResult={queryResult} />

                  <WhyThisAnswer
                    evidenceCount={queryResult.evidence?.length || 0}
                    confidence={queryResult.confidence}
                  />
                </div>

                {/* SUPPORTING EVIDENCE FOR THIS QUESTION (5 COLS ON DESKTOP) */}
                <div className="lg:col-span-5 space-y-12">
                  <EvidencePanel
                    evidence={queryResult.evidence}
                    activeFilter={evidenceFilter}
                    setActiveFilter={(type) => setEvidenceFilter(type)}
                  />
                </div>

              </div>

            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-[#0d0e14] border border-[#1f2430] text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#8b5cf6]/10 text-[#8b5cf6] font-mono text-xl font-bold">
                ?
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-extrabold text-[#f8fafc] font-sans">
                  Ready to query {repository || 'a repository'}?
                </h3>
                <p className="text-sm text-[#9ca3af] font-sans max-w-lg mx-auto">
                  Type any natural language question to trace historical commit rationale and architectural decisions.
                </p>
              </div>
            </div>
          )}
        </section>


        {/* 3. HISTORY SECTION */}
        <section id="history" className="scroll-mt-24 py-10 space-y-8 border-b border-[#1f2430]">
          
          {ingestLoading ? (
            /* STATE B: ANALYZING REPOSITORY */
            <div className="space-y-8">
              <div className="space-y-2">
                <div className="text-xs font-mono font-bold text-[#06b6d4] uppercase tracking-wider">
                  02 · REPOSITORY HISTORY & TIMELINE
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#f8fafc] tracking-tight">
                  Repository Evolution & History
                </h2>
              </div>

              <div className="p-12 rounded-2xl bg-[#0d0e14] border border-[#1f2430] text-center space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#06b6d4]/10 text-[#06b6d4] font-mono text-xl font-bold animate-pulse">
                  ⏳
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-extrabold text-[#f8fafc] font-sans animate-pulse">
                    ANALYZING REPOSITORY...
                  </h3>
                  <p className="text-sm text-[#9ca3af] font-sans max-w-lg mx-auto">
                    Ingesting commits, pull requests, and issue discussions into Neo4j graph nodes for <span className="font-mono text-[#06b6d4] font-bold">{repository}</span>.
                  </p>
                </div>
              </div>
            </div>
          ) : !hasAnalyzedRepo ? (
            /* STATE A: NO REPOSITORY ANALYZED YET */
            <div className="space-y-8">
              <div className="space-y-2">
                <div className="text-xs font-mono font-bold text-[#06b6d4] uppercase tracking-wider">
                  02 · REPOSITORY HISTORY & TIMELINE
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#f8fafc] tracking-tight">
                  Repository History
                </h2>
              </div>

              <div className="p-12 rounded-2xl bg-[#0d0e14] border border-[#1f2430] text-center space-y-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#06b6d4]/10 text-[#06b6d4] font-mono text-2xl font-bold">
                  02
                </div>
                <div className="space-y-2 max-w-lg mx-auto">
                  <h3 className="text-2xl font-extrabold text-[#f8fafc] font-sans">
                    Analyze a repository to explore its history.
                  </h3>
                  <p className="text-sm text-[#9ca3af] font-sans leading-relaxed">
                    Once a repository is analyzed, its commits, pull requests, issues, discussions, and evolution will appear here.
                  </p>
                </div>
                <div>
                  <button
                    onClick={() => navigateToSection('explore')}
                    className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-mono text-xs font-bold px-6 py-3.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-[#8b5cf6]/20 hover:-translate-y-0.5"
                  >
                    ANALYZE REPOSITORY →
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STATE C: REPOSITORY SUCCESSFULLY ANALYZED */
            <div className="space-y-8">
              {/* SECTION HEADER */}
              <div className="space-y-2">
                <div className="text-xs font-mono font-bold text-[#06b6d4] uppercase tracking-wider">
                  02 · REPOSITORY EVOLUTION & TIMELINE
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#f8fafc] tracking-tight">
                  Repository Evolution & History
                </h2>
                <p className="text-base text-[#9ca3af] font-sans">
                  Chronological sequence of historical commits, pull request reviews, issue discussions, and change rationale for <span className="text-[#06b6d4] font-mono font-bold">{currentRepoName}</span>.
                </p>
              </div>

              {/* REPOSITORY HISTORY WORKSPACE */}
              <div className="space-y-8 pt-2">
                {/* REPOSITORY HISTORY STATS CARD */}
                <div className="p-8 rounded-2xl bg-[#0d0e14] border border-[#1f2430] space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2430] pb-6">
                    <div>
                      <span className="text-xs font-mono text-[#06b6d4] font-bold uppercase">
                        GRAPH-INDEXED EVOLUTION NODES
                      </span>
                      <h3 className="text-2xl font-extrabold text-[#f8fafc] font-sans mt-1">
                        Historical Context Nodes for {currentRepoName}
                      </h3>
                    </div>

                    <button
                      onClick={() => navigateToSection('ask-why')}
                      className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-mono text-xs font-bold px-5 py-3 rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-md shadow-[#8b5cf6]/20 hover:-translate-y-0.5"
                    >
                      QUERY REPOSITORY HISTORY →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-[#12141d] border border-[#1f2430]">
                      <div className="text-xs font-mono text-[#6b7280] uppercase">Git Commits</div>
                      <div className="text-2xl font-extrabold text-[#06b6d4] font-mono mt-1">
                        {currentStats?.nodes?.commit ?? currentStats?.commits ?? 0}
                      </div>
                      <div className="text-[11px] text-[#9ca3af] font-sans mt-1">Sha, author & timestamp</div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#12141d] border border-[#1f2430]">
                      <div className="text-xs font-mono text-[#6b7280] uppercase">Pull Requests</div>
                      <div className="text-2xl font-extrabold text-[#8b5cf6] font-mono mt-1">
                        {currentStats?.nodes?.pull_request ?? currentStats?.pullRequests ?? 0}
                      </div>
                      <div className="text-[11px] text-[#9ca3af] font-sans mt-1">Reviewer discussions & PR logs</div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#12141d] border border-[#1f2430]">
                      <div className="text-xs font-mono text-[#6b7280] uppercase">Issues & Incidents</div>
                      <div className="text-2xl font-extrabold text-[#38bdf8] font-mono mt-1">
                        {currentStats?.nodes?.issue ?? currentStats?.issues ?? 0}
                      </div>
                      <div className="text-[11px] text-[#9ca3af] font-sans mt-1">Bug reports & workarounds</div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#12141d] border border-[#1f2430]">
                      <div className="text-xs font-mono text-[#6b7280] uppercase">Decision Nodes</div>
                      <div className="text-2xl font-extrabold text-[#a78bfa] font-mono mt-1">
                        {currentStats?.nodes?.decision ?? 0}
                      </div>
                      <div className="text-[11px] text-[#9ca3af] font-sans mt-1">Refactor rationale nodes</div>
                    </div>
                  </div>

                  <p className="text-xs text-[#9ca3af] font-sans leading-relaxed pt-2">
                    Neo4j graph nodes map every file change back to its originating GitHub commit and pull request. When you ask a question in the <button onClick={() => navigateToSection('ask-why')} className="text-[#06b6d4] font-bold hover:underline cursor-pointer">Ask Why</button> interface, retrieved empirical evidence items populate this rail directly.
                  </p>
                </div>

                {/* CHRONOLOGICAL REPOSITORY HISTORY TIMELINE */}
                {queryResult?.evidence && queryResult.evidence.length > 0 ? (
                  <div className="p-8 rounded-2xl bg-[#0d0e14] border border-[#1f2430]">
                    <HistoryTimeline evidence={queryResult.evidence} />
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-[#0d0e14] border border-[#1f2430] text-center space-y-4">
                    <div className="text-[#9ca3af] font-sans text-sm">
                      Chronological evidence timeline for <span className="font-mono text-[#06b6d4]">{currentRepoName}</span> will be generated when a query is executed.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>


        {/* 4. HOW IT WORKS SECTION */}
        <section id="how-it-works" className="scroll-mt-24 py-10 space-y-10">
          
          {/* SECTION HEADER */}
          <div className="space-y-2">
            <div className="text-xs font-mono font-bold text-[#8b5cf6] uppercase tracking-wider">
              03 · HOW IT WORKS
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#f8fafc] tracking-tight">
              How Why The Code Is Like This Works
            </h2>
            <p className="text-base text-[#9ca3af] font-sans">
              Graph-grounded code archaeology using Neo4j GraphRAG and Sarvam AI reasoning.
            </p>
          </div>

          {/* 4 WORKFLOW STEPS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '01',
                title: 'CONNECT',
                desc: 'Ingest GitHub git commits, PR discussions, and issue logs into Neo4j graph nodes.',
                detail: 'Parses repository AST, commit histories, PR review threads, and issue tags into structured Cypher graph entities.'
              },
              {
                num: '02',
                title: 'ASK',
                desc: 'Ask natural language questions about refactors, workarounds, or architectural trade-offs.',
                detail: 'Translates developer inquiries into graph traversal patterns scoped strictly to the active repository.'
              },
              {
                num: '03',
                title: 'TRACE',
                desc: 'Traverse graph relationships linking files to commits, reviewers, and rationale.',
                detail: 'Traverses edges between File nodes, Commit nodes, Author nodes, and Decision rationale tags.'
              },
              {
                num: '04',
                title: 'UNDERSTAND',
                desc: 'Synthesize verified historical explanations grounded in empirical repository evidence.',
                detail: 'Sarvam AI engine structures clean, plain-English answers with zero hallucinations, backed by GitHub URLs.'
              }
            ].map((step, idx) => (
              <div
                key={step.num}
                className="p-6 rounded-2xl bg-[#12141d]/70 border border-[#1f2430] hover:border-[#06b6d4]/50 transition-all space-y-3"
              >
                <div className="flex items-center justify-between font-mono text-xs font-bold">
                  <span className="text-[#06b6d4]">{step.num}</span>
                  <span className="text-[#6b7280]">STEP 0{idx + 1}</span>
                </div>
                <h3 className="text-xl font-extrabold font-sans text-[#f8fafc]">
                  {step.title}
                </h3>
                <p className="text-xs text-[#e2e8f0] font-sans font-semibold leading-relaxed">
                  {step.desc}
                </p>
                <p className="text-[11px] text-[#9ca3af] font-sans leading-relaxed pt-1">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>

          {/* TECHNICAL ARCHITECTURE BANNER */}
          <div className="p-8 rounded-2xl bg-[#0d0e14] border border-[#1f2430] space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]" />
              <span className="font-mono text-xs text-[#06b6d4] font-bold uppercase">
                ARCHITECTURAL GUARANTEES
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 text-xs font-sans">
              <div className="space-y-1.5">
                <div className="font-bold text-[#f8fafc] text-sm font-mono">1. Repository Isolation</div>
                <p className="text-[#9ca3af] leading-relaxed">
                  Retrieval queries are strictly scoped to the active repository scope. Evidence from unrelated repositories is automatically excluded.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-[#f8fafc] text-sm font-mono">2. Empirical Provenance</div>
                <p className="text-[#9ca3af] leading-relaxed">
                  Every statement in the synthesized answer points directly to verified commit hashes, PR numbers, or issue links.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-[#f8fafc] text-sm font-mono">3. Sarvam AI Synthesis</div>
                <p className="text-[#9ca3af] leading-relaxed">
                  Answers are formatted into 7 plain-English sections explaining what happened, why it happened, risks, and alternatives.
                </p>
              </div>
            </div>
          </div>

        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#1f2430] py-10 text-center text-xs text-[#6b7280] font-mono">
        Why The Code Is Like This :: Neo4j GraphRAG & Sarvam AI Engine
      </footer>

    </div>
  );
}

