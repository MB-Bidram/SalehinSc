/* Resolve the active GitHub Pages repository at runtime. No account or repository is pinned here. */
'use strict';
(function (root) {
  const DATA_PATH = 'data/portal.json';
  const API_VERSION = '2026-03-10';
  const SCRIPT_URL = root.document?.currentScript?.src || '';
  const REPOSITORY_PATTERN = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;
  const BRANCH_PATTERN = /^[A-Za-z0-9_./-]+$/;

  function meta(name) {
    return root.document?.querySelector(`meta[name="${name}"]`)?.content?.trim() || '';
  }

  function parseRepository(value) {
    const match = REPOSITORY_PATTERN.exec(String(value || '').trim());
    return match ? { owner: match[1], repo: match[2] } : null;
  }

  function nodeConfiguration() {
    if (typeof process === 'undefined' || !process.versions?.node) return null;
    const repository = parseRepository(process.env.GITHUB_REPOSITORY);
    if (!repository) return null;
    const branch = process.env.GITHUB_REF_NAME || process.env.GITHUB_HEAD_REF || '';
    return { ...repository, branch: BRANCH_PATTERN.test(branch) ? branch : '' };
  }

  function browserConfiguration() {
    const explicitRepository = parseRepository(root.SALEHIN_REPOSITORY || meta('salehin-repository'));
    const explicitBranch = root.SALEHIN_BRANCH || meta('salehin-branch');
    if (explicitRepository) {
      return {
        ...explicitRepository,
        branch: BRANCH_PATTERN.test(String(explicitBranch || '').trim()) ? String(explicitBranch).trim() : '',
        lookupBranch: !BRANCH_PATTERN.test(String(explicitBranch || '').trim())
      };
    }

    const hostname = String(root.location?.hostname || '').toLowerCase().replace(/\.$/, '');
    const pagesHost = /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.github\.io$/.exec(hostname);
    if (!pagesHost) return null;

    const owner = pagesHost[1];
    const segments = String(root.location?.pathname || '/').split('/').filter(Boolean);
    let repo = `${owner}.github.io`;
    if (segments.length && segments[0].toLowerCase() !== 'index.html') {
      try { repo = decodeURIComponent(segments[0]); } catch { repo = segments[0]; }
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(repo)) throw new Error('The GitHub Pages URL does not contain a valid repository name.');
    return { owner, repo, branch: '', lookupBranch: true };
  }

  const target = nodeConfiguration() || browserConfiguration() || { owner: 'local', repo: 'portal', branch: 'main', lookupBranch: false };
  let baseUrl = '';
  try {
    const scriptUrl = new URL(SCRIPT_URL || 'config.js', root.location?.href || 'https://localhost/');
    baseUrl = new URL('./', scriptUrl).href;
  } catch { /* Node-side configuration has no browser deployment URL. */ }
  const initial = {
    owner: target.owner,
    repo: target.repo,
    branch: target.branch || 'main',
    dataPath: DATA_PATH,
    baseUrl,
    apiUrl: String(root.SALEHIN_API_URL || meta('salehin-api') || '').replace(/\/$/, ''),
    schoolName: String(meta('salehin-school-name') || 'مدرسه صالحین').slice(0, 160),
    apiVersion: API_VERSION
  };
  root.SALEHIN_CONFIG = Object.freeze(initial);

  root.SALEHIN_CONFIG_READY = (async () => {
    if (!target.lookupBranch) return root.SALEHIN_CONFIG;
    if (!target.owner || !target.repo || !root.fetch) throw new Error('Cannot determine this site\'s GitHub repository. Open it from its GitHub Pages URL.');

    // A catalog already provisioned for this repository tells us its exact branch
    // without spending a GitHub API request on every page load.
    try {
      const pageUrl = root.location?.href || `https://${root.location?.hostname || ''}${root.location?.pathname || '/'}`;
      const configUrl = new URL(SCRIPT_URL || 'config.js', pageUrl);
      const catalogUrl = new URL(DATA_PATH, configUrl);
      const seedResponse = await root.fetch(catalogUrl.href, { method: 'GET', cache: 'no-store', credentials: 'omit' });
      if (seedResponse.ok) {
        const seed = await seedResponse.json();
        const scoped = /^SalehinSc:v4:([^/]+)\/([^:]+):([^:]+):(.+)$/.exec(String(seed?.scope || ''));
        if (scoped && scoped[1].toLowerCase() === target.owner.toLowerCase() && scoped[2].toLowerCase() === target.repo.toLowerCase() && scoped[4] === DATA_PATH && BRANCH_PATTERN.test(scoped[3])) {
          root.SALEHIN_CONFIG = Object.freeze({ ...initial, branch: scoped[3] });
          return root.SALEHIN_CONFIG;
        }
      }
    } catch { /* A missing or differently scoped seed falls back to repository metadata. */ }

    const endpoint = `https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`;
    let response;
    try {
      response = await root.fetch(endpoint, {
        method: 'GET', cache: 'no-store', credentials: 'omit',
        headers: { Accept: 'application/vnd.github+json' }
      });
    } catch {
      throw new Error(`Could not check the default branch for ${target.owner}/${target.repo}. Check your connection and try again.`);
    }
    if (!response.ok) {
      throw new Error(`Could not find the public repository ${target.owner}/${target.repo} on GitHub (HTTP ${response.status}).`);
    }
    let metadata;
    try { metadata = await response.json(); } catch { throw new Error('GitHub returned invalid repository metadata.'); }
    if (typeof metadata.default_branch !== 'string' || !BRANCH_PATTERN.test(metadata.default_branch)) {
      throw new Error(`GitHub did not provide a valid default branch for ${target.owner}/${target.repo}.`);
    }

    root.SALEHIN_CONFIG = Object.freeze({ ...initial, branch: metadata.default_branch });
    return root.SALEHIN_CONFIG;
  })();
})(globalThis);
