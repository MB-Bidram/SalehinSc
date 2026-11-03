'use strict';
// Run locally, never in GitHub Actions. The primary-teacher credential is written only to a Git-ignored local teacher.html file; it is never printed.
const fs = require('node:fs/promises');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
globalThis.crypto ||= nodeCrypto.webcrypto;
const { createBootstrap } = require('../role-backend.js');
const { generateLoginKey } = require('../backend.js');
const { buildTeacherLauncherHtml } = require('../teacher-local.js');

const DATA_PATH = 'data/portal.json';
const API_VERSION = '2026-03-10';
const ROOT = path.resolve(__dirname, '..');
const REPOSITORY_PART = /^[A-Za-z0-9_.-]+$/;
const BRANCH_PART = /^[A-Za-z0-9_./-]+$/;

function createTeacherDirectory(catalog) {
  const primary = (catalog?.students || []).filter(account => account?.role === 'admin');
  if (primary.length !== 1 || primary[0].disabled) throw new Error('A fresh school must have exactly one active primary teacher account.');
  return {
    format: 'SalehinSc teacher directory',
    version: 1,
    primaryTeacherId: primary[0].id,
    teachers: [{ id: primary[0].id, kind: 'primary', active: true }],
    updatedAt: new Date().toISOString()
  };
}

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
  const teacherDirectory = createTeacherDirectory(seed.catalog);
  return { config, catalog: seed.catalog, files: seed.files, teacherDirectory, loginKey, password, qrFragment: seed.qrFragment };
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
  const target = path.resolve(ROOT, DATA_PATH);
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
  const teacherDirectoryPath = path.resolve(__dirname, '..', 'data', 'teachers', 'teacher.json');
  await fs.mkdir(path.dirname(teacherDirectoryPath), { recursive: true });
  await fs.writeFile(teacherDirectoryPath, `${JSON.stringify(result.teacherDirectory, null, 2)}\n`, { flag: 'w' });
  for (const file of result.files) {
    const destination = path.resolve(__dirname, '..', file.path);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, file.content, { flag: 'w' });
  }

  console.log('Created a fresh encrypted primary-teacher seed for this repository.');
  console.log('Created data/teachers/teacher.json (public identity metadata only; no private secret).');
  const match = /^#?s=([a-f0-9]{64})&k=([A-Za-z0-9_-]{40,48})&r=([a-f0-9]{32})$/.exec(result.qrFragment);
  if (!match) throw new Error('Bootstrap generated an invalid local teacher credential.');
  const teacherFilePath = path.join(ROOT, 'teacher.html');
  const teacherHtml = buildTeacherLauncherHtml({
    appUrl: `https://${normalizedOwner.toLowerCase()}.github.io/${normalizedRepo}/`,
    id: match[1], key: match[2], revision: match[3], schoolName: 'مدرسه صالحین'
  });
  try {
    await fs.writeFile(teacherFilePath, teacherHtml, { flag: 'wx' });
    console.log('Created local-only teacher.html. It is ignored by Git and excluded from GitHub Pages deployment.');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log('An existing local teacher.html was preserved; it was not overwritten.');
  }
  console.log('Keep teacher.html on the authorized teacher device. Do not commit, upload, email or share it.');
  console.log(`Next: commit ${DATA_PATH} and data/students/ to ${normalizedOwner}/${normalizedRepo} on branch ${branch}, then deploy the Pages site.`);
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { createSeed, createTeacherDirectory, parseArgs, normalizeRepositoryName, normalizeTarget };
