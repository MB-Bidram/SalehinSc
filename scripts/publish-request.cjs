'use strict';
// Runs only in GitHub Actions. Never evaluates issue text or interpolates it into a shell.
const fs = require('node:fs');
globalThis.crypto ||= require('node:crypto').webcrypto;
require('../config.js');
const { GitHubRepository, cryptography: C } = require('../backend.js');
const { validateRequest, digest } = require('../role-backend.js');

async function publish({ repository, config, issueNumber }) {
  const scope = `SalehinSc:v4:${config.owner.toLowerCase()}/${config.repo.toLowerCase()}:${config.branch}:${config.dataPath}`;
  if (!Number.isSafeInteger(issueNumber) || issueNumber < 1) throw new Error('Invalid staging issue number.');
  const issue = await repository.request(`${repository.api}/issues/${issueNumber}`, {}, true);
  if (issue.pull_request || typeof issue.body !== 'string' || issue.body.length > 60000) throw new Error('Invalid staging issue.');
  const request = JSON.parse(issue.body);
  let snapshot = await repository.snapshot(scope);
  await validateRequest(request, snapshot.catalog, scope);
  const files = [];
  for (const staged of request.files) {
    const chunks = [];
    for (const commentId of staged.chunks) {
      const comment = await repository.request(`${repository.api}/issues/comments/${commentId}`, {}, true);
      if (comment.issue_url !== `${repository.api}/issues/${issueNumber}` || !/^salehin-chunk-v1:[A-Za-z0-9+/]+={0,2}$/.test(comment.body) || comment.body.length > 57000) throw new Error('Invalid encrypted attachment chunk.');
      const chunk = C.unbase64(comment.body.slice('salehin-chunk-v1:'.length));
      const expected = Math.min(42000, staged.size - chunks.length * 42000);
      if (chunk.length !== expected) throw new Error('Encrypted attachment chunk size/hash does not match its signed request.');
      chunks.push(chunk);
    }
    const combined = new Uint8Array(chunks.reduce((total, part) => total + part.length, 0));
    let offset = 0; for (const part of chunks) { combined.set(part, offset); offset += part.length; }
    if (combined.length !== staged.size || await digest(combined) !== staged.hash) throw new Error('Encrypted attachment hash does not match its signed request.');
    files.push({ path: staged.path, content: combined, binary: true });
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) snapshot = await repository.snapshot(scope);
    await validateRequest(request, snapshot.catalog, scope);
    try {
      const receipt = await repository.request(`${repository.api}/contents/data/requests/${request.id}.json?ref=${snapshot.head}`, { headers: { Accept: 'application/vnd.github.raw+json' } }, true);
      if (receipt.status === 'published') return receipt;
    } catch (error) { if (error.code !== 'NOT_FOUND') throw error; }
    const catalog = structuredClone(snapshot.catalog), outputs = [...files];
    if (request.operation === 'message') {
      const scoreRecord = request.message.category === 'score';
      const collection = scoreRecord ? 'scores' : 'messages';
      if ((catalog[collection] || []).some(message => message.id === request.id)) throw new Error('Message already exists.');
      const path = `data/${collection}/${request.id}.json`;
      catalog[collection] = [...(catalog[collection] || []), { id: request.id, path, recipients: request.message.recipients.map(item => item.id) }];
      if (request.message.pinned && !scoreRecord) catalog.site = { ...(catalog.site || {}), pinnedMessage: request.id };
      outputs.push({ path, content: JSON.stringify(request.message) });
    } else {
      const account = catalog.students.find(account => account.id === request.accountId);
      const path = `data/students/${account.id}.json`;
      account.payloadRef = { path, revision: request.payloadRevision };
      delete account.payload;
      outputs.push({ path, content: JSON.stringify(request.payload) + '\n' });
    }
    catalog.updatedAt = new Date().toISOString();
    const receipt = { id: request.id, status: 'published', publishedAt: catalog.updatedAt };
    outputs.push({ path: `data/requests/${request.id}.json`, content: JSON.stringify(receipt) });
    try { await repository.commit(snapshot, catalog, outputs); return receipt; }
    catch (error) { if (error.code !== 'CONFLICT' || attempt === 3) throw error; }
  }
}
async function main() {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const fullName = String(event.repository?.full_name || '');
  const repositoryMatch = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(fullName);
  const environmentRepository = String(process.env.GITHUB_REPOSITORY || fullName);
  const config = repositoryMatch ? {
    ...globalThis.SALEHIN_CONFIG,
    owner: repositoryMatch[1],
    repo: repositoryMatch[2],
    branch: String(event.repository.default_branch || '')
  } : null;
  if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || !config || environmentRepository.toLowerCase() !== fullName.toLowerCase() || !config.branch || process.env.GITHUB_REF !== `refs/heads/${config.branch}`) throw new Error('Publishing must run from the target repository default branch.');
  if (!/^\d+$/.test(event.inputs?.issue || '')) throw new Error('Invalid issue input.');
  const repository = new GitHubRepository(config); repository.token = process.env.PORTAL_GITHUB_TOKEN;
  await publish({ repository, config, issueNumber: Number(event.inputs.issue) });
  console.log('Encrypted portal request published.');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { publish };
