'use strict';
// Run locally, never in GitHub Actions. The one-time credentials are printed only to this terminal.
const fs = require('node:fs/promises');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
globalThis.crypto ||= nodeCrypto.webcrypto;
const { createBootstrap } = require('../role-backend.js');
const { generateLoginKey } = require('../backend.js');

const DATA_PATH = 'data/portal.json';
const API_VERSION = '2026-03-10';
const REPOSITORY_PART = /^[A-Za-z0-9_.-]+$/;
const BRANCH_PART = /^[A-Za-z0-9_./-]+$/;

function normalizeRepositoryName(value, owner) {
  let repo = String(value || '').trim();
  if (!repo) return '';

  // Accept the repository name, owner/repository, a GitHub URL, or an SSH remote.
  // `--owner` remains authoritative: URLs for a different owner are rejected.
  let urlOwner = '';
  if (/^https?:\/\//i.test(repo)) {
    let parsed;
    try { parsed = new URL(repo); } catch { throw new Error('Provide a valid GitHub repository URL or repository name.'); }
    if (!['github.com', 'www.github.com'].includes(parsed.hostname.toLowerCase())) throw new Error('The --repo URL must point to github.com.');
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length !== 2) throw new Error('Use a repository URL in the form https://github.com/OWNER/REPOSITORY.');
    urlOwner = parts[0];
    repo = parts[1];
  } else if (/^git@github\.com:/i.test(repo)) {
    const remote = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(repo);
    if (!remote) throw new Error('Use an SSH remote in the form git@github.com:OWNER/REPOSITORY.git.');
    urlOwner = remote[1]; repo = remote[2];
  } else if (repo.includes('/')) {
    const parts = repo.split('/').filter(Boolean);
    if (parts.length !== 2) throw new Error('Use OWNER/REPOSITORY, not a repository subpath.');
    urlOwner = parts[0]; repo = parts[1];
  }

  if (repo.toLowerCase().endsWith('.git')) repo = repo.slice(0, -4);
  if (urlOwner && String(owner || '').toLowerCase() !== urlOwner.toLowerCase()) {
    throw new Error(`The repository owner in --repo (${urlOwner}) does not match --owner (${owner || 'missing'}).`);
  }
  return repo;
}

function normalizeTarget(owner, repo) {
  const normalizedOwner = String(owner || '').trim();
  const normalizedRepo = normalizeRepositoryName(repo, normalizedOwner);
  if (!REPOSITORY_PART.test(normalizedOwner) || !REPOSITORY_PART.test(normalizedRepo)) {
    throw new Error('Provide a valid GitHub owner and repository name.');
  }
  return { owner: normalizedOwner, repo: normalizedRepo };
}

function parseArgs(argv) {
  const result = { replaceSeed: false, name: 'School administrator' };
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (item === '--replace-seed') { result.replaceSeed = true; continue; }
    if (!['--owner', '--repo', '--branch', '--name'].includes(item)) throw new Error(`Unknown option: ${item}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${item}.`);
    result[item.slice(2)] = value;
  }
  return result;
}

async function createSeed({ owner, repo, branch, name = 'School administrator' }) {
  ({ owner, repo } = normalizeTarget(owner, repo));
  if (!BRANCH_PART.test(String(branch || ''))) throw new Error('Provide the repository default branch with --branch.');
  if (!String(name || '').trim() || String(name).length > 120) throw new Error('Administrator name must contain 1–120 characters.');

  const config = { owner, repo, branch, dataPath: DATA_PATH, apiVersion: API_VERSION };
  const loginKey = generateLoginKey();
  const password = nodeCrypto.randomBytes(24).toString('base64url');
  const seed = await createBootstrap(config, { loginKey, password, name: String(name).trim() });
  return { config, catalog: seed.catalog, files: seed.files, loginKey, password, qrFragment: seed.qrFragment };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const owner = args.owner || process.env.GITHUB_REPOSITORY?.split('/')[0];
  const repo = args.repo || process.env.GITHUB_REPOSITORY?.split('/')[1];
  const branch = args.branch || process.env.GITHUB_REF_NAME;
  if (!owner || !repo || !branch) {
    throw new Error('Usage: npm run bootstrap -- --owner OWNER --repo REPOSITORY --branch DEFAULT_BRANCH [--name "Administrator"] [--replace-seed]');
  }

  const targetRepository = normalizeTarget(owner, repo);
  const normalizedOwner = targetRepository.owner, normalizedRepo = targetRepository.repo;
  const target = path.resolve(__dirname, '..', DATA_PATH);
  let existing;
  try { existing = JSON.parse(await fs.readFile(target, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error(`Could not read ${DATA_PATH}: ${error.message}`); }

  const targetScope = `SalehinSc:v4:${normalizedOwner.toLowerCase()}/${normalizedRepo.toLowerCase()}:${branch}:${DATA_PATH}`;
  const hasRecords = Boolean(existing && (
    existing.students?.length || existing.announcements?.length || existing.messages?.length
  ));
  if (existing?.scope === targetScope && hasRecords) {
    throw new Error('This catalog is already scoped to the target repository and contains records. Refusing to overwrite a live portal.');
  }
  if (hasRecords && !args.replaceSeed) {
    throw new Error(`A catalog already exists at ${DATA_PATH}. For a fresh copy in a different repository, rerun with --replace-seed. Never use that flag on a populated live repository.`);
  }

  const result = await createSeed({ owner: normalizedOwner, repo: normalizedRepo, branch, name: args.name });
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(result.catalog, null, 2)}\n`, { flag: 'wx' });
  await fs.rename(temporary, target);
  for (const file of result.files) {
    const destination = path.resolve(__dirname, '..', file.path);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, file.content, { flag: 'w' });
  }

  console.log('Created a fresh encrypted administrator seed for this repository.');
  console.log('Save this private QR fragment. It grants access to the initial administrator account:');
  console.log(`Administrator QR fragment: ${result.qrFragment}`);
  console.log('Treat the fragment as a secret. Generate its QR image locally; never paste it into a public QR website.');
  console.log(`Next: commit ${DATA_PATH} and data/students/ to ${normalizedOwner}/${normalizedRepo} on branch ${branch}, then deploy the Pages site.`);
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { createSeed, parseArgs, normalizeRepositoryName, normalizeTarget };
