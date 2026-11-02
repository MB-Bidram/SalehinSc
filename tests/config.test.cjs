'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadConfig({ hostname, pathname = '/', href, meta = {}, process, seedScope, seedOk = true } = {}) {
  const calls = [];
  const context = {
    location: hostname ? { hostname, pathname, href: href || `https://${hostname}${pathname}` } : undefined,
    document: { querySelector(selector) { const match = /^meta\[name="([^"]+)"\]$/.exec(selector); return match && meta[match[1]] ? { content: meta[match[1]].content } : null; } },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (String(url).includes('api.github.com')) {
        return { ok: true, status: 200, json: async () => ({ default_branch: 'develop' }) };
      }
      return { ok: seedOk, status: seedOk ? 200 : 404, json: async () => ({ scope: seedScope || 'SalehinSc:v4:sample-school/SciencePortal:develop:data/portal.json' }) };
    },
    process,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    console
  };
  vm.runInNewContext(fs.readFileSync('config.js', 'utf8'), context, { filename: 'config.js' });
  return { context, calls };
}

test('project Pages URL resolves owner/repository and reads its scoped default branch without GitHub API calls', async () => {
  const { context, calls } = loadConfig({ hostname: 'sample-school.github.io', pathname: '/SciencePortal/' });
  const config = await context.SALEHIN_CONFIG_READY;
  assert.equal(config.owner, 'sample-school');
  assert.equal(config.repo, 'SciencePortal');
  assert.equal(config.branch, 'develop');
  assert.equal(config.dataPath, 'data/portal.json');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://sample-school.github.io/SciencePortal/data/portal.json');
});

test('a mismatched copied seed falls back to public GitHub repository metadata', async () => {
  const { context, calls } = loadConfig({
    hostname: 'sample-school.github.io', pathname: '/SciencePortal/',
    seedScope: 'SalehinSc:v4:old-owner/old-repo:master:data/portal.json'
  });
  const config = await context.SALEHIN_CONFIG_READY;
  assert.equal(config.owner, 'sample-school');
  assert.equal(config.repo, 'SciencePortal');
  assert.equal(config.branch, 'develop');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://api.github.com/repos/sample-school/SciencePortal');
});

test('account Pages URL uses the account site repository even at its root or index.html', async () => {
  for (const pathname of ['/', '/index.html']) {
    const { context } = loadConfig({ hostname: 'sample-school.github.io', pathname, seedScope: 'SalehinSc:v4:sample-school/sample-school.github.io:main:data/portal.json' });
    const config = await context.SALEHIN_CONFIG_READY;
    assert.equal(config.owner, 'sample-school');
    assert.equal(config.repo, 'sample-school.github.io');
    assert.equal(config.branch, 'main');
  }
});

test('custom domains may declare their repository and branch without editing application code', async () => {
  const { context, calls } = loadConfig({
    hostname: 'school.example.org',
    pathname: '/',
    meta: {
      'salehin-repository': { content: 'another-owner/another-repo' },
      'salehin-branch': { content: 'release' }
    }
  });
  const config = await context.SALEHIN_CONFIG_READY;
  assert.equal(config.owner, 'another-owner');
  assert.equal(config.repo, 'another-repo');
  assert.equal(config.branch, 'release');
  assert.equal(calls.length, 0);
});

test('Actions configuration comes from its repository environment, not a baked-in account', async () => {
  const { context, calls } = loadConfig({ process: { versions: { node: 'v22.0.0' }, env: { GITHUB_REPOSITORY: 'org-name/project-name', GITHUB_REF_NAME: 'release' } } });
  const config = await context.SALEHIN_CONFIG_READY;
  assert.equal(config.owner, 'org-name');
  assert.equal(config.repo, 'project-name');
  assert.equal(config.branch, 'release');
  assert.equal(calls.length, 0);
});
