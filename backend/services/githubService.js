import { Octokit } from '@octokit/rest';

/**
 * Initializes and returns an Octokit client instance.
 */
function getOctokitClient() {
  const token = process.env.GITHUB_TOKEN;
  const isDummy = !token || token === 'your_github_token';

  if (isDummy) {
    console.warn('[GitHub Service] Warning: GITHUB_TOKEN is missing or using placeholder. Rate limit is 60 req/hr.');
  }

  return new Octokit({
    auth: !isDummy ? token : undefined,
  });
}

/**
 * Fetches repository history: metadata, commits, PRs, issues, and targeted source/doc files.
 * 
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} Structured repo data
 */
export async function fetchRepoData(owner, repo) {
  if (!owner || !repo) {
    const error = new Error("Both 'owner' and 'repo' are required parameters.");
    error.status = 400;
    throw error;
  }

  const octokit = getOctokitClient();

  try {
    console.log(`[GitHub Service] Deep-fetching history and targeted repository files for ${owner}/${repo}...`);

    // 1. Primary Parallel Fetch: Repo info, Commits, PRs, Issues
    const [repoRes, commitsRes, prsRes, issuesRes] = await Promise.allSettled([
      octokit.rest.repos.get({ owner, repo }),
      octokit.rest.repos.listCommits({ owner, repo, per_page: 20 }),
      octokit.rest.pulls.list({ owner, repo, state: 'closed', per_page: 15 }),
      octokit.rest.issues.listForRepo({ owner, repo, state: 'all', per_page: 15 }),
    ]);

    if (repoRes.status === 'rejected') {
      const err = repoRes.reason;
      if (err.status === 404) {
        const error = new Error(`Repository '${owner}/${repo}' not found or is private.`);
        error.status = 404;
        throw error;
      }
      if (err.status === 401) {
        const error = new Error('Unauthorized GITHUB_TOKEN.');
        error.status = 401;
        throw error;
      }
      if (err.status === 403) {
        const error = new Error('GitHub API rate limit exceeded.');
        error.status = 403;
        throw error;
      }
      throw err;
    }

    const repoMetadata = {
      owner,
      repo,
      description: repoRes.value.data.description || '',
      stars: repoRes.value.data.stargazers_count || 0,
      url: repoRes.value.data.html_url || `https://github.com/${owner}/${repo}`,
    };

    const commitListRaw = commitsRes.status === 'fulfilled' ? commitsRes.value.data : [];
    const prListRaw = prsRes.status === 'fulfilled' ? prsRes.value.data : [];
    const issueListRaw = issuesRes.status === 'fulfilled' ? issuesRes.value.data : [];

    const issueList = issueListRaw.filter((issue) => !issue.pull_request);

    // 2. Fetch File Diffs for Commits
    const commits = await Promise.all(
      commitListRaw.map(async (commit) => {
        try {
          const { data: detail } = await octokit.rest.repos.getCommit({
            owner,
            repo,
            ref: commit.sha,
          });

          const files = (detail.files || []).map((f) => ({
            filename: f.filename,
            additions: f.additions || 0,
            deletions: f.deletions || 0,
          }));

          return {
            sha: commit.sha,
            message: commit.commit?.message || '',
            author: commit.author?.login || commit.commit?.author?.name || 'Unknown',
            date: commit.commit?.author?.date || null,
            url: commit.html_url,
            files,
          };
        } catch {
          return {
            sha: commit.sha,
            message: commit.commit?.message || '',
            author: commit.author?.login || commit.commit?.author?.name || 'Unknown',
            date: commit.commit?.author?.date || null,
            url: commit.html_url,
            files: [],
          };
        }
      })
    );

    // 3. Fetch PR Commits & Comments
    const pullRequests = await Promise.all(
      prListRaw.map(async (pr) => {
        try {
          const [prCommitsRes, issueCommentsRes, reviewCommentsRes] = await Promise.allSettled([
            octokit.rest.pulls.listCommits({ owner, repo, pull_number: pr.number, per_page: 20 }),
            octokit.rest.issues.listComments({ owner, repo, issue_number: pr.number }),
            octokit.rest.pulls.listReviewComments({ owner, repo, pull_number: pr.number }),
          ]);

          const prCommits = prCommitsRes.status === 'fulfilled' ? prCommitsRes.value.data.map((c) => c.sha) : [];
          const issueComments = issueCommentsRes.status === 'fulfilled' ? issueCommentsRes.value.data : [];
          const reviewComments = reviewCommentsRes.status === 'fulfilled' ? reviewCommentsRes.value.data : [];

          const comments = [
            ...issueComments.map((c) => ({
              id: `ic_${c.id}`,
              type: 'issue_comment',
              user: c.user?.login || 'Unknown',
              body: c.body || '',
              date: c.created_at,
            })),
            ...reviewComments.map((rc) => ({
              id: `rc_${rc.id}`,
              type: 'review_comment',
              user: rc.user?.login || 'Unknown',
              body: rc.body || '',
              path: rc.path || null,
              date: rc.created_at,
            })),
          ];

          return {
            number: pr.number,
            title: pr.title || '',
            body: pr.body || '',
            author: pr.user?.login || 'Unknown',
            merged_at: pr.merged_at || null,
            merge_commit_sha: pr.merge_commit_sha || null,
            url: pr.html_url,
            pr_commits: prCommits,
            comments,
          };
        } catch {
          return {
            number: pr.number,
            title: pr.title || '',
            body: pr.body || '',
            author: pr.user?.login || 'Unknown',
            merged_at: pr.merged_at || null,
            merge_commit_sha: null,
            url: pr.html_url,
            pr_commits: [],
            comments: [],
          };
        }
      })
    );

    // 4. Format Issues
    const issues = issueList.map((issue) => ({
      number: issue.number,
      title: issue.title || '',
      body: issue.body || '',
      author: issue.user?.login || 'Unknown',
      state: issue.state || 'closed',
      created_at: issue.created_at,
      url: issue.html_url,
    }));

    // 5. Targeted Fetching of Repository Content & Documentation
    const candidatePaths = ['README.md', 'README.rst', 'ARCHITECTURE.md', 'DESIGN.md', 'CONTRIBUTING.md', 'dvc.yaml', 'pyproject.toml'];
    const skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.pyc', '.exe', '.so', '.dll', '.lock'];
    const skipNames = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock', '.DS_Store'];

    try {
      const { data: rootContent } = await octokit.rest.repos.getContent({ owner, repo, path: '' });
      if (Array.isArray(rootContent)) {
        for (const item of rootContent) {
          if (item.type === 'file' && !candidatePaths.includes(item.path)) {
            const lower = item.name.toLowerCase();
            const isSkipped = skipNames.includes(lower) || skipExtensions.some(ext => lower.endsWith(ext));
            if (!isSkipped && (lower.endsWith('.md') || lower.endsWith('.py') || lower.endsWith('.ts') || lower.endsWith('.js') || lower.endsWith('.yaml') || lower.endsWith('.yml') || lower.endsWith('.json') || lower.endsWith('.toml') || lower.includes('dvc') || lower.includes('dataset') || lower.includes('version'))) {
              if (candidatePaths.length < 18) candidatePaths.push(item.path);
            }
          } else if (item.type === 'dir' && ['docs', 'src', 'dvc', 'models', 'lib', 'core'].includes(item.name.toLowerCase())) {
            try {
              const { data: dirContent } = await octokit.rest.repos.getContent({ owner, repo, path: item.path });
              if (Array.isArray(dirContent)) {
                dirContent.forEach(subItem => {
                  if (subItem.type === 'file' && !candidatePaths.includes(subItem.path)) {
                    const subLower = subItem.name.toLowerCase();
                    const subSkipped = skipNames.includes(subLower) || skipExtensions.some(ext => subLower.endsWith(ext));
                    if (!subSkipped && (subLower.endsWith('.md') || subLower.endsWith('.py') || subLower.endsWith('.ts') || subLower.endsWith('.js') || subLower.endsWith('.yaml') || subLower.includes('dvc') || subLower.includes('dataset') || subLower.includes('version'))) {
                      if (candidatePaths.length < 25) candidatePaths.push(subItem.path);
                    }
                  }
                });
              }
            } catch (dirErr) {
              console.warn(`[GitHub Service] Subdir scan skipped for ${item.path}: ${dirErr.message}`);
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[GitHub Service] Root directory listing skipped: ${e.message}`);
    }

    const files = (await Promise.all(
      candidatePaths.map(async (filePath) => {
        try {
          const res = await octokit.rest.repos.getContent({ owner, repo, path: filePath });
          if (res.data && res.data.content && res.data.encoding === 'base64') {
            const rawContent = Buffer.from(res.data.content, 'base64').toString('utf-8');
            return {
              path: filePath,
              filename: filePath.split('/').pop(),
              content: rawContent.substring(0, 5000),
              url: res.data.html_url || `https://github.com/${owner}/${repo}/blob/main/${filePath}`,
            };
          }
          return null;
        } catch {
          return null;
        }
      })
    )).filter(Boolean);

    console.log(`[GitHub Service] History & Files extracted: ${commits.length} commits, ${pullRequests.length} PRs, ${issues.length} issues, ${files.length} source/doc files.`);

    return {
      metadata: repoMetadata,
      commits,
      pullRequests,
      issues,
      files,
    };
  } catch (err) {
    console.error(`[GitHub Service] Extraction failed for ${owner}/${repo}:`, err.message);
    if (!err.status) err.status = 500;
    throw err;
  }
}
