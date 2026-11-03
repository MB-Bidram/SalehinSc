'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { buildTeacherLauncherHtml, normalizeAppUrl } = require('../teacher-local.js');
const { cleanupRetiredTeacherQr } = require('../scripts/cleanup-retired-teacher-qr.cjs');

const credential = { id: 'a'.repeat(64), key: 'A'.repeat(43), revision: 'b'.repeat(32) };

test('private teacher.html is a local launcher that redirects to the project URL with the access fragment', () => {
  const html = buildTeacherLauncherHtml({ appUrl: 'https://mb-bidram.github.io/SalehinSc/', ...credential });
  assert.match(html, /noindex,nofollow,noarchive/);
  assert.match(html, /no-referrer/);
  assert.match(html, /location\.replace\(destination\)/);
  assert.match(html, /https:\/\/mb-bidram\.github\.io\/SalehinSc\/#s=/);
  assert.match(html, /&r=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/);
  assert.doesNotMatch(html, /GITHUB_TOKEN|github_pat_|ghp_/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  let destination = '';
  vm.runInNewContext(script, {
    document: { getElementById: () => ({ href: '' }) },
    location: { replace: value => { destination = value; } }
  });
  const parsed = new URL(destination);
  assert.equal(parsed.pathname, '/SalehinSc/');
  assert.equal(new URLSearchParams(parsed.hash.slice(1)).get('s'), credential.id);
  assert.equal(new URLSearchParams(parsed.hash.slice(1)).get('k'), credential.key);
});

test('teacher launcher validates credentials and rejects unsafe app URLs', () => {
  assert.throws(() => normalizeAppUrl('http://example.com/SalehinSc/'), /HTTPS/);
  assert.throws(() => normalizeAppUrl('https://example.com/path/?token=secret'), /query/);
  assert.throws(() => buildTeacherLauncherHtml({ appUrl: 'https://example.com/', ...credential, key: 'bad' }), /اعتبارنامه/);
});

test('teacher access is a private local file, not a published page or teacher QR workflow', () => {
  const index = fs.readFileSync('index.html', 'utf8');
  const app = fs.readFileSync('app.js', 'utf8');
  const ignore = fs.readFileSync('.gitignore', 'utf8');
  const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
  const bootstrap = fs.readFileSync('scripts/bootstrap-portal.cjs', 'utf8');
  assert.match(index, /id="modernTeacherFile"/);
  assert.match(index, /teacher\.html/);
  assert.doesNotMatch(index, /ورود با QR دبیران|چاپ QR دبیران|تعویض QR دبیران|href="\.\/teacher\//);
  assert.match(app, /rotateLocalTeacherAccess/);
  assert.match(app, /buildTeacherLauncherHtml/);
  assert.match(app, /const qr=this\.readModernQr\(\);[\s\S]*?if\(location\.hash\)history\.replaceState/);
  assert.doesNotMatch(app, /exportStaffQrCredential|printTeacherQr|rotateTeacherQr|teacherQrUrl/);
  assert.match(ignore, /^teacher\.html$/m);
  assert.match(ignore, /^teacher\/$/m);
  assert.match(ignore, /^tools\/staff-qr-maker\.html$/m);
  assert.match(workflow, /--exclude='teacher\.html'/);
  assert.match(workflow, /--exclude='teacher\/'/);
  assert.match(workflow, /--exclude='tools\/staff-qr-maker\.html'/);
  assert.match(bootstrap, /buildTeacherLauncherHtml/);
  assert.match(bootstrap, /Created local-only teacher\.html/);
  assert.equal(fs.existsSync('teacher/index.html'), false);
  assert.equal(fs.existsSync('tools/staff-qr-maker.html'), false);
});

test('retired teacher QR cleanup removes only the known legacy files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'salehinsc-retired-qr-'));
  try {
    fs.mkdirSync(path.join(root, 'teacher'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
    fs.writeFileSync(path.join(root, 'teacher', 'index.html'), 'old public entry');
    fs.writeFileSync(path.join(root, 'tools', 'staff-qr-maker.html'), 'old QR maker');
    fs.writeFileSync(path.join(root, 'tools', 'keep-me.txt'), 'unrelated tool');
    assert.equal(cleanupRetiredTeacherQr(root), 2);
    assert.equal(fs.existsSync(path.join(root, 'teacher', 'index.html')), false);
    assert.equal(fs.existsSync(path.join(root, 'tools', 'staff-qr-maker.html')), false);
    assert.equal(fs.readFileSync(path.join(root, 'tools', 'keep-me.txt'), 'utf8'), 'unrelated tool');
    assert.equal(fs.existsSync(path.join(root, 'tools')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('student QR generation remains rooted at the GitHub Pages project URL', () => {
  const app = fs.readFileSync('app.js', 'utf8');
  assert.match(app, /studentQrUrl\(entry\)/);
  assert.match(app, /studentQrUrl\(entry\)[\s\S]*?url\.hash=SalehinBackend\.makeQrFragment/);
});
