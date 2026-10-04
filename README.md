# RepoTrace

> **Understand the decisions behind the code.**

RepoTrace is a developer-focused **code archaeology and repository intelligence tool** that helps answer why a codebase is the way it is.

Instead of looking only at the latest version of a repository, RepoTrace connects **repository history, discussions, decisions, documentation, and implementation evidence** to produce grounded explanations about how and why a system evolved.

---

## What RepoTrace Does

RepoTrace lets you:

- Connect a GitHub repository
- Ingest repository history and relevant code/documentation evidence
- Build a graph of repository evolution
- Ask natural-language questions about the codebase
- Trace answers back to repository evidence
- Understand the reasoning, changes, and implementation behind the code

The goal is not simply to answer **what the code does**, but to help answer questions such as:

- Why was this implementation chosen?
- What problem was this change solving?
- How does this architecture work?
- Where is a particular design implemented?
- What evidence supports this explanation?
- How did the repository evolve into its current state?

---

## Core Architecture

```text
                    ┌─────────────────────┐
                    │   GitHub Repository │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Repository Ingestion │
                    │  Commits / PRs /    │
                    │  Issues / Docs /    │
                    │       Code          │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │       Neo4j         │
                    │   Repository Graph  │
                    └──────────┬──────────┘
                               │
                        Relevant evidence
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Question / Query  │
                    │   Intent Analysis   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Sarvam AI      │
                    │ Grounded Synthesis  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      RepoTrace      │
                    │ Answer + Evidence + │
                    │ Pipeline Provenance │
                    └─────────────────────┘
```

---

## Why a Graph?

Repository history is naturally relational.

A commit can relate to:

- A pull request
- An issue
- A discussion
- A contributor
- A decision
- An incident
- A repository
- Relevant source files or documentation

**Neo4j** allows these relationships to be represented as a graph so RepoTrace can retrieve connected evidence rather than treating repository history as an unrelated list of commits.

---

## Evidence-Grounded Answers

RepoTrace is designed to distinguish between:

### Verified Evidence

Information directly supported by retrieved repository material.

### Limited Evidence

The repository does not contain enough relevant historical or implementation evidence.

### Unknowns

Details that cannot be established from the available repository evidence.

This is important because a code-archaeology system should not invent a historical reason simply because a question expects one.

---

## Question Types

RepoTrace supports different kinds of repository questions.

### Historical

Examples:

- Why was this change made?
- What problem was this commit solving?
- Who contributed to this change?
- How did this feature evolve?

### Architectural

Examples:

- How is this system structured?
- Why is this component separated from another component?
- What architecture is used for this feature?

### Implementation

Examples:

- Where is this behavior implemented?
- Which files and functions are involved?
- How does this mechanism work?

### Performance

Examples:

- How does the system handle large datasets?
- What optimization strategy is used?
- How is memory or storage usage controlled?

The answer format should adapt to the question rather than forcing every question into a fixed historical template.

---

## Answer Format

RepoTrace is designed for fast comprehension.

Answers use:

- A concise **Executive Summary / Gist**
- Medium-sized bullet points
- **Bold technical keywords**
- Clear section headings
- Relevant implementation or historical evidence
- Source links where available
- Explicit limitations when evidence is insufficient

This makes complex repository explanations easier to scan without requiring the reader to go through large paragraphs.

---

## Technology Stack

### Frontend

- React
- Vite
- JavaScript / JSX
- CSS
- Responsive light and dark themes

### Backend

- Node.js
- Express
- Neo4j JavaScript Driver
- GitHub API integration
- Sarvam AI integration

### Data / Knowledge Graph

- Neo4j
- Repository commits
- Pull requests
- Issues
- Discussions
- Decisions / incidents
- Relevant repository documentation and source evidence

---

## Project Structure

```text
RepoTrace/
├── backend/
│   ├── services/
│   │   ├── githubService.js
│   │   ├── graphService.js
│   │   └── sarvamService.js
│   ├── api.js
│   └── server.js
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AnswerPanel.jsx
│   │   │   ├── DecisionChain.jsx
│   │   │   ├── EvidencePanel.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── HistoryTimeline.jsx
│   │   │   ├── QuestionPanel.jsx
│   │   │   ├── RepositoryInput.jsx
│   │   │   └── WhyThisAnswer.jsx
│   │   ├── App.jsx
│   │   └── index.css
│   └── package.json
│
└── README.md
```

---

## Getting Started

### Prerequisites

Install:

- Node.js
- npm
- A running Neo4j database or Neo4j Aura instance
- GitHub API credentials
- Sarvam AI credentials

---

### 1. Clone the Repository

```bash
git clone https://github.com/pvsatvika/RepoTrace.git
cd RepoTrace
```

---

### 2. Configure the Backend

Create the backend environment file:

```text
backend/.env
```

Configure the required environment variables for your deployment:

```env
NEO4J_URI=
NEO4J_USER=
NEO4J_PASSWORD=

GITHUB_TOKEN=

SARVAM_API_KEY=
```

**Do not commit `.env` files or API keys to Git.**

---

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

---

### 4. Start the Backend

```bash
node server.js
```

The backend API runs on the configured backend port, typically:

```text
http://localhost:5000
```

---

### 5. Install Frontend Dependencies

Open another terminal:

```bash
cd frontend
npm install
```

---

### 6. Start the Frontend

```bash
npm run dev
```

The Vite development server will display the local frontend URL in the terminal.

---

## Health Check

RepoTrace exposes a backend health endpoint:

```http
GET /api/health
```

A healthy deployment should report that the backend and Neo4j connection are operational.

If Neo4j is unavailable, repository graph queries may not work even if the frontend itself loads correctly.

---

## Typical Workflow

```text
Connect Repository
        ↓
Repository Ingestion
        ↓
Graph Construction
        ↓
Ask a Question
        ↓
Retrieve Relevant Evidence
        ↓
Question Intent Analysis
        ↓
AI Synthesis
        ↓
Grounded Answer
        ↓
Evidence + Provenance
```

---

## Design Principles

### Evidence First

RepoTrace should prefer repository evidence over unsupported assumptions.

### Explainable Answers

An answer should make it possible for a developer to understand why the system reached its conclusion.

### Separate Retrieval and Synthesis

The AI model is used to interpret and synthesize retrieved evidence.

Repository retrieval and graph queries remain responsible for finding the underlying evidence.

This separation helps keep answers grounded and makes the system easier to inspect and debug.

### No Fabricated History

If the repository does not document why a decision was made, RepoTrace should say that the evidence is insufficient instead of inventing a rationale.

### Question-Aware Reporting

A question about architecture should not receive an irrelevant historical report.

The structure of the answer should match the question being asked.

---

## Current Limitations

RepoTrace's answer quality depends on the evidence available in the repository and the quality of the retrieval process.

For example:

- A repository may not document the reasoning behind an architectural decision.
- Commit messages can be too short to explain implementation details.
- Some relevant information may exist only in source files or documentation.
- Large repositories require selective retrieval to avoid excessive API calls and graph storage.
- Historical evidence and current implementation evidence are different kinds of information and may require different retrieval strategies.

When evidence is insufficient, RepoTrace should make that limitation explicit.

---

## Security

Never commit secrets to the repository.

Keep the following private:

- GitHub tokens
- Neo4j credentials
- Sarvam API keys
- Other deployment secrets

Use environment variables and `.env` files locally, and configure secrets through your deployment platform in production.

---

## Development

Before committing frontend changes:

```bash
cd frontend
npm run build
```

Verify that:

- The frontend builds successfully.
- Existing API contracts remain compatible.
- Light and dark themes work.
- Repository ingestion still works.
- Questions return evidence-backed answers.
- Historical and architectural questions use appropriate answer structures.

---

## Project Status

RepoTrace is an actively developed project focused on:

- Repository intelligence
- Code archaeology
- Graph-grounded reasoning
- Explainable developer tooling
- Repository evolution analysis
- Evidence-grounded AI answers
- Graph-based code history
- Source and documentation retrieval
- Question-aware explanations
- Developer-friendly presentation

---

## License

Add the project's license information here when the repository license is finalized.

---

## Repository

**GitHub:** https://github.com/pvsatvika/RepoTrace
