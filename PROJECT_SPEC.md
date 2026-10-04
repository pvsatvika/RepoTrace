# Project Specification: RepoTrace

## 1. What is the system doing?
"Why The Code Is Like This" is a GraphRAG (Graph Retrieval-Augmented Generation) system that ingests repository commit history, pull requests, and review discussions from GitHub, builds a decision graph in Neo4j, and uses Sarvam AI to provide evidence-backed answers explaining why specific code changes or architectural decisions were made.

## 2. Who is the exact user?
- **Software Engineers & Technical Leads**: Developers taking over legacy codebases, conducting code reviews, or investigating why non-obvious code patterns exist.
- **Open Source Contributors**: Developers trying to understand previous PR decisions before submitting new features.

## 3. What MUST the system do?
- Ingest GitHub repository commits, modified files, closed PRs, and PR review comments.
- Construct a connected decision graph in Neo4j with `:Repository`, `:CodeEntity`, `:Commit`, `:PullRequest`, and `:Discussion` nodes.
- Execute Cypher queries to extract relevant subgraph evidence based on developer keywords.
- Generate natural language explanations using Sarvam AI (`sarvam-2b`) with explicit citations (SHAs, PR numbers, authors, dates).
- Render a 2-column web dashboard displaying the AI answer alongside the interactive Neo4j evidence chain.

## 4. What are the exclusions?
- Real-time GitHub webhook listeners.
- Automated code editing, patch generation, or refactoring execution.
- Multi-repository cross-linking in a single query session.

## 5. What data does it ingest?
- GitHub repository commits (SHA, message, author, date, URL).
- Commit file diff metadata (filename, additions, deletions).
- Closed Pull Requests (PR number, title, body, user, merged date, URL).
- PR issue comments and inline code review comments.

## 6. What are the constraints?
- Must respect GitHub REST API rate limits (unauthenticated: 60 req/hr; authenticated: 5000 req/hr).
- Neo4j database queries must execute within reasonable latency bounds (< 2 seconds).
- AI completions must strictly cite graph evidence without inventing non-existent PRs or commits.

## 7. What defines "Done"?
- Ingestion endpoint (`POST /api/ingest`) populates Neo4j with full repository nodes & relationships.
- Query endpoint (`POST /api/query`) retrieves subgraph evidence and returns Sarvam AI answers with markdown citations.
- React frontend dashboard provides an end-to-end user workflow with live evidence visualization.

## 8. What are the top unknowns/risks?
- **GitHub API Rate Limits**: Mitigated by supporting personal access tokens (`GITHUB_TOKEN`) and batching requests.
- **Incomplete Commit-PR Linking**: Solved by using regex matching for PR numbers (`#123`) in commit messages and PR description references.
- **LLM Hallucinations**: Mitigated by strict system prompt grounding and displaying raw Neo4j graph evidence cards alongside AI answers.
