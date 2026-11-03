'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { parseHTML } = require('linkedom');
const { indexedDB } = require('fake-indexeddb');
global.indexedDB = indexedDB;
const { DeviceStore } = require('../backend.js');

test('IndexedDB encrypts local vault/session values and reuses a nonextractable device key', async () => {
  const scope = `storage-test-${webcrypto.randomUUID()}`; const store = new DeviceStore(scope);
  await store.set('student-session', { key: 'test-private-key', id: 'test-account' });
  const reloaded = new DeviceStore(scope);
  assert.deepEqual(await reloaded.get('student-session'), { key: 'test-private-key', id: 'test-account' });
  const db = await store.db();
  const stored = await new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly'); const request = tx.objectStore('kv').get(`${scope}:student-session`);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  assert.equal(stored.algorithm, 'A256GCM'); assert.ok(!JSON.stringify(stored).includes('test-private-key'));
  const deviceKey = await reloaded.deviceKey(); assert.equal(deviceKey.extractable, false);
  await assert.rejects(webcrypto.subtle.exportKey('raw', deviceKey));
  const isolated = new DeviceStore(`${scope}-another-repo`); assert.equal(await isolated.get('student-session'), null);
  await reloaded.delete('student-session'); assert.equal(await store.get('student-session'), null);
  db.close(); (await reloaded.db()).close(); (await isolated.db()).close();
});

test('simultaneous first writes share the same device key rather than losing local secrets', async () => {
  const scope = `storage-race-${webcrypto.randomUUID()}`;
  const one = new DeviceStore(scope), two = new DeviceStore(scope);
  await Promise.all([one.set('one', { value: 1 }), two.set('two', { value: 2 })]);
  assert.deepEqual(await one.get('two'), { value: 2 }); assert.deepEqual(await two.get('one'), { value: 1 });
  (await one.db()).close(); (await two.db()).close();
});

async function page(role = 'student') {
  const { document, window } = parseHTML(fs.readFileSync('index.html', 'utf8'));
  const calls = [], revoked = [], session = new Map();
  const location = { protocol: 'http:', hostname: '127.0.0.1', href: 'http://127.0.0.1:8080/?preview=' + role, pathname: '/', search: '?preview=' + role, hash: '' };
  window.location = location;
  for (const form of document.querySelectorAll('form')) form.reset = () => {
    for (const input of form.querySelectorAll('input,textarea')) { if (input.type === 'checkbox') input.checked = false; else input.value = ''; }
  };
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => { dialog.removeAttribute('open'); dialog.dispatchEvent(new window.Event('close')); };
  }
  for (const select of document.querySelectorAll('select')) {
    let value = select.querySelector('option')?.value || '';
    Object.defineProperty(select, 'value', { configurable: true, get: () => value, set: next => { value = String(next); } });
  }
  for (const input of document.querySelectorAll('input')) { input.setCustomValidity = () => {}; input.reportValidity = () => true; }
  const sessionStorage = { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, String(value)), removeItem: key => session.delete(key) };
  const context = vm.createContext({
    document, window, location, navigator: {}, sessionStorage,
    history: { replaceState(_state, _title, url) { location.hash = ''; if (url) location.href = 'http://127.0.0.1:8080/' + String(url).replace(/^\//, ''); } },
    crypto: webcrypto,
    URL: class extends URL { static createObjectURL() { return 'blob:test'; } static revokeObjectURL(url) { revoked.push(url); } },
    URLSearchParams, Blob, File, TextEncoder, TextDecoder, structuredClone, console, Intl, Date,
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    SalehinBackend: { generateLoginKey: () => 'generated-test-login-key' },
    SalehinRoles: { MAX_FILE_BYTES: 8388608, MAX_BATCH_BYTES: 16777216 }
  });
  vm.runInContext(fs.readFileSync('preview.js', 'utf8'), context);
  const Base = context.SalehinPreview;
  class FakePortal extends Base {
    constructor() { super(role); this.calls = calls; }
    async publishMessage(input) { calls.push(input); return { status: 'published' }; }
    async logout() { calls.push('logout'); return super.logout(); }
  }
  context.SalehinRoles.RolePortal = FakePortal;
  vm.runInContext(fs.readFileSync('config.js', 'utf8'), context);
  const source = fs.readFileSync('app.js', 'utf8');
  vm.runInContext(source.slice(0, source.lastIndexOf('startSchool().catch')), context);
  await vm.runInContext('var ui=new SchoolUI(new SalehinRoles.RolePortal(SALEHIN_CONFIG));ui.init()', context);
  return { context, document, calls, revoked, ui: vm.runInContext('ui', context) };
}

test('QR-first shell opens records immediately and shows teacher tools in the same interface', async () => {
  for (const role of ['student', 'teacher', 'admin']) {
    const { ui, document } = await page(role);
    assert.equal(document.getElementById('modernGate').hidden, true, document.getElementById('modernGateStatus').textContent || 'Modern dashboard did not open.');
    assert.equal(document.getElementById('modernDashboard').hidden, false);
    // Admin is the shared staff roster, not an individual student/teacher dossier.
    const sharedStaff = role === 'admin';
    assert.equal(document.getElementById('modernStudentName').textContent,
      sharedStaff ? 'پنل دبیران' : ui.view.profile.name);
    assert.equal(document.getElementById('modernTeacherTools').hidden, role === 'student');
    assert.equal(document.getElementById('modernRosterSection').hidden, !sharedStaff);
    assert.equal(document.getElementById('modernToolbar').hidden, sharedStaff);
    assert.equal(document.querySelectorAll('#modernGate input,#modernGate select').length, 0);
  }
});

test('teacher can submit a score and a message from the unified dashboard', async () => {
  const { ui, document, calls } = await page('teacher');
  await ui.openModernScore();
  const scoreStudent = document.getElementById('modernScoreStudent');
  scoreStudent.value = 'sample-student-1';
  document.getElementById('modernScoreTitle').value = 'آزمون ریاضی';
  document.getElementById('modernScoreValue').value = '18';
  document.getElementById('modernScoreTotal').value = '20';
  document.getElementById('modernScoreFeedback').value = 'پیشرفت خوب';
  await ui.saveModernScore({ preventDefault() {} });
  const score = calls.find(item => item.category === 'score');
  assert.ok(score); assert.deepEqual(Array.from(score.recipients), ['sample-student-1']);
  assert.deepEqual(JSON.parse(JSON.stringify(score.score)), { title: 'آزمون ریاضی', score: 18, total: 20, feedback: 'پیشرفت خوب' });

  await ui.openModernMessage();
  document.getElementById('modernMessageStudent').value = '__all__';
  document.getElementById('modernMessageTitle').value = 'اطلاعیه کلاس';
  document.getElementById('modernMessageBody').value = 'فردا کتاب علوم را همراه داشته باشید.';
  document.getElementById('modernMessageAnnouncement').checked = true;
  await ui.saveModernMessage({ preventDefault() {} });
  const message = calls.find(item => item.category === 'announcement');
  assert.ok(message); assert.deepEqual(Array.from(message.recipients), ['sample-student-1', 'sample-student-2', 'sample-student-3']);
});

test('modern message rendering treats titles and bodies as text, not executable HTML', async () => {
  const { ui, document } = await page('student');
  ui.view.messages[0].title = '<script>unsafe</script>';
  ui.view.messages[0].blocks = [{ type: 'text', text: '<img src=x onerror=alert(1)>' }];
  ui.renderModern();
  const feed = document.getElementById('modernMessages');
  assert.equal(feed.querySelectorAll('script,img').length, 0);
  assert.ok(feed.textContent.includes('<script>unsafe</script>'));
  assert.ok(feed.textContent.includes('<img src=x onerror=alert(1)>'));
});

test('ending a QR view clears the account and returns to the scan instruction', async () => {
  const { ui, document, calls } = await page('teacher');
  await ui.logout();
  assert.ok(calls.includes('logout'));
  assert.equal(ui.view, null);
  assert.equal(document.getElementById('modernGate').hidden, false);
  assert.equal(document.getElementById('modernDashboard').hidden, true);
  assert.equal(document.getElementById('modernMessages').textContent, '');
  assert.equal(document.getElementById('modernScores').textContent, '');
  assert.ok(document.getElementById('modernQrLink'), 'QR link input remains mounted after logout');
});

test('logout hides decrypted data even when local session cleanup fails', async () => {
  const { ui, document, calls } = await page('teacher');
  ui.portal.logout = async () => { calls.push('logout'); throw new Error('simulated storage failure'); };
  await ui.logout();
  assert.ok(calls.includes('logout'));
  assert.equal(ui.view, null);
  assert.equal(document.getElementById('modernGate').hidden, false);
  assert.equal(document.getElementById('modernDashboard').hidden, true);
  assert.equal(document.getElementById('modernMessages').textContent, '');
  assert.equal(document.getElementById('modernScores').textContent, '');
  assert.ok(document.getElementById('modernQrLink'), 'QR link input remains mounted after logout failure');
});

test('production shell is light-only, RTL, responsive and loads local assets', () => {
  const { document } = parseHTML(fs.readFileSync('index.html', 'utf8'));
  const ids = Array.from(document.querySelectorAll('[id]'), node => node.id);
  assert.equal(ids.length, new Set(ids).size, 'DOM IDs must be unique');
  assert.equal(document.documentElement.getAttribute('dir'), 'rtl');
  const brandLogo = document.querySelector('.modern-brand-mark img');
  assert.ok(document.getElementById('modernBrandLogoFull'), 'full wordmark slot must exist on the welcome screen');
  assert.ok(brandLogo, 'compact school logo slot must exist');
  if (brandLogo.getAttribute('src')) {
    const logoPath = brandLogo.getAttribute('src').replace(/^\.\//, '');
    assert.ok(fs.existsSync(logoPath), `Missing configured school logo ${logoPath}`);
  } else {
    assert.ok(document.getElementById('modernBrandFallback'), 'neutral fallback remains until original logo artwork is supplied');
  }
  assert.ok(document.getElementById('modernGate'));
  assert.ok(document.getElementById('modernScores'));
  assert.ok(document.getElementById('modernMessages'));
  assert.ok(document.getElementById('modernTeacherTools'));
  for (const node of document.querySelectorAll('script[src],link[href]')) {
    const path = node.getAttribute('src') || node.getAttribute('href');
    assert.ok(fs.existsSync(path), `Missing local asset ${path}`);
  }
  for (const file of ['modern.css', 'assets/vazirmatn-arabic-400-normal.woff2', 'assets/vazirmatn-arabic-600-normal.woff2', 'preview.js']) assert.ok(fs.existsSync(file));
  const styles = fs.readFileSync('modern.css', 'utf8');
  assert.match(styles, /color-scheme\s*:\s*light/);
  assert.doesNotMatch(styles, /prefers-color-scheme\s*:\s*dark/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media\s*\(max-width:/);
  const setupBat = fs.readFileSync('setup-salehinsc.bat', 'utf8');
  assert.match(setupBat, /where git/i);
  assert.match(setupBat, /where node/i);
  assert.match(setupBat, /scripts\\setup-salehinsc\.cjs/i);
  assert.doesNotMatch(setupBat, /push\s+--force|del\s+\/s\s+\.git/i);
  const shell = styles.match(/body>\s*\.school-header,body>\s*\.navigation-band,body>\s*#mainContent\{display:none!important\}/);
  assert.ok(shell, 'legacy login/admin shell must remain hidden behind the QR-first product UI');
  // Student/admin aliases are public redirects. The teacher launcher is generated
  // locally after setup and is deliberately not a repository or Pages asset.
  for (const role of ['student', 'admin']) assert.ok(fs.readFileSync(`${role}.html`, 'utf8').includes('href="./"'));
  const ignore = fs.readFileSync('.gitignore', 'utf8');
  const pagesWorkflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
  const bootstrap = fs.readFileSync('scripts/bootstrap-portal.cjs', 'utf8');
  assert.match(ignore, /^teacher\.html$/m);
  assert.match(pagesWorkflow, /--exclude='teacher\.html'/);
  assert.match(bootstrap, /Created local-only teacher\.html/);
  assert.equal(JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8')).start_url, './');
});

test('service worker bypasses encrypted data and keeps the modern stylesheet in its shell', async () => {
  const events = {};
  const context = vm.createContext({
    self: { location: { origin: 'http://localhost' }, addEventListener: (type, handler) => { events[type] = handler; } },
    URL, Request, Response, fetch: async () => { throw new Error('Offline'); },
    caches: { match: async path => path === './index.html' ? new Response('<html>app</html>') : undefined }
  });
  vm.runInContext(fs.readFileSync('sw.js', 'utf8'), context);
  const shell = vm.runInContext('SHELL', context);
  assert.ok(shell.includes('./modern.css'));
  for (const asset of shell) assert.ok(asset === './' || fs.existsSync(asset), `Missing shell asset ${asset}`);
  for (const path of ['data/portal.json', 'data/students/test.json', 'data/attachments/test.bin', 'data/messages/test.json']) {
    let intercepted = false;
    events.fetch({ request: new Request(`http://localhost/${path}`), respondWith() { intercepted = true; } });
    assert.equal(intercepted, false);
  }
  let result;
  events.fetch({ request: new Request('http://localhost/backend.js'), respondWith(promise) { result = promise; } });
  assert.equal((await result).type, 'error');
});
