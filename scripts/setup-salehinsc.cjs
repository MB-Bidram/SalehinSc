'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPO = /^[A-Za-z0-9_.-]{1,100}$/;
const BRANCH = /^[A-Za-z0-9_][A-Za-z0-9_./-]{0,119}$/;
const ROOT = path.resolve(__dirname, '..');

function validateTarget(owner, repo, branch) {
  if (!OWNER.test(String(owner || '').trim())) throw new Error('GitHub owner must be a valid username or organization name.');
  if (!REPO.test(String(repo || '').trim()) || String(repo).includes('..')) throw new Error('Repository name contains unsupported characters.');
  if (!BRANCH.test(String(branch || '').trim()) || String(branch).includes('..') || String(branch).endsWith('/') || String(branch).includes('//')) throw new Error('Branch name is invalid.');
  return { owner: owner.trim(), repo: repo.trim(), branch: branch.trim() };
}
function pagesUrl(owner, repo) {
  return repo.toLowerCase() === `${owner}.github.io`.toLowerCase()
    ? `https://${owner}.github.io/`
    : `https://${owner}.github.io/${repo}/`;
}
function originFor(url) { return new URL(url).origin; }
function setTomlValue(source, key, value) {
  const line = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  if (line.test(source)) return source.replace(line, `${key} = ${JSON.stringify(value)}`);
  if (!/^\[vars\]\s*$/m.test(source)) source += '\n[vars]\n';
  return `${source.trimEnd()}\n${key} = ${JSON.stringify(value)}\n`;
}
function updateWrangler(source, target, allowedOrigin) {
  let next = source;
  next = setTomlValue(next, 'GITHUB_REPOSITORY', `${target.owner}/${target.repo}`);
  next = setTomlValue(next, 'GITHUB_BRANCH', target.branch);
  next = setTomlValue(next, 'ALLOWED_ORIGIN', allowedOrigin);
  return next;
}
function setMeta(source, name, value) {
  const safe = String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const pattern = new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["'][^"']*["']\\s*\\/?\\s*>`, 'i');
  const replacement = `<meta name="${name}" content="${safe}">`;
  if (pattern.test(source)) return source.replace(pattern, replacement);
  return source.replace(/<head[^>]*>/i, match => `${match}\n  ${replacement}`);
}
function setTitle(source, schoolName) {
  const safe = String(schoolName).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return source.replace(/<title>[^<]*<\/title>/i, `<title>${safe} | سامانه مدرسه</title>`);
}
function findLogo(root, baseName) {
  const extensions = ['', '.svg', '.png', '.webp', '.jpg', '.jpeg'];
  const folders = ['', 'assets', 'images'];
  for (const folder of folders) for (const ext of extensions) {
    const candidate = path.join(root, folder, `${baseName}${ext}`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return '';
}
function normalizedExt(file) {
  const extension = path.extname(file).toLowerCase();
  if (['.svg', '.png', '.webp', '.jpg', '.jpeg'].includes(extension)) return extension;
  const head = fs.readFileSync(file).subarray(0, 200).toString('utf8').trimStart();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return '.svg';
  const bytes = fs.readFileSync(file).subarray(0, 12);
  if (bytes[0] === 0x89 && bytes.toString('ascii', 1, 4) === 'PNG') return '.png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return '.jpg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  return '';
}
function run(command, args, options = {}) {
  // npm is distributed as npm.cmd on Windows; launch it through CMD. Git remains
  // a direct executable so user-supplied repository values are never shell-expanded.
  const isWindowsNpm = process.platform === 'win32' && command === 'npm';
  const executable = isWindowsNpm ? (process.env.ComSpec || 'cmd.exe') : command;
  const executableArgs = isWindowsNpm ? ['/d', '/s', '/c', 'npm ci'] : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    shell: false,
    stdio: options.inherit ? 'inherit' : 'pipe'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `${command} exited with ${result.status}`).trim());
  return (result.stdout || '').trim();
}
function gitInfo() {
  let top = '';
  try { top = run('git', ['rev-parse', '--show-toplevel']); } catch { return { exists: false, top: '', branch: '', origin: '', dirty: '' }; }
  let branch = '', origin = '', dirty = '';
  try { branch = run('git', ['branch', '--show-current']); } catch { /* Detached or unborn branch. */ }
  try { origin = run('git', ['remote', 'get-url', 'origin']); } catch { /* No origin yet. */ }
  try { dirty = run('git', ['status', '--porcelain']); } catch { /* Status is shown as unknown below. */ }
  return { exists: true, top, branch, origin, dirty };
}
function remoteUrl(owner, repo) { return `https://github.com/${owner}/${repo}.git`; }
function updateBrandAssets(root, html) {
  const manifest = {};
  const assetsDir = path.join(root, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  for (const [sourceBase, targetBase, metaName] of [
    ['Salehin-NobackText', 'salehin-logo-full', 'salehin-logo-full'],
    ['Salehin-Noback', 'salehin-logo-mark', 'salehin-logo-mark']
  ]) {
    const source = findLogo(root, sourceBase);
    if (!source) continue;
    const ext = normalizedExt(source);
    if (!ext) { manifest[sourceBase] = 'found-but-unrecognized'; continue; }
    const destinationName = `${targetBase}${ext}`;
    const destination = path.join(assetsDir, destinationName);
    if (path.resolve(source) !== path.resolve(destination)) fs.copyFileSync(source, destination);
    manifest[sourceBase] = `assets/${destinationName}`;
    html = setMeta(html, metaName, `./assets/${destinationName}`);
    if (sourceBase === 'Salehin-Noback') {
      html = html.replace(/<img id="modernBrandLogo"[^>]*>/i, `<img id="modernBrandLogo" src="./assets/${destinationName}" alt="">`);
    } else if (sourceBase === 'Salehin-NobackText') {
      html = html.replace(/<img id="modernBrandLogoFull"[^>]*>/i, `<img id="modernBrandLogoFull" class="modern-brand-full" src="./assets/${destinationName}" alt="">`);
      html = html.replace('<p class="eyebrow" id="modernGateBrandFallback">مدرسه صالحین</p>', '<p class="eyebrow" id="modernGateBrandFallback" hidden>مدرسه صالحین</p>');
    }
  }
  if (manifest['Salehin-Noback'] && manifest['Salehin-Noback'] !== 'found-but-unrecognized') {
    html = html.replace('<span id="modernBrandFallback">ص</span>', '<span id="modernBrandFallback" hidden>ص</span>');
  }
  return { html, manifest };
}

async function ask(rl, label, fallback = '') {
  const suffix = fallback ? ` [${fallback}]` : '';
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer || fallback;
}
async function confirm(rl, message, expected = 'yes') {
  const answer = (await rl.question(`${message} Type ${expected} to continue: `)).trim();
  return answer.toLowerCase() === expected.toLowerCase();
}
async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    console.log('\nSalehinSc setup wizard');
    console.log('This wizard edits deployment configuration only. It never force-pushes or deletes .git.\n');
    const git = gitInfo();
    if (git.exists) {
      if (path.resolve(git.top) !== ROOT) throw new Error(`Run setup from the Git root: ${git.top}`);
      console.log(`Git repository: ${git.top}`);
      console.log(`Current branch: ${git.branch || '(unborn / detached)'}`);
      console.log(`Origin: ${git.origin || '(not configured)'}`);
      if (git.dirty) {
        console.log('\n[NOTICE] There are uncommitted changes. They will be preserved, but review them before committing.');
      }
    } else {
      console.log('No .git repository was found.');
    }

    const currentToml = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');
    const currentRepo = /GITHUB_REPOSITORY\s*=\s*["']([^"']+)["']/.exec(currentToml)?.[1] || '';
    const [defaultOwner, defaultRepo] = currentRepo.split('/');
    const owner = await ask(rl, 'GitHub username / organization', defaultOwner || '');
    const repo = await ask(rl, 'Repository name', defaultRepo || '');
    const branchDefault = /GITHUB_BRANCH\s*=\s*["']([^"']+)["']/.exec(currentToml)?.[1] || 'main';
    const branch = await ask(rl, 'Default branch', branchDefault);
    const target = validateTarget(owner, repo, branch);
    if (git.exists && git.branch && git.branch !== target.branch) console.log(`[NOTICE] Current branch is ${git.branch}; target branch is ${target.branch}. The wizard will not switch branches automatically.`);
    const schoolName = await ask(rl, 'School / application name', 'مدرسه صالحین');
    if (!schoolName || schoolName.length > 160) throw new Error('School name must contain 1–160 characters.');
    const pageUrl = pagesUrl(target.owner, target.repo);
    const allowedOrigin = originFor(pageUrl);
    console.log(`\nExpected GitHub Pages URL: ${pageUrl}`);
    const customOrigin = await ask(rl, 'Pages origin (leave default unless using a custom domain)', allowedOrigin);
    let parsedOrigin;
    try { parsedOrigin = new URL(customOrigin); } catch { throw new Error('Pages origin must be a valid URL.'); }
    if (parsedOrigin.protocol !== 'https:' || parsedOrigin.origin !== customOrigin.replace(/\/$/, '')) throw new Error('Pages origin must be an HTTPS origin without a path.');
    const workerUrl = await ask(rl, 'Cloudflare Worker URL (blank keeps current value)', '');
    if (workerUrl) {
      let parsedWorker;
      try { parsedWorker = new URL(workerUrl); } catch { throw new Error('Worker URL must be a valid HTTPS URL.'); }
      if (parsedWorker.protocol !== 'https:' || !parsedWorker.hostname.endsWith('.workers.dev')) throw new Error('Use the deployed HTTPS workers.dev URL.');
    }

    const wranglerNext = updateWrangler(currentToml, target, parsedOrigin.origin);
    let index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    index = setMeta(index, 'salehin-repository', `${target.owner}/${target.repo}`);
    index = setMeta(index, 'salehin-branch', target.branch);
    index = setMeta(index, 'salehin-school-name', schoolName);
    if (workerUrl) index = setMeta(index, 'salehin-api', workerUrl.replace(/\/$/, ''));
    index = setTitle(index, schoolName);
    const branding = updateBrandAssets(ROOT, index);
    index = branding.html;

    const wranglerPath = path.join(ROOT, 'wrangler.toml');
    const indexPath = path.join(ROOT, 'index.html');
    const wranglerChanged = wranglerNext !== currentToml;
    const indexOriginal = fs.readFileSync(indexPath, 'utf8');
    const indexChanged = index !== indexOriginal;
    console.log('\nPlanned changes:');
    console.log(`  wrangler.toml: ${wranglerChanged ? 'update repository, branch and allowed Pages origin' : 'no change'}`);
    console.log(`  index.html: ${indexChanged ? 'set dynamic repository / branch / school name and optional Worker URL' : 'no change'}`);
    console.log(`  .git: ${git.exists ? 'preserve existing history and remotes' : 'offer safe git init'}`);
    if (Object.keys(branding.manifest).length) console.log(`  Logo assets: ${JSON.stringify(branding.manifest)}`);
    else console.log('  Logo assets: not found; existing monogram fallback will remain.');
    if (!await confirm(rl, '\nApply these local configuration changes?')) throw new Error('No changes applied.');

    if (wranglerChanged) fs.writeFileSync(wranglerPath, wranglerNext, 'utf8');
    if (indexChanged) fs.writeFileSync(indexPath, index, 'utf8');

    let remote = git.origin;
    if (!git.exists) {
      if (await confirm(rl, 'Initialize a new Git repository here?', 'init')) {
        run('git', ['init', '-b', target.branch]);
        remote = '';
      }
    }
    if ((git.exists || fs.existsSync(path.join(ROOT, '.git'))) && !remote) {
      if (await confirm(rl, `Add origin ${remoteUrl(target.owner, target.repo)}?`, 'add')) {
        run('git', ['remote', 'add', 'origin', remoteUrl(target.owner, target.repo)]);
        remote = remoteUrl(target.owner, target.repo);
      }
    } else if (remote && remote.toLowerCase() !== remoteUrl(target.owner, target.repo).toLowerCase()) {
      console.log(`\nExisting origin: ${remote}`);
      if (await confirm(rl, `Change origin to ${remoteUrl(target.owner, target.repo)}?`, 'change')) {
        run('git', ['remote', 'set-url', 'origin', remoteUrl(target.owner, target.repo)]);
        remote = remoteUrl(target.owner, target.repo);
      }
    }

    const catalogPath = path.join(ROOT, 'data', 'portal.json');
    if (!fs.existsSync(catalogPath)) {
      if (await confirm(rl, 'No data/portal.json exists. Generate a fresh administrator seed now?', 'generate')) {
        run(process.execPath, ['scripts/bootstrap-portal.cjs', '--owner', target.owner, '--repo', target.repo, '--branch', target.branch, '--name', 'مدیر مدرسه'], { inherit: true });
      }
    } else {
      let catalog;
      try { catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')); } catch { throw new Error('data/portal.json is not valid JSON; no data migration was attempted.'); }
      const expected = `SalehinSc:v4:${target.owner.toLowerCase()}/${target.repo.toLowerCase()}:${target.branch}:data/portal.json`;
      if (catalog.scope !== expected) {
        console.log('\n[NOTICE] data/portal.json belongs to a different repository / branch. Existing data was left untouched.');
        console.log('For a genuinely new school, back up data/ first, then run bootstrap manually with --replace-seed after checking that this is not live school data.');
      } else {
        console.log('\nExisting catalogue matches the selected repository and branch. It was preserved.');
      }
    }

    console.log('\nSetup summary:');
    console.log(`  Repository: ${target.owner}/${target.repo}`);
    console.log(`  Branch: ${target.branch}`);
    console.log(`  GitHub Pages: ${pageUrl}`);
    console.log(`  Pages source: GitHub Actions (select this in repository Settings > Pages).`);
    console.log(`  Worker: configure GITHUB_TOKEN with Wrangler, then deploy worker/ using wrangler.toml.`);
    console.log(`  Remote: ${remote || '(not configured; no remote change made)'}`);
    if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
      if (await confirm(rl, 'Dependencies are not installed. Run npm ci now?', 'install')) run('npm', ['ci'], { inherit: true });
    } else console.log('  Dependencies: node_modules already exists; npm ci was skipped.');
    console.log('\nNo commit, push, force-push, remote repository creation, or secret entry was performed.');
  } finally { rl.close(); }
}

if (require.main === module) main().catch(error => { console.error(`\n[SETUP ERROR] ${error.message}`); process.exitCode = 1; });

module.exports = { validateTarget, pagesUrl, originFor, setTomlValue, updateWrangler, setMeta, setTitle, findLogo, normalizedExt, updateBrandAssets, remoteUrl };
