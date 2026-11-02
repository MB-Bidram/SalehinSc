'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Portal, GitHubRepository, generateLoginKey, emptyCatalog, prepareImage, MAX_IMAGE_BYTES } = require('../backend.js');
const config = { owner: 'test-school', repo: 'portal', branch: 'main', dataPath: 'data/portal.json', apiVersion: '2026-03-10' };
const password = 'correct horse battery staple';
const profile = { name: 'دانش آموز تست', grade: 'نهم', assessments: [{ title: 'ریاضی', score: 18, total: 20 }] };
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
const image = () => new File([png], 'private-student-photo.png', { type: 'image/png' });
class MemoryStore {
  constructor() { this.values = new Map(); }
  async get(key) { return this.values.has(key) ? structuredClone(this.values.get(key)) : null; }
  async set(key, value) { this.values.set(key, structuredClone(value)); }
  async delete(key) { this.values.delete(key); }
}
class MemoryRepository {
  constructor() { this.catalog = null; this.head = 0; this.files = new Map(); this.failNextCommit = false; }
  async connect() { return { full_name: 'test-school/portal' }; }
  disconnect() {}
  async snapshot(scope) { return { head: this.head, catalog: structuredClone(this.catalog || emptyCatalog(scope)) }; }
  async commit(snapshot, catalog, files = []) {
    if (this.failNextCommit || snapshot.head !== this.head) {
      this.failNextCommit = false; const error = new Error('Conflict'); error.code = 'CONFLICT'; throw error;
    }
    for (const file of files) this.files.set(file.path, file.binary ? file.content.slice() : JSON.parse(file.content));
    this.catalog = structuredClone(catalog); this.head++;
    return { head: this.head, catalog };
  }
  async readPublic(path) {
    if (path === config.dataPath) return structuredClone(this.catalog);
    if (!this.files.has(path)) throw new Error('Not found');
    const value = this.files.get(path); return value instanceof Uint8Array ? value.slice() : structuredClone(value);
  }
}
async function fixture() {
  const repository = new MemoryRepository(); const store = new MemoryStore();
  const admin = new Portal(config, { repository, store }); await admin.connectAdmin('test-token');
  const loginKey = generateLoginKey(); const created = await admin.createStudent({ loginKey, password, profile });
  const studentStore = new MemoryStore(); const student = new Portal(config, { repository, store: studentStore });
  return { repository, store, admin, loginKey, created, student, studentStore };
}
test('repository contains encrypted profiles and wrapped keys, without plaintext credentials or PII', async () => {
  const { repository, loginKey } = await fixture(); const text = JSON.stringify(repository.catalog);
  for (const secret of [profile.name, profile.grade, password, loginKey, 'test-token', 'ریاضی']) assert.ok(!text.includes(secret));
  assert.equal(repository.catalog.version, 4);
  assert.equal(repository.catalog.students[0].auth.kdf.iterations, 600000);
});
test('student signs in and stays signed in across a fresh Portal instance; logout propagates', async () => {
  const { student, studentStore, repository, loginKey } = await fixture();
  const view = await student.login(loginKey, password); assert.deepEqual(view.profile, profile);
  const reloaded = new Portal(config, { repository, store: studentStore });
  assert.equal((await reloaded.refreshStudent()).profile.name, profile.name);
  await reloaded.logout(); assert.equal(await student.refreshStudent(), null);
  assert.ok(!JSON.stringify([...studentStore.values.values()]).includes(password));
});
test('unknown login and incorrect password fail with the same error', async () => {
  const { student, loginKey } = await fixture();
  await assert.rejects(student.login(loginKey, 'wrong password 123'), { code: 'LOGIN_FAILED' });
  await assert.rejects(student.login(generateLoginKey(), password), { code: 'LOGIN_FAILED' });
  assert.equal(await student.refreshStudent(), null);
});
test('students cannot read another student profile or announcements', async () => {
  const { admin, student, repository, loginKey, created } = await fixture();
  const otherLogin = generateLoginKey(); const other = await admin.createStudent({ loginKey: otherLogin, password, profile: { ...profile, name: 'Another student' } });
  await admin.publishAnnouncement({ title: 'Private news', body: 'Only first student', recipients: [created.id] });
  assert.equal((await student.login(loginKey, password)).announcements.length, 1);
  const outsiderStore = new MemoryStore();
  const outsider = new Portal(config, { repository, store: outsiderStore });
  const outsiderView = await outsider.login(otherLogin, password);
  assert.equal(outsiderView.announcements.length, 0); assert.equal(outsiderView.id, other.id);
  const first = repository.catalog.students.find(item => item.id === created.id);
  const second = repository.catalog.students.find(item => item.id === other.id);
  const original = repository.files.get(`data/students/${second.id}.json`);
  repository.files.set(`data/students/${second.id}.json`, repository.files.get(`data/students/${first.id}.json`));
  const freshOutsider = new Portal(config, { repository, store: outsiderStore });
  await assert.rejects(freshOutsider.refreshStudent());
  repository.files.set(`data/students/${second.id}.json`, original);
});
test('record tampering is rejected and images use distinct keys and authenticated bytes', async () => {
  const { admin, student, repository, loginKey, created } = await fixture();
  await admin.updateStudent(created.id, { images: [image(), image()], expectedRevision: created.revision });
  const view = await student.login(loginKey, password); assert.equal(view.attachments.length, 2);
  assert.notEqual(view.attachments[0].key, view.attachments[1].key);
  const blob = await student.readImage(view.attachments[0]); assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), png);
  const remote = repository.files.get(view.attachments[0].path); assert.notDeepEqual(remote, png);
  for (const secret of [view.attachments[0].name, view.attachments[0].key]) assert.ok(!JSON.stringify(repository.catalog).includes(secret));
  remote[0] ^= 1; await assert.rejects(student.readImage(view.attachments[0]));
  await assert.rejects(student.readImage({ ...view.attachments[1], path: 'https://evil.example/image' }), { code: 'INVALID_DATA' });
});
test('announcements support encrypted images and selected recipients', async () => {
  const { admin, student, loginKey, created, repository } = await fixture();
  const { id, revision } = await admin.publishAnnouncement({ title: 'School trip', body: 'Private destination', recipients: [created.id], images: [image()] });
  const view = await student.login(loginKey, password);
  assert.equal(view.announcements[0].title, 'School trip');
  assert.deepEqual(new Uint8Array(await (await student.readImage(view.announcements[0].attachments[0])).arrayBuffer()), png);
  assert.ok(!JSON.stringify(repository.catalog).includes('Private destination'));
  assert.equal((await admin.listAnnouncements())[0].data.title, 'School trip');
  await admin.deleteAnnouncement(id, revision); assert.equal((await student.refreshStudent()).announcements.length, 0);
});
test('score updates retain image descriptors and announcement grants', async () => {
  const { admin, student, loginKey, created } = await fixture();
  await admin.publishAnnouncement({ title: 'News', recipients: [created.id] });
  let current = (await admin.listStudents())[0];
  await admin.updateStudent(created.id, { expectedRevision: current.revision, images: [image()] });
  current = (await admin.listStudents())[0];
  await admin.updateStudent(created.id, { profile: { ...profile, note: 'New note' }, expectedRevision: current.revision });
  const view = await student.login(loginKey, password);
  assert.equal(view.attachments.length, 1); assert.equal(view.announcements.length, 1); assert.equal(view.profile.note, 'New note');
});
test('credential resets rotate keys and invalidate existing sessions; old credentials fail', async () => {
  const { admin, student, studentStore, repository, loginKey, created } = await fixture();
  await student.login(loginKey, password);
  await admin.resetCredentials(created.id, { loginKey, password: 'a completely new password', expectedRevision: created.revision });
  const reloaded = new Portal(config, { repository, store: studentStore });
  await assert.rejects(reloaded.refreshStudent(), { code: 'SESSION_REVOKED' });
  await assert.rejects(student.login(loginKey, password), { code: 'LOGIN_FAILED' });
  assert.equal((await student.login(loginKey, 'a completely new password')).profile.name, profile.name);
});
test('failed credential reset keeps the previous admin key and working student login', async () => {
  const { admin, student, repository, loginKey, created } = await fixture();
  repository.failNextCommit = true;
  await assert.rejects(admin.resetCredentials(created.id, { loginKey, password: 'a completely new password', expectedRevision: created.revision }), { code: 'CONFLICT' });
  assert.equal((await admin.listStudents())[0].dossier.profile.name, profile.name);
  assert.equal((await student.login(loginKey, password)).profile.name, profile.name);
});
test('login key changes preserve images and revoke the old account', async () => {
  const { admin, student, loginKey, created } = await fixture();
  await admin.updateStudent(created.id, { expectedRevision: created.revision, images: [image()] });
  const current = (await admin.listStudents())[0]; const nextLogin = generateLoginKey();
  await student.login(loginKey, password);
  await admin.resetCredentials(created.id, { expectedRevision: current.revision, loginKey: nextLogin, password });
  await assert.rejects(student.refreshStudent(), { code: 'SESSION_REVOKED' });
  const view = await student.login(nextLogin, password); assert.equal(view.attachments.length, 1);
});
test('disable and deletion invalidate persistent sessions', async () => {
  const { admin, student, loginKey, created } = await fixture();
  await student.login(loginKey, password); await admin.setStudentDisabled(created.id, true, created.revision);
  await assert.rejects(student.refreshStudent(), { code: 'SESSION_REVOKED' });
  await assert.rejects(student.login(loginKey, password), { code: 'LOGIN_FAILED' });
  await admin.setStudentDisabled(created.id, false, created.revision);
  await student.login(loginKey, password); await admin.deleteStudent(created.id, created.revision);
  await assert.rejects(student.refreshStudent(), { code: 'SESSION_REVOKED' });
});
test('password-encrypted backup restores a new admin device, including image and announcement keys', async () => {
  const { admin, repository, created } = await fixture();
  await admin.updateStudent(created.id, { expectedRevision: created.revision, images: [image()] });
  await admin.publishAnnouncement({ title: 'A private announcement', recipients: [created.id] });
  const backup = await admin.exportKeys('separate backup password');
  assert.ok(!JSON.stringify(backup).includes('loginKey'));
  const second = new Portal(config, { repository, store: new MemoryStore() }); await second.connectAdmin('another-test-token');
  assert.equal((await second.listStudents())[0].dossier, null);
  await assert.rejects(second.importKeys(backup, 'incorrect backup password'));
  await second.importKeys(backup, 'separate backup password');
  const restored = (await second.listStudents())[0]; assert.equal(restored.dossier.profile.name, profile.name);
  assert.deepEqual(new Uint8Array(await (await second.readImage(restored.dossier.attachments[0])).arrayBuffer()), png);
  assert.equal((await second.listAnnouncements())[0].data.title, 'A private announcement');
});
test('stale backups merge without overwriting newly rotated keys', async () => {
  const { admin, loginKey, created } = await fixture(); const backup = await admin.exportKeys('backup password 123');
  await admin.resetCredentials(created.id, { loginKey, password: 'another student password', expectedRevision: created.revision });
  await admin.importKeys(backup, 'backup password 123');
  assert.equal((await admin.listStudents())[0].dossier.profile.name, profile.name);
});
test('concurrent/stale updates and deletes never overwrite a newer record', async () => {
  const { admin, created } = await fixture();
  await admin.updateStudent(created.id, { expectedRevision: created.revision, profile: { ...profile, note: 'First save' } });
  await assert.rejects(admin.updateStudent(created.id, { expectedRevision: created.revision, profile }), { code: 'CONFLICT' });
  await assert.rejects(admin.deleteStudent(created.id, created.revision), { code: 'CONFLICT' });
  assert.equal((await admin.listStudents())[0].dossier.profile.note, 'First save');
});
test('storage failure prevents publication; failed publication retains recovery keys', async () => {
  const { admin, repository, store } = await fixture(); const before = repository.head;
  const originalSet = store.set.bind(store); store.set = async () => { throw new Error('Quota exceeded'); };
  await assert.rejects(admin.createStudent({ password, profile }), /Quota exceeded/); assert.equal(repository.head, before);
  store.set = originalSet; repository.failNextCommit = true;
  await assert.rejects(admin.createStudent({ password, profile }), { code: 'CONFLICT' });
  assert.equal(Object.keys((await store.get('admin-vault')).students).length, 2);
});
test('unsupported images, MIME mismatches and oversized images are rejected', async () => {
  await assert.rejects(prepareImage(new File(['<svg></svg>'], 'x.svg', { type: 'image/svg+xml' }), 'scope'), { code: 'INVALID_IMAGE' });
  await assert.rejects(prepareImage(new File([png], 'x.jpg', { type: 'image/jpeg' }), 'scope'), { code: 'INVALID_DATA' });
  await assert.rejects(prepareImage({ size: MAX_IMAGE_BYTES + 1 }, 'scope'), { code: 'INVALID_DATA' });
});
test('backend rejects admin writes without a token connection and backups from other repositories', async () => {
  const { admin, repository } = await fixture(); const backup = await admin.exportKeys('backup password 123');
  const outsider = new Portal({ ...config, repo: 'another' }, { repository, store: new MemoryStore() });
  await assert.rejects(outsider.createStudent({ password, profile }), { code: 'ADMIN_REQUIRED' });
  await outsider.connectAdmin('test-token'); await assert.rejects(outsider.importKeys(backup, 'backup password 123'), { code: 'INVALID_DATA' });
});
test('public GitHub reads fall back without ever sending an admin token', async () => {
  const calls = [];
  const repository = new GitHubRepository(config, async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return new Response('', { status: 503 });
    return Response.json({ version: 4 });
  }); repository.token = 'admin-secret';
  assert.deepEqual(await repository.readPublic(config.dataPath), { version: 4 });
  assert.equal(calls.length, 2);
  for (const { options } of calls) {
    assert.equal(options.headers.Authorization, undefined); assert.equal(options.headers['Cache-Control'], undefined);
    assert.equal(options.credentials, 'omit');
  }
});
test('public reads use native HTTP cache revalidation and bypass it after a local write', async () => {
  const calls = [];
  const repository = new GitHubRepository(config, async (url, options) => {
    calls.push({ url, options });
    if (url.includes('?v=')) return Response.json({ version: 5 }, { headers: { ETag: '"v5"' } });
    return Response.json({ version: 4 }, { headers: { ETag: '"v1"' } });
  });
  assert.deepEqual(await repository.readPublic(config.dataPath), { version: 4 });
  assert.deepEqual(await repository.readPublic(config.dataPath), { version: 4 });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, calls[1].url, 'unchanged public data keeps a stable URL for browser revalidation');
  assert.equal(calls[1].options.cache, 'no-cache');
  assert.equal(calls[1].options.headers['If-None-Match'], undefined, 'do not trigger a cross-origin preflight');
  repository.invalidatePublic(config.dataPath);
  assert.deepEqual(await repository.readPublic(config.dataPath), { version: 5 });
  assert.match(calls[2].url, /\?v=/);
  assert.equal(calls[2].options.headers['If-None-Match'], undefined);
});

test('GitHub commits attach ciphertext and catalog atomically, never force or retry conflicting commits', async () => {
  const calls = [];
  const repository = new GitHubRepository(config, async (url, options) => {
    calls.push({ url, options, body: options.body && JSON.parse(options.body) });
    if (url.includes('/git/commits/')) return Response.json({ tree: { sha: 'old-tree' } });
    if (url.endsWith('/git/blobs')) return Response.json({ sha: `blob-${calls.length}` });
    if (url.endsWith('/git/trees')) return Response.json({ sha: 'tree' });
    if (url.endsWith('/git/commits')) return Response.json({ sha: 'commit' });
    if (options.method === 'PATCH') return new Response('', { status: 422 });
    throw new Error(`Unexpected call ${url}`);
  }); repository.token = 'test-token';
  await assert.rejects(repository.commit({ head: 'original-head' }, { encrypted: true }, [{ path: 'data/attachments/a.bin', binary: true, content: png }]), { code: 'CONFLICT' });
  const tree = calls.find(call => call.url.endsWith('/git/trees')).body;
  assert.equal(tree.tree.length, 2); assert.equal(tree.base_tree, 'old-tree');
  const commit = calls.find(call => call.url.endsWith('/git/commits')).body; assert.deepEqual(commit.parents, ['original-head']);
  const updates = calls.filter(call => call.options.method === 'PATCH'); assert.equal(updates.length, 1); assert.equal(updates[0].body.force, false);
});
test('announcement edits rotate keys and remove previous recipients from the new revision', async () => {
  const { admin, student, repository, loginKey, created } = await fixture();
  const secondLogin = generateLoginKey(); const second = await admin.createStudent({ loginKey: secondLogin, password, profile });
  const announcement = await admin.publishAnnouncement({ title: 'Original', recipients: [created.id] });
  assert.equal((await student.login(loginKey, password)).announcements.length, 1);
  const updated = await admin.updateAnnouncement(announcement.id, { expectedRevision: announcement.revision, title: 'Only the second student', body: 'New text', recipients: [second.id], images: [image()] });
  assert.notEqual(updated.revision, announcement.revision);
  assert.equal((await student.refreshStudent()).announcements.length, 0);
  const secondStudent = new Portal(config, { repository, store: new MemoryStore() });
  const view = await secondStudent.login(secondLogin, password); assert.equal(view.announcements[0].title, 'Only the second student');
  await assert.rejects(admin.deleteAnnouncement(announcement.id, announcement.revision));
  await admin.deleteAnnouncement(updated.id, updated.revision);
});
test('failed announcement edits retain keys for the currently published revision', async () => {
  const { admin, repository, created } = await fixture();
  const announcement = await admin.publishAnnouncement({ title: 'Original', recipients: [created.id] });
  repository.failNextCommit = true;
  await assert.rejects(admin.updateAnnouncement(announcement.id, { expectedRevision: announcement.revision, title: 'Failed edit', recipients: [created.id] }), { code: 'CONFLICT' });
  assert.equal((await admin.listAnnouncements())[0].data.title, 'Original');
});
test('logout during password derivation cannot resurrect a persisted session', async () => {
  const { student, loginKey, studentStore } = await fixture();
  const pending = student.login(loginKey, password);
  await student.logout(); await assert.rejects(pending, { code: 'LOGIN_CANCELLED' });
  assert.equal(await studentStore.get('student-session'), null);
});
test('logout during a slow refresh does not return decrypted data', async () => {
  const { student, repository, loginKey } = await fixture(); await student.login(loginKey, password);
  let release; const before = repository.readPublic.bind(repository);
  repository.readPublic = async path => { await new Promise(resolve => { release = resolve; }); return before(path); };
  const pending = student.refreshStudent();
  await new Promise(resolve => setImmediate(resolve)); await student.logout(); release();
  assert.equal(await pending, null);
});
test('legacy single-assessment records migrate locally without losing scores', async () => {
  const { admin, student } = await fixture();
  const oldKey = crypto.getRandomValues(new Uint8Array(32)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', oldKey, 'AES-GCM', false, ['encrypt']);
  const oldData = { studentName: 'Legacy student', className: '8', assessment: 'Math', score: 17, total: 20, feedback: 'Good work' };
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(oldData)));
  const record = { iv: Buffer.from(iv).toString('base64'), ciphertext: Buffer.from(encrypted).toString('base64') };
  const loginKey = generateLoginKey();
  await admin.migrateLegacyRecord(record, Buffer.from(oldKey).toString('base64url'), { loginKey, password });
  const view = await student.login(loginKey, password);
  assert.equal(view.profile.name, 'Legacy student'); assert.equal(view.profile.assessments[0].score, 17); assert.equal(view.profile.grade, '8');
});


test('high-entropy QR access opens a record without password derivation', async () => {
  const { student, repository, created } = await fixture();
  assert.ok(created.qrKey);
  const fragment = created.qrFragment;
  assert.match(fragment, /^#s=[a-f0-9]{64}&k=[A-Za-z0-9_-]+$/);
  const key = new URLSearchParams(fragment.slice(1)).get('k');
  const id = new URLSearchParams(fragment.slice(1)).get('s');
  const view = await student.loginWithQr(id, key);
  assert.equal(view.profile.name, profile.name);
  assert.equal(student.session.id, created.id);
  const denied = new Portal(config, { repository, store: new MemoryStore() });
  await assert.rejects(denied.loginWithQr(created.id, 'not-a-key'), { code: 'QR_INVALID' });
});

test('text envelopes compress repetitive content before AES-GCM and remain backwards compatible', async () => {
  const { seal, open, sealBytes, aesKey, randomKey, base64 } = require('../backend.js').cryptography;
  const key = randomKey();
  const value = { note: 'گزارش آموزشی '.repeat(800), values: Array.from({ length: 200 }, (_, i) => ({ title: 'ارزیابی ریاضی', score: i % 20, total: 20 })) };
  const compressed = await seal(value, key, 'compression-test');
  assert.equal(compressed.compression, 'gzip');
  assert.deepEqual(await open(compressed, key, 'compression-test'), value);
  const small = await seal({ text: 'ok' }, key, 'small-test');
  assert.equal(small.compression, undefined);
  assert.deepEqual(await open(small, key, 'small-test'), { text: 'ok' });
  const oldEnvelope = await sealBytes(new TextEncoder().encode(JSON.stringify({ legacy: true })), await aesKey(key), 'legacy-test');
  assert.deepEqual(await open(oldEnvelope, key, 'legacy-test'), { legacy: true });
});
