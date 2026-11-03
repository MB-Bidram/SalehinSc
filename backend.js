/* Static portal backend. No secrets, passwords, tokens, or plaintext images are published. */
'use strict';
(function (root) {
  const VERSION = 4;
  const ITERATIONS = 600000;
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const clone = value => structuredClone(value);
  const now = () => new Date().toISOString();
  const bytes = value => value instanceof Uint8Array ? value : new Uint8Array(value);
  function fail(code, message) { const error = new Error(message); error.code = code; return error; }
  function requireValue(condition, message) { if (!condition) throw fail('INVALID_DATA', message); }
  function base64(value) {
    let result = '';
    const data = bytes(value);
    for (let i = 0; i < data.length; i += 32768) result += String.fromCharCode(...data.subarray(i, i + 32768));
    return btoa(result);
  }
  function unbase64(value) {
    requireValue(typeof value === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(value), 'Invalid base64.');
    return Uint8Array.from(atob(value), c => c.charCodeAt(0));
  }
  const random = size => crypto.getRandomValues(new Uint8Array(size));
  const randomKey = () => base64(random(32));
  const randomId = () => Array.from(random(16), b => b.toString(16).padStart(2, '0')).join('');
  const generateLoginKey = () => base64(random(24)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  function loginText(value) {
    requireValue(typeof value === 'string', 'A login key is required.');
    const text = value.trim();
    requireValue(text.length >= 8 && text.length <= 128 && /^[A-Za-z0-9_-]+$/.test(text), 'Use a login key of 8–128 letters, digits, underscores or hyphens.');
    return text;
  }
  async function accountId(loginKey) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(`SalehinSc login v4:${loginText(loginKey)}`))), b => b.toString(16).padStart(2, '0')).join('');
  }
  function passwordText(password) {
    requireValue(typeof password === 'string' && password.length >= 12 && password.length <= 1024, 'Use a password of at least 12 characters.');
    return password;
  }
  async function aesKey(text) {
    const raw = unbase64(text);
    requireValue(raw.length === 32, 'Invalid encryption key.');
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  async function sealBytes(plain, key, context) {
    const iv = random(12);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(context), tagLength: 128 }, key, plain);
    return { algorithm: 'A256GCM', iv: base64(iv), ciphertext: base64(ciphertext) };
  }
  async function openBytes(envelope, key, context) {
    requireValue(envelope?.algorithm === 'A256GCM', 'Unsupported encrypted envelope.');
    const iv = unbase64(envelope.iv);
    requireValue(iv.length === 12, 'Invalid IV.');
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(context), tagLength: 128 }, key, unbase64(envelope.ciphertext)));
  }
  async function transformBytes(data, StreamType) {
    if (typeof StreamType !== 'function' || typeof Blob === 'undefined' || typeof Response === 'undefined') return null;
    const stream = new Blob([data]).stream().pipeThrough(new StreamType('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function seal(value, keyText, context) {
    const plain = encoder.encode(JSON.stringify(value));
    let payload = plain, compression = '';
    // GZIP only when it actually saves bytes; tiny records stay uncompressed.
    try {
      const compressed = await transformBytes(plain, root.CompressionStream);
      if (compressed && compressed.length + 4 < plain.length) { payload = compressed; compression = 'gzip'; }
    } catch { /* Compression is an optimization, never a dependency for saving. */ }
    const envelope = await sealBytes(payload, await aesKey(keyText), context);
    if (compression) envelope.compression = compression;
    return envelope;
  }
  async function open(envelope, keyText, context) {
    let plain = await openBytes(envelope, await aesKey(keyText), context);
    if (envelope.compression) {
      requireValue(envelope.compression === 'gzip', 'Unsupported compressed envelope.');
      try { plain = await transformBytes(plain, root.DecompressionStream); }
      catch { throw fail('UNSUPPORTED_COMPRESSION', 'This browser cannot decompress this record.'); }
      requireValue(plain instanceof Uint8Array, 'This browser cannot decompress this record.');
    }
    return JSON.parse(decoder.decode(plain));
  }
  async function envelopeRevision(envelope) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(envelope.ciphertext))), b => b.toString(16).padStart(2, '0')).join('');
  }
  function makeQrFragment(id, keyText, revision = '') {
    requireValue(/^[a-f0-9]{64}$/.test(String(id || '')), 'Invalid student record ID.');
    const key = unbase64(String(keyText || ''));
    requireValue(key.length === 32, 'Invalid QR access key.');
    requireValue(!revision || /^[a-f0-9]{32}$/.test(String(revision)), 'Invalid access-credential revision.');
    const fragment = `#s=${id}&k=${base64(key).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;
    return revision ? `${fragment}&r=${revision}` : fragment;
  }
  async function passwordKey(secret, kdf) {
    requireValue(kdf?.name === 'PBKDF2-SHA256' && kdf.iterations === ITERATIONS && unbase64(kdf.salt).length === 16, 'Unsupported password derivation parameters.');
    const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unbase64(kdf.salt), iterations: kdf.iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const newKdf = () => ({ name: 'PBKDF2-SHA256', salt: base64(random(16)), iterations: ITERATIONS });
  const credentialSecret = (loginKey, password) => JSON.stringify(['SalehinSc credentials v4', loginText(loginKey), passwordText(password)]);
  const profileContext = (scope, student) => `${scope}:student:${student.id}:${student.auth.revision}`;
  const authContext = (scope, id, revision) => `${scope}:credentials:${id}:${revision}`;
  function emptyCatalog(scope) { return { format: 'SalehinSc portal', version: VERSION, scope, updatedAt: now(), students: [], announcements: [], messages: [], scores: [] }; }
  function validateCatalog(value, scope) {
    requireValue(value?.format === 'SalehinSc portal' && value.version === VERSION && value.scope === scope && Array.isArray(value.students) && Array.isArray(value.announcements), 'Unsupported portal data or repository configuration.');
    const ids = new Set();
    for (const student of value.students) {
      const inlinePayload = student.payload?.algorithm === 'A256GCM';
      const externalPayload = student.payloadRef?.path === `data/students/${student.id}.json` && /^[a-f0-9]{64}$/.test(student.payloadRef?.revision || '');
      requireValue(/^[a-f0-9]{64}$/.test(student.id) && !ids.has(student.id) && typeof student.disabled === 'boolean' && /^[a-f0-9]{32}$/.test(student.auth?.revision) && (inlinePayload || externalPayload), 'Invalid student entry.');
      ids.add(student.id);
    }
    const announcementIds = new Set();
    for (const item of value.announcements) {
      requireValue(/^[a-f0-9]{32}$/.test(item.id) && /^[a-f0-9]{32}$/.test(item.revision) && !announcementIds.has(item.id) && item.payload?.algorithm === 'A256GCM', 'Invalid announcement entry.');
      announcementIds.add(item.id);
    }
    return value;
  }

  /* The device key is nonextractable. Both the key and encrypted values stay in IndexedDB.
     This protects against accidental plaintext exports, not hostile same-origin scripts. */
  class DeviceStore {
    constructor(scope) { this.scope = scope; this.database = null; }
    async db() {
      if (!this.database) this.database = new Promise((resolve, reject) => {
        if (!root.indexedDB) { reject(fail('STORAGE', 'Persistent browser storage is required.')); return; }
        const request = indexedDB.open('salehinsc-device-v4', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('kv');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(fail('STORAGE', 'Close other portal tabs to update storage.'));
      });
      return this.database;
    }
    async operation(mode, fn) {
      const db = await this.db();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('kv', mode);
        let result;
        fn(tx.objectStore('kv'), value => { result = value; });
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || fail('STORAGE', 'Local storage transaction failed.'));
      });
    }
    async deviceKey() {
      const candidate = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      return this.operation('readwrite', (store, done) => {
        const request = store.get(`${this.scope}:device-key`);
        request.onsuccess = () => {
          const key = request.result || candidate;
          if (!request.result) store.put(key, `${this.scope}:device-key`);
          done(key);
        };
      });
    }
    async get(name) {
      const value = await this.operation('readonly', (store, done) => {
        const request = store.get(`${this.scope}:${name}`); request.onsuccess = () => done(request.result);
      });
      if (!value) return null;
      return JSON.parse(decoder.decode(await openBytes(value, await this.deviceKey(), `${this.scope}:local:${name}`)));
    }
    async set(name, value) {
      const encrypted = await sealBytes(encoder.encode(JSON.stringify(value)), await this.deviceKey(), `${this.scope}:local:${name}`);
      return this.operation('readwrite', store => store.put(encrypted, `${this.scope}:${name}`));
    }
    async delete(name) { return this.operation('readwrite', store => store.delete(`${this.scope}:${name}`)); }
  }

  class GitHubRepository {
    constructor(config, fetcher = root.fetch.bind(root)) {
      this.config = config; this.fetcher = fetcher; this.token = '';
      this.api = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
      // Conditional public reads keep refreshes cheap without hiding changed data.
      this.publicCache = new Map(); this.forceRefreshPaths = new Set();
    }
    path(path) { return path.split('/').map(encodeURIComponent).join('/'); }
    async request(url, options = {}, authenticated = false, type = 'json') {
      if (authenticated && !this.token) throw fail('ADMIN_REQUIRED', 'Connect with a GitHub token first.');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await this.fetcher(url, {
          ...options, cache: 'no-store', credentials: 'omit', signal: controller.signal,
          headers: {
            Accept: 'application/vnd.github+json',
            ...(authenticated ? { Authorization: `Bearer ${this.token}`, 'X-GitHub-Api-Version': this.config.apiVersion } : {}),
            ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers
          }
        });
        if (!response.ok) {
          const error = fail(response.status === 404 ? 'NOT_FOUND' : [409, 422].includes(response.status) ? 'CONFLICT' : 'GITHUB', `GitHub request failed (${response.status}).`);
          error.status = response.status; throw error;
        }
        return type === 'bytes' ? new Uint8Array(await response.arrayBuffer()) : response.json();
      } finally { clearTimeout(timer); }
    }
    async connect(token) {
      requireValue(typeof token === 'string' && token.trim(), 'A GitHub token is required.');
      this.token = token.trim();
      try {
        const repo = await this.request(this.api, {}, true);
        requireValue(repo.permissions?.push === true, 'The token needs repository Contents read/write access.');
        requireValue(repo.private === false, 'Student reads require a public data repository.');
        return repo;
      } catch (error) { this.token = ''; throw error; }
    }
    disconnect() { this.token = ''; }
    async snapshot(scope) {
      const ref = await this.request(`${this.api}/git/ref/heads/${this.path(this.config.branch)}`, {}, true);
      const head = ref.object.sha;
      let catalog;
      try {
        catalog = await this.request(`${this.api}/contents/${this.path(this.config.dataPath)}?ref=${head}`, { headers: { Accept: 'application/vnd.github.raw+json' } }, true);
      } catch (error) { if (error.code !== 'NOT_FOUND') throw error; catalog = emptyCatalog(scope); }
      return { head, catalog: validateCatalog(catalog, scope) };
    }
    clonePublicValue(value, type) {
      if (type === 'bytes') return new Uint8Array(value);
      return JSON.parse(JSON.stringify(value));
    }
    invalidatePublic(paths) {
      for (const path of Array.isArray(paths) ? paths : [paths]) {
        if (!path) continue;
        this.forceRefreshPaths.add(path);
        for (const key of this.publicCache.keys()) if (key.startsWith(`${path}\u0000`)) this.publicCache.delete(key);
      }
    }
    async readPublic(path, type = 'json') {
      const cacheKey = `${path}\u0000${type}`;
      const cached = this.publicCache.get(cacheKey);
      const forced = this.forceRefreshPaths.delete(path);
      const stamp = forced ? `?v=${Date.now()}-${randomId()}` : '';
      const raw = `https://raw.githubusercontent.com/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}/${encodeURIComponent(this.config.branch)}/${this.path(path)}`;
      const candidates = [`${raw}${stamp}`];
      if (root.location && /^https?:$/.test(root.location.protocol)) candidates.push(`${new URL(`./${path}`, root.location.href).href}${stamp}`);
      candidates.push(`${this.api}/contents/${this.path(path)}?ref=${encodeURIComponent(this.config.branch)}${forced ? `&v=${Date.now()}` : ''}`);
      const errors = [];
      for (let index = 0; index < candidates.length; index++) {
        const url = candidates[index];
        try {
          // Let the browser's HTTP cache perform conditional validation itself. Setting
          // If-None-Match in JavaScript can trigger a CORS preflight on raw.githubusercontent.com
          // and make otherwise-public portal reads fail. `no-cache` still revalidates a stable
          // URL; when unchanged, the browser can reuse its cached response body.
          const response = await this.fetcher(url, {
            method: 'GET', cache: forced ? 'no-store' : 'no-cache', credentials: 'omit',
            headers: { Accept: 'application/vnd.github.raw+json' }
          });
          if (response.status === 304 && cached) return this.clonePublicValue(cached.value, type);
          if (!response.ok) {
            const error = fail(response.status === 404 ? 'NOT_FOUND' : 'GITHUB', `GitHub request failed (${response.status}).`);
            error.status = response.status; errors.push(error); continue;
          }
          let value;
          if (type === 'bytes') value = new Uint8Array(await response.arrayBuffer());
          else {
            try { value = await response.json(); }
            catch { throw fail('NETWORK', 'GitHub returned invalid portal data.'); }
          }
          this.publicCache.set(cacheKey, { value: this.clonePublicValue(value, type), etag: response.headers.get('etag') || '' });
          return this.clonePublicValue(value, type);
        } catch (error) { errors.push(error); }
      }
      if (errors.length && errors.every(error => error.code === 'NOT_FOUND')) throw fail('NOT_FOUND', 'Portal data has not been published.');
      throw fail('NETWORK', 'Could not retrieve fresh data from GitHub. Check the connection and retry.');
    }
    async commit(snapshot, catalog, files = []) {
      const parent = await this.request(`${this.api}/git/commits/${snapshot.head}`, {}, true);
      const allFiles = [...files, { path: this.config.dataPath, content: JSON.stringify(catalog) + '\n' }];
      const treeItems = await Promise.all(allFiles.map(async file => {
        const blob = await this.request(`${this.api}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: file.binary ? base64(file.content) : file.content, encoding: file.binary ? 'base64' : 'utf-8' }) }, true);
        return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha };
      }));
      const tree = await this.request(`${this.api}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree: treeItems }) }, true);
      const commit = await this.request(`${this.api}/git/commits`, { method: 'POST', body: JSON.stringify({ message: 'Update encrypted school portal data', tree: tree.sha, parents: [snapshot.head] }) }, true);
      // Never rebase an already prepared catalog onto a different head: that loses edits.
      await this.request(`${this.api}/git/refs/heads/${this.path(this.config.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) }, true);
      this.invalidatePublic(allFiles.map(file => file.path));
      return { head: commit.sha, catalog };
    }
  }

  function imageType(data) {
    if (data.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => data[i] === b)) return 'image/png';
    if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg';
    if (data.length >= 6 && ['GIF87a', 'GIF89a'].includes(String.fromCharCode(...data.subarray(0, 6)))) return 'image/gif';
    if (data.length >= 12 && String.fromCharCode(...data.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...data.subarray(8, 12)) === 'WEBP') return 'image/webp';
    throw fail('INVALID_IMAGE', 'Only PNG, JPEG, GIF, and WebP images are supported.');
  }
  async function prepareImage(file, scope) {
    requireValue(file && Number.isInteger(file.size) && file.size > 0 && file.size <= MAX_IMAGE_BYTES, 'Images must be between 1 byte and 8 MiB.');
    const plain = new Uint8Array(await file.arrayBuffer());
    requireValue(plain.length === file.size, 'Image size changed.');
    const mime = imageType(plain);
    requireValue(!file.type || file.type === mime, 'Image type does not match its contents.');
    const id = randomId(); const key = randomKey(); const iv = random(12);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(`${scope}:image:${id}`), tagLength: 128 }, await aesKey(key), plain));
    return {
      descriptor: { id, path: `data/attachments/${id}.bin`, key, iv: base64(iv), mime, size: plain.length, name: String(file.name || 'image').slice(0, 255) },
      file: { path: `data/attachments/${id}.bin`, content: ciphertext, binary: true }
    };
  }
  function validateDescriptor(item) {
    requireValue(/^[a-f0-9]{32}$/.test(item?.id) && item.path === `data/attachments/${item.id}.bin` && ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(item.mime) && Number.isInteger(item.size) && item.size > 0 && item.size <= MAX_IMAGE_BYTES, 'Invalid attachment descriptor.');
  }
  function validateProfile(profile) {
    requireValue(profile && typeof profile.name === 'string' && profile.name.trim() && profile.name.length <= 120, 'A student name is required (maximum 120 characters).');
    requireValue(typeof profile.grade === 'string' && profile.grade.trim() && profile.grade.length <= 80, 'A student grade is required (maximum 80 characters).');
    requireValue(!profile.assessments || Array.isArray(profile.assessments), 'Invalid scores.');
    return { ...clone(profile), name: profile.name.trim(), grade: profile.grade.trim(), assessments: clone(profile.assessments || []) };
  }

  class Portal {
    constructor(config, { repository, store } = {}) {
      requireValue(config && /^[A-Za-z0-9_.-]+$/.test(config.owner) && /^[A-Za-z0-9_.-]+$/.test(config.repo) && typeof config.branch === 'string' && config.branch && /^data\/[A-Za-z0-9_.-]+\.json$/.test(config.dataPath), 'Invalid repository configuration.');
      this.config = Object.freeze({ ...config });
      this.scope = `SalehinSc:v4:${config.owner.toLowerCase()}/${config.repo.toLowerCase()}:${config.branch}:${config.dataPath}`;
      this.repository = repository || new GitHubRepository(config);
      this.store = store || new DeviceStore(this.scope);
      this.admin = false; this.session = null; this.queue = Promise.resolve(); this.pendingStudentFiles = new Map(); this.studentEnvelopeCache = new Map();
      this.sessionQueue = Promise.resolve(); this.sessionEpoch = 0;
    }
    emptyVault() { return { format: 'SalehinSc local keys', version: VERSION, scope: this.scope, students: {}, announcements: {} }; }
    async vault() { return (await this.store.get('admin-vault')) || this.emptyVault(); }
    async connectAdmin(token) {
      const repo = await this.repository.connect(token);
      this.admin = true;
      try { await this.store.set('admin-vault', await this.vault()); return repo; }
      catch (error) { this.disconnectAdmin(); throw error; }
    }
    disconnectAdmin() { this.admin = false; this.repository.disconnect(); }
    async exclusive(fn) {
      const run = async () => {
        if (!this.admin) throw fail('ADMIN_REQUIRED', 'Connect with a GitHub token first.');
        const work = async () => fn(await this.vault());
        return root.navigator?.locks ? navigator.locks.request(`${this.scope}:admin`, work) : work();
      };
      const task = this.queue.then(run, run); this.queue = task.catch(() => {}); return task;
    }
    async snapshot() {
      const result = await this.repository.snapshot(this.scope);
      validateCatalog(result.catalog, this.scope); return result;
    }
    async commit(snapshot, catalog, files = []) {
      catalog.updatedAt = now(); validateCatalog(catalog, this.scope);
      const staged = [...this.pendingStudentFiles.values()];
      const combined = [...files, ...staged.filter(file => !files.some(item => item.path === file.path))];
      try {
        const result = await this.repository.commit(snapshot, catalog, combined);
        for (const file of staged) this.pendingStudentFiles.delete(file.path);
        return result;
      }
      catch (error) {
        if (error.code === 'CONFLICT') throw fail('CONFLICT', 'Another admin changed the repository. Refresh before saving again.');
        throw error;
      }
    }
    studentRevision(student) { return student.payloadRef?.revision || student.payload?.ciphertext || ''; }
    async decodeStudent(student, key) {
      // Legacy catalogues with inline ciphertext remain readable during migration.
      let envelope = student.payload;
      if (!envelope && student.payloadRef) {
        const cacheKey = `${student.id}:${student.payloadRef.revision}`;
        envelope = this.studentEnvelopeCache.get(cacheKey);
        if (!envelope) {
          envelope = await this.repository.readPublic(student.payloadRef.path);
          requireValue(await envelopeRevision(envelope) === student.payloadRef.revision, 'Student record revision does not match its index.');
          this.studentEnvelopeCache.set(cacheKey, envelope);
        }
      }
      return open(envelope, key, profileContext(this.scope, student));
    }
    async encodeStudent(student, dossier, key) {
      const envelope = await seal(dossier, key, profileContext(this.scope, student));
      const path = `data/students/${student.id}.json`;
      const revision = await envelopeRevision(envelope);
      student.payloadRef = { path, revision };
      delete student.payload;
      this.pendingStudentFiles.set(path, { path, content: JSON.stringify(envelope) + '\n' });
      this.studentEnvelopeCache.set(`${student.id}:${revision}`, envelope);
      student.updatedAt = now(); return student;
    }
    findStudent(catalog, id, revision) {
      const student = catalog.students.find(item => item.id === id);
      if (!student) throw fail('NOT_FOUND', 'Student account was not found.');
      if (revision !== undefined && this.studentRevision(student) !== revision) throw fail('CONFLICT', 'This student changed after you opened it. Refresh before saving.');
      return student;
    }
    adminKey(vault, id, revision) {
      const key = vault.students[id]?.keys?.[revision];
      if (!key) throw fail('KEYS_REQUIRED', 'Restore this device from an encrypted key backup.');
      return key;
    }
    async makeStudent(id, key, loginKey, password, dossier) {
      const revision = randomId(); const kdf = newKdf();
      const wrappedKey = await sealBytes(encoder.encode(key), await passwordKey(credentialSecret(loginKey, password), kdf), authContext(this.scope, id, revision));
      return this.encodeStudent({ id, auth: { revision, kdf, wrappedKey }, disabled: false }, dossier, key);
    }
    async listStudents() {
      return this.exclusive(async vault => {
        const { catalog } = await this.snapshot();
        return Promise.all(catalog.students.map(async student => ({
          id: student.id, disabled: student.disabled, revision: this.studentRevision(student),
          dossier: vault.students[student.id]?.keys?.[student.auth.revision] ? await this.decodeStudent(student, this.adminKey(vault, student.id, student.auth.revision)) : null
        })));
      });
    }
    async createStudent({ loginKey = generateLoginKey(), password, profile, images = [] }) {
      return this.exclusive(async vault => {
        profile = validateProfile(profile); loginKey = loginText(loginKey); passwordText(password);
        const id = await accountId(loginKey); const snapshot = await this.snapshot(); const catalog = clone(snapshot.catalog);
        requireValue(!catalog.students.some(item => item.id === id), 'This login key is already in use.');
        const key = randomKey(); const prepared = await Promise.all(images.map(file => prepareImage(file, this.scope)));
        const dossier = { profile, attachments: prepared.map(item => item.descriptor), announcements: {}, createdAt: now(), updatedAt: now() };
        const student = await this.makeStudent(id, key, loginKey, password, dossier);
        // Persist before publishing. A network failure must never lose a published key.
        vault.students[id] = { loginKey, keys: { ...vault.students[id]?.keys, [student.auth.revision]: key } }; await this.store.set('admin-vault', vault);
        catalog.students.push(student); await this.commit(snapshot, catalog, prepared.map(item => item.file));
        return { id, loginKey, revision: this.studentRevision(student), qrKey: key, qrFragment: makeQrFragment(id, key) };
      });
    }
    async updateStudent(id, { profile, images = [], removeAttachmentIds = [], expectedRevision }) {
      return this.exclusive(async vault => {
        requireValue(typeof expectedRevision === 'string' && expectedRevision, 'The current student revision is required.');
        const snapshot = await this.snapshot(); const catalog = clone(snapshot.catalog);
        const student = this.findStudent(catalog, id, expectedRevision); const key = this.adminKey(vault, id, student.auth.revision);
        const dossier = await this.decodeStudent(student, key);
        if (profile) dossier.profile = validateProfile(profile);
        const prepared = await Promise.all(images.map(file => prepareImage(file, this.scope)));
        dossier.attachments = dossier.attachments.filter(item => !removeAttachmentIds.includes(item.id)).concat(prepared.map(item => item.descriptor));
        dossier.updatedAt = now(); await this.encodeStudent(student, dossier, key);
        await this.commit(snapshot, catalog, prepared.map(item => item.file));
        return { id, revision: this.studentRevision(student) };
      });
    }
    async resetCredentials(id, { loginKey, password, expectedRevision }) {
      return this.exclusive(async vault => {
        requireValue(typeof expectedRevision === 'string' && expectedRevision, 'The current student revision is required.');
        loginKey = loginText(loginKey); passwordText(password);
        const nextId = await accountId(loginKey); const snapshot = await this.snapshot(); const catalog = clone(snapshot.catalog);
        const previous = this.findStudent(catalog, id, expectedRevision);
        requireValue(nextId === id || !catalog.students.some(item => item.id === nextId), 'This login key is already in use.');
        const dossier = await this.decodeStudent(previous, this.adminKey(vault, id, previous.auth.revision));
        const key = randomKey(); const student = await this.makeStudent(nextId, key, loginKey, password, dossier);
        student.disabled = previous.disabled;
        vault.students[nextId] = { loginKey, keys: { ...vault.students[nextId]?.keys, [student.auth.revision]: key } }; await this.store.set('admin-vault', vault);
        catalog.students[catalog.students.findIndex(item => item.id === id)] = student;
        await this.commit(snapshot, catalog);
        return { id: nextId, loginKey, revision: this.studentRevision(student), qrKey: key, qrFragment: makeQrFragment(nextId, key) };
      });
    }
    async setStudentDisabled(id, disabled, expectedRevision) {
      return this.exclusive(async vault => {
        requireValue(typeof expectedRevision === 'string' && typeof disabled === 'boolean', 'A revision and disabled status are required.');
        const snapshot = await this.snapshot(); const catalog = clone(snapshot.catalog); const student = this.findStudent(catalog, id, expectedRevision);
        this.adminKey(vault, id, student.auth.revision); student.disabled = disabled;
        await this.commit(snapshot, catalog);
      });
    }
    async deleteStudent(id, expectedRevision) {
      return this.exclusive(async vault => {
        requireValue(typeof expectedRevision === 'string' && expectedRevision, 'The current student revision is required.');
        const snapshot = await this.snapshot(); const catalog = clone(snapshot.catalog);
        const student = this.findStudent(catalog, id, expectedRevision); this.adminKey(vault, id, student.auth.revision);
        catalog.students = catalog.students.filter(item => item.id !== id);
        await this.commit(snapshot, catalog);
        // Keep recovery keys in the local backup: Git history can still contain old data.
      });
    }
    async publishAnnouncement({ title, body = '', recipients, images = [] }) {
      return this.exclusive(async vault => {
        requireValue(typeof title === 'string' && title.trim() && title.length <= 200 && typeof body === 'string' && body.length <= 20000, 'A title (up to 200 characters) and text (up to 20,000) are required.');
        requireValue(Array.isArray(recipients) && recipients.length && new Set(recipients).size === recipients.length, 'Select one or more unique student IDs.');
        const snapshot = await this.snapshot(); const catalog = clone(snapshot.catalog); const id = randomId(); const key = randomKey();
        const prepared = await Promise.all(images.map(file => prepareImage(file, this.scope)));
        const data = { title: title.trim(), body, attachments: prepared.map(item => item.descriptor), createdAt: now() };
        const revision = randomId();
        const item = { id, revision, payload: await seal(data, key, `${this.scope}:announcement:${id}:${revision}`) };
        for (const studentId of recipients) {
          const student = this.findStudent(catalog, studentId); requireValue(!student.disabled, 'Cannot publish to a disabled student.');
          const studentKey = this.adminKey(vault, studentId, student.auth.revision); const dossier = await this.decodeStudent(student, studentKey);
          dossier.announcements[id] = { key, revision }; await this.encodeStudent(student, dossier, studentKey);
        }
        vault.announcements[id] = { keys: { [revision]: key } }; await this.store.set('admin-vault', vault);
        catalog.announcements.push(item); await this.commit(snapshot, catalog, prepared.map(item => item.file));
        return { id, revision };
      });
    }
    async updateAnnouncement(id, { title, body = '', recipients, images = [], removeAttachmentIds = [], expectedRevision }) {
      return this.exclusive(async vault => {
        requireValue(typeof title === 'string' && title.trim() && title.length <= 200 && typeof body === 'string' && body.length <= 20000, 'Invalid announcement text.');
        requireValue(Array.isArray(recipients) && recipients.length && new Set(recipients).size === recipients.length, 'Select unique student IDs.');
        const snapshot = await this.snapshot(); const catalog = clone(snapshot.catalog);
        const item = catalog.announcements.find(entry => entry.id === id);
        requireValue(item && expectedRevision === item.revision, 'Refresh this announcement before editing it.');
        const previousKey = vault.announcements[id]?.keys?.[item.revision];
        requireValue(previousKey, 'Restore announcement keys from a backup first.');
        const previous = await open(item.payload, previousKey, `${this.scope}:announcement:${id}:${item.revision}`);
        const prepared = await Promise.all(images.map(file => prepareImage(file, this.scope)));
        const revision = randomId(); const key = randomKey();
        const data = { ...previous, title: title.trim(), body, updatedAt: now(), attachments: previous.attachments.filter(image => !removeAttachmentIds.includes(image.id)).concat(prepared.map(image => image.descriptor)) };
        for (const studentId of recipients) {
          const student = this.findStudent(catalog, studentId); requireValue(!student.disabled, 'Cannot publish to a disabled student.');
          const studentKey = this.adminKey(vault, studentId, student.auth.revision); const dossier = await this.decodeStudent(student, studentKey);
          dossier.announcements[id] = { key, revision }; await this.encodeStudent(student, dossier, studentKey);
        }
        // Removed recipients retain only an obsolete grant, which cannot decrypt this revision.
        item.revision = revision; item.payload = await seal(data, key, `${this.scope}:announcement:${id}:${revision}`);
        vault.announcements[id].keys[revision] = key; await this.store.set('admin-vault', vault);
        await this.commit(snapshot, catalog, prepared.map(image => image.file)); return { id, revision };
      });
    }
    async deleteAnnouncement(id, expectedRevision) {
      return this.exclusive(async vault => {
        requireValue(vault.announcements[id], 'Restore announcement keys from a backup first.');
        const snapshot = await this.snapshot(); const catalog = clone(snapshot.catalog);
        const item = catalog.announcements.find(item => item.id === id);
        requireValue(item && item.revision === expectedRevision, 'Refresh this announcement before deleting it.');
        // Old grants are harmless without the current published ciphertext. Never claim
        // deletion revokes copies a student has already downloaded or Git history.
        catalog.announcements = catalog.announcements.filter(item => item.id !== id);
        await this.commit(snapshot, catalog);
      });
    }
    async listAnnouncements() {
      return this.exclusive(async vault => {
        const { catalog } = await this.snapshot();
        return Promise.all(catalog.announcements.map(async item => ({ id: item.id, revision: item.revision, data: vault.announcements[item.id]?.keys?.[item.revision] ? await open(item.payload, vault.announcements[item.id].keys[item.revision], `${this.scope}:announcement:${item.id}:${item.revision}`) : null })));
      });
    }
    async login(loginKey, password) {
      const epoch = ++this.sessionEpoch;
      const catalog = validateCatalog(await this.repository.readPublic(this.config.dataPath), this.scope);
      let session;
      try {
        const id = await accountId(loginKey); const student = catalog.students.find(item => item.id === id);
        if (!student || student.disabled) throw new Error('Invalid account');
        const key = decoder.decode(await openBytes(student.auth.wrappedKey, await passwordKey(credentialSecret(loginKey, password), student.auth.kdf), authContext(this.scope, id, student.auth.revision)));
        await this.decodeStudent(student, key);
        session = { id, key, revision: student.auth.revision };
      } catch { throw fail('LOGIN_FAILED', 'Invalid login key or password.'); }
      await this.sessionOperation(async () => {
        if (epoch !== this.sessionEpoch) throw fail('LOGIN_CANCELLED', 'Sign-in was cancelled.');
        await this.store.set('student-session', session); this.session = session;
      });
      return this.studentView(catalog, session);
    }
    async loginWithQr(id, keyText, qrRevision = '') {
      const epoch = ++this.sessionEpoch;
      requireValue(/^[a-f0-9]{64}$/.test(String(id || '')), 'Invalid QR code.');
      const normalized = String(keyText || '').replaceAll('-', '+').replaceAll('_', '/');
      let accessKey;
      try {
        accessKey = unbase64(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
        requireValue(accessKey.length === 32, 'Invalid QR code.');
        const catalog = validateCatalog(await this.repository.readPublic(this.config.dataPath), this.scope);
        const student = catalog.students.find(item => item.id === id);
        requireValue(student && !student.disabled, 'This QR code is not active.');
        let key = base64(accessKey);
        let storedQrRevision = '';
        if (student.qrAccess) {
          requireValue(/^[a-f0-9]{32}$/.test(student.qrAccess.revision || '') && qrRevision === student.qrAccess.revision, 'This QR code has been replaced.');
          const context = `${this.scope}:qr:${student.id}:${student.qrAccess.revision}`;
          key = decoder.decode(await openBytes(student.qrAccess.wrappedKey, await aesKey(base64(accessKey)), context));
          storedQrRevision = student.qrAccess.revision;
        } else {
          // Legacy QR links contain the dossier key directly. They remain valid
          // until an administrator rotates that account's QR credential.
          requireValue(!qrRevision, 'This QR code is no longer active.');
        }
        await this.decodeStudent(student, key);
        const session = { id, key, revision: student.auth.revision, authType: 'qr', qrRevision: storedQrRevision };
        await this.sessionOperation(async () => {
          if (epoch !== this.sessionEpoch) throw fail('LOGIN_CANCELLED', 'QR access was cancelled.');
          await this.store.set('student-session', session); this.session = session;
        });
        return this.studentView(catalog, session);
      } catch (error) {
        if (['NETWORK', 'NOT_FOUND', 'LOGIN_CANCELLED'].includes(error?.code)) throw error;
        throw fail('QR_INVALID', 'This QR code is invalid, expired or no longer active.');
      }
    }
    async sessionOperation(fn) {
      const run = () => root.navigator?.locks ? navigator.locks.request(`${this.scope}:student-session`, fn) : fn();
      const task = this.sessionQueue.then(run, run); this.sessionQueue = task.catch(() => {}); return task;
    }
    async logout() {
      ++this.sessionEpoch; this.session = null;
      await this.sessionOperation(() => this.store.delete('student-session'));
    }
    async studentView(catalog, session) {
      const student = catalog.students.find(item => item.id === session.id);
      const qrRevision = student?.qrAccess?.revision || '';
      const qrRevoked = session.authType === 'qr' && qrRevision !== (session.qrRevision || '');
      if (!student || student.disabled || student.auth.revision !== session.revision || qrRevoked) {
        await this.sessionOperation(async () => {
          const stored = await this.store.get('student-session');
          if (stored?.id === session.id && stored?.revision === session.revision) {
            ++this.sessionEpoch; this.session = null; await this.store.delete('student-session');
          }
        });
        throw fail('SESSION_REVOKED', 'This login has expired. Sign in with the current credentials.');
      }
      const dossier = await this.decodeStudent(student, session.key);
      const announcements = [];
      for (const item of catalog.announcements) {
        const grant = dossier.announcements[item.id];
        if (grant?.revision === item.revision) announcements.push({ id: item.id, ...await open(item.payload, grant.key, `${this.scope}:announcement:${item.id}:${item.revision}`) });
      }
      return { id: student.id, profile: dossier.profile, attachments: dossier.attachments, announcements, updatedAt: dossier.updatedAt };
    }
    async refreshStudent() {
      const epoch = this.sessionEpoch;
      // Re-read storage so logout in another tab also takes effect.
      const session = await this.store.get('student-session');
      if (!session) { this.session = null; return null; }
      const catalog = validateCatalog(await this.repository.readPublic(this.config.dataPath), this.scope);
      const stored = await this.store.get('student-session');
      if (epoch !== this.sessionEpoch || stored?.id !== session.id || stored?.revision !== session.revision) return null;
      this.session = session; return this.studentView(catalog, session);
    }
    async readImage(descriptor) {
      validateDescriptor(descriptor);
      const ciphertext = await this.repository.readPublic(descriptor.path, 'bytes');
      requireValue(ciphertext.length === descriptor.size + 16, 'Encrypted image size is invalid.');
      const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(descriptor.iv), additionalData: encoder.encode(`${this.scope}:image:${descriptor.id}`), tagLength: 128 }, await aesKey(descriptor.key), ciphertext));
      requireValue(imageType(plain) === descriptor.mime, 'Decrypted image type is invalid.');
      return new Blob([plain], { type: descriptor.mime });
    }
    async exportKeys(password) {
      return this.exclusive(async vault => {
        passwordText(password); const kdf = newKdf();
        const payload = await sealBytes(encoder.encode(JSON.stringify(vault)), await passwordKey(password, kdf), `${this.scope}:key-backup`);
        return { format: 'SalehinSc encrypted key backup', version: VERSION, scope: this.scope, kdf, payload };
      });
    }
    async importKeys(backup, password) {
      return this.exclusive(async vault => {
        requireValue(backup?.format === 'SalehinSc encrypted key backup' && backup.version === VERSION && backup.scope === this.scope, 'This backup belongs to another repository or format.');
        const restored = JSON.parse(decoder.decode(await openBytes(backup.payload, await passwordKey(passwordText(password), backup.kdf), `${this.scope}:key-backup`)));
        requireValue(restored.format === 'SalehinSc local keys' && restored.version === VERSION && restored.scope === this.scope && restored.students && restored.announcements, 'Invalid key backup.');
        for (const [id, entry] of Object.entries(restored.students)) {
          requireValue(id === await accountId(entry.loginKey) && entry.keys && typeof entry.keys === 'object', 'Invalid student key entry.');
          for (const [revision, key] of Object.entries(entry.keys)) { requireValue(/^[a-f0-9]{32}$/.test(revision), 'Invalid credential revision.'); await aesKey(key); }
        }
        for (const [id, entry] of Object.entries(restored.announcements)) {
          requireValue(/^[a-f0-9]{32}$/.test(id) && entry.keys && typeof entry.keys === 'object', 'Invalid announcement key.');
          for (const [revision, key] of Object.entries(entry.keys)) { requireValue(/^[a-f0-9]{32}$/.test(revision), 'Invalid announcement revision.'); await aesKey(key); }
        }
        // A stale backup must never silently replace newer keys on this device.
        for (const [id, entry] of Object.entries(restored.students)) {
          vault.students[id] = { loginKey: entry.loginKey, keys: { ...entry.keys, ...vault.students[id]?.keys } };
        }
        for (const [id, entry] of Object.entries(restored.announcements)) vault.announcements[id] = { keys: { ...entry.keys, ...vault.announcements[id]?.keys } };
        await this.store.set('admin-vault', vault);
      });
    }
    async migrateLegacyRecord(record, legacyKey, { loginKey, password, grade }) {
      // Explicit one-record migration. Never publish or continue accepting QR links.
      const normalizedKey = String(legacyKey).replaceAll('-', '+').replaceAll('_', '/');
      const padded = normalizedKey.padEnd(Math.ceil(normalizedKey.length / 4) * 4, '=');
      const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(record.iv) }, await aesKey(padded), unbase64(record.ciphertext));
      const data = JSON.parse(decoder.decode(raw));
      if (!Array.isArray(data.assessments)) {
        const fields = (data.sections || []).flatMap(section => section.fields || []);
        const scoreField = fields.find(field => ['نمره', 'امتیاز', 'score', 'امتیاز کسب‌شده'].includes(String(field.label).trim().toLowerCase()));
        const totalField = fields.find(field => ['از', 'کل', 'نمره کل', 'حداکثر', 'total', 'max score'].includes(String(field.label).trim().toLowerCase()));
        const hasAssessment = data.assessment || data.score !== undefined || data.feedback || fields.length;
        data.assessments = hasAssessment ? [{
          id: randomId(), title: data.assessment || data.subject || 'اطلاعات ثبت‌شده', category: data.recordType || 'general',
          score: data.score ?? scoreField?.value ?? null, total: data.total ?? totalField?.value ?? null,
          feedback: data.feedback || '', date: String(data.updatedAt || '').slice(0, 10),
          details: fields.filter(field => field !== scoreField && field !== totalField).map(field => ({ label: field.label, value: field.value }))
        }] : [];
      }
      return this.createStudent({ loginKey, password, profile: { ...data, name: data.name || data.studentName, grade: grade || data.grade || data.className || data.class } });
    }
  }
  const cryptography = Object.freeze({ seal, open, sealBytes, openBytes, aesKey, base64, unbase64, randomKey, randomId, newKdf, passwordKey, credentialSecret, profileContext, authContext, makeQrFragment });
  const api = Object.freeze({ Portal, GitHubRepository, DeviceStore, generateLoginKey, accountId, emptyCatalog, validateCatalog, prepareImage, MAX_IMAGE_BYTES, VERSION, makeQrFragment, cryptography });
  root.SalehinBackend = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
