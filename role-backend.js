/* Role-aware portal and end-to-end encrypted, signed publishing requests. */
'use strict';
(function (root) {
  const base = root.SalehinBackend || require('./backend.js');
  const C = base.cryptography;
  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8', { fatal: true });
  const MAX_FILE_BYTES = 8 * 1024 * 1024;
  const MAX_BATCH_BYTES = 16 * 1024 * 1024;
  const CHUNK_BYTES = 42000;
  const idPattern = /^[a-f0-9]{32}$/;
  const accountPattern = /^[a-f0-9]{64}$/;
  const revisionOf = account => account?.payloadRef?.revision || account?.payload?.ciphertext || '';
  const check = (condition, message, code = 'INVALID_DATA') => { if (!condition) { const error = new Error(message); error.code = code; throw error; } };
  function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  }
  const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', value)), b => b.toString(16).padStart(2, '0')).join('');
  async function identity() {
    const box = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
    const signing = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    return {
      public: { encryptionKey: await crypto.subtle.exportKey('jwk', box.publicKey), signingKey: await crypto.subtle.exportKey('jwk', signing.publicKey) },
      private: { encryptionKey: await crypto.subtle.exportKey('jwk', box.privateKey), signingKey: await crypto.subtle.exportKey('jwk', signing.privateKey) }
    };
  }
  async function sign(value, jwk) {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    return C.base64(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(canonical(value))));
  }
  async function verify(value, signature, jwk) {
    try {
      const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, C.unbase64(signature), enc.encode(canonical(value)));
    } catch { return false; }
  }
  async function wrapFor(keyText, recipient, context) {
    check(recipient.encryptionKey && accountPattern.test(recipient.id), 'This recipient needs messaging keys.');
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
    const publicKey = await crypto.subtle.importKey('jwk', recipient.encryptionKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const derived = await crypto.subtle.deriveKey({ name: 'ECDH', public: publicKey }, pair.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    return { id: recipient.id, ephemeralKey: await crypto.subtle.exportKey('jwk', pair.publicKey), envelope: await C.sealBytes(enc.encode(keyText), derived, context) };
  }
  async function unwrapFor(grant, privateJwk, context) {
    const privateKey = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
    const publicKey = await crypto.subtle.importKey('jwk', grant.ephemeralKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const derived = await crypto.subtle.deriveKey({ name: 'ECDH', public: publicKey }, privateKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    return dec.decode(await C.openBytes(grant.envelope, derived, context));
  }
  async function unwrapForHistory(grant, dossier, context) {
    const keys = [dossier?.identity?.encryptionKey, ...(dossier?.identityHistory || []).map(identity => identity?.encryptionKey)].filter(Boolean);
    let failure;
    for (const privateKey of keys) {
      try { return await unwrapFor(grant, privateKey, context); }
      catch (error) { failure = error; }
    }
    throw failure || new Error('No matching recipient key is available.');
  }
  async function verifyMessageAuthor(value, signature, catalog, authorId) {
    const keys = [actorOf(catalog, authorId)?.signingKey, catalog.identities?.[authorId], ...(catalog.identityHistory?.[authorId] || [])].filter(Boolean);
    for (const key of keys) if (await verify(value, signature, key)) return true;
    return false;
  }
  const messageContext = (scope, id) => `${scope}:message:${id}`;
  const qrContext = (scope, id, revision) => `${scope}:qr:${id}:${revision}`;
  const credentialRevision = account => account?.qrAccess?.revision || account?.auth?.revision || '';
  async function createQrGrant(scope, id, rootKey) {
    const key = C.randomKey(), revision = C.randomId();
    const wrappedKey = await C.sealBytes(enc.encode(rootKey), await C.aesKey(key), qrContext(scope, id, revision));
    return { descriptor: { revision, wrappedKey }, key, revision };
  }
  async function prepareFile(file, scope) {
    check(file && Number.isInteger(file.size) && file.size > 0 && file.size <= MAX_FILE_BYTES, 'Each file must be between 1 byte and 8 MiB.');
    const data = new Uint8Array(await file.arrayBuffer()); check(data.length === file.size, 'File size changed.');
    const id = C.randomId(), key = C.randomKey(), iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(`${scope}:file:${id}`) }, await C.aesKey(key), data));
    const mime = String(file.type || 'application/octet-stream').slice(0, 120);
    // Active content is always downloaded; only these inert raster types render inline.
    const inline = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mime);
    return {
      descriptor: { id, path: `data/attachments/${id}.bin`, kind: 'file', name: String(file.name || 'attachment').slice(0, 255), mime, inline, size: data.length, key, iv: C.base64(iv), hash: await digest(encrypted) },
      file: { path: `data/attachments/${id}.bin`, binary: true, content: encrypted }
    };
  }
  function validateFileDescriptor(file) {
    check(idPattern.test(file?.id) && file.path === `data/attachments/${file.id}.bin` && Number.isInteger(file.size) && file.size > 0 && file.size <= MAX_FILE_BYTES && /^[a-f0-9]{64}$/.test(file.hash), 'Invalid attachment.');
  }
  const visibleProfile = profile => ({ name: profile.name, grade: profile.grade, subject: profile.subject || '', title: profile.title || '', role: profile.role || 'student' });
  function actorOf(catalog, id) { return catalog.students.find(account => account.id === id); }
  function allowedRecipients(catalog, actor) {
    return catalog.students.filter(account => !account.disabled && (actor.role === 'admin' || account.id === actor.id || account.role === 'admin' || actor.assignedIds?.includes(account.id)));
  }
  async function validateRequest(request, catalog, scope, timestamp = Date.now()) {
    check(request?.format === 'SalehinSc signed request' && request.version === 1 && request.scope === scope && idPattern.test(request.id), 'Invalid request envelope.');
    const { signature, ...unsigned } = request;
    const actor = actorOf(catalog, request.actorId);
    check(actor && !actor.disabled && ['teacher', 'admin'].includes(actor.role), 'This account cannot publish.', 'FORBIDDEN');
    check(credentialRevision(actor) === request.actorRevision, 'This credential was revoked.', 'FORBIDDEN');
    check(Number.isFinite(Date.parse(request.createdAt)) && Math.abs(timestamp - Date.parse(request.createdAt)) <= 24 * 60 * 60 * 1000, 'This request expired.');
    check(await verify(unsigned, signature, actor.signingKey), 'Request signature is invalid.', 'FORBIDDEN');
    check(Array.isArray(request.files) && request.files.length <= 12, 'Too many attachments.');
    let total = 0;
    for (const file of request.files) {
      check(/^data\/attachments\/[a-f0-9]{32}\.bin$/.test(file.path) && /^[a-f0-9]{64}$/.test(file.hash) && Number.isInteger(file.size) && file.size >= 17 && file.size <= MAX_FILE_BYTES + 16 && Array.isArray(file.chunks) && file.chunks.length === Math.ceil(file.size / CHUNK_BYTES) && file.chunks.every(id => Number.isSafeInteger(id) && id > 0), 'Invalid staged attachment.');
      total += file.size;
    }
    check(total <= MAX_BATCH_BYTES + 12 * 16 && new Set(request.files.map(file => file.path)).size === request.files.length, 'Attachment batch is too large.');
    if (request.operation === 'message') {
      const message = request.message;
      check(message && idPattern.test(message.id) && message.id === request.id && message.authorId === actor.id && message.payload?.algorithm === 'A256GCM' && ['message', 'announcement', 'score'].includes(message.category) && Array.isArray(message.recipients) && message.recipients.length > 0, 'Invalid message.');
      const allowed = new Set(allowedRecipients(catalog, actor).map(item => item.id));
      check(new Set(message.recipients.map(item => item.id)).size === message.recipients.length && message.recipients.every(item => allowed.has(item.id)), 'A recipient is outside this teacher’s assigned classes.', 'FORBIDDEN');
      check(message.recipients.some(item => item.id === actor.id) && catalog.students.filter(item => item.role === 'admin' && !item.disabled).every(admin => message.recipients.some(item => item.id === admin.id)), 'Administrative recipients are required.', 'FORBIDDEN');
      const { signature: messageSignature, ...unsignedMessage } = message;
      check(await verify(unsignedMessage, messageSignature, actor.signingKey), 'Message signature is invalid.', 'FORBIDDEN');
    } else if (request.operation === 'profile') {
      // An already applied, identical payload permits an idempotent workflow retry.
      const revision = revisionOf(actor);
      check(request.accountId === actor.id && request.payload?.algorithm === 'A256GCM' && /^[a-f0-9]{64}$/.test(request.payloadRevision || '') && (request.expectedRevision === revision || request.payloadRevision === revision) && request.payloadRevision === await digest(enc.encode(request.payload.ciphertext)), 'This profile changed; refresh before saving.', 'CONFLICT');
    } else { check(false, 'Unsupported publishing operation.'); }
    return actor;
  }

  class RolePortal extends base.Portal {
    constructor(config, options = {}) { super(config, options); this.account = null; this.dossier = null; this.catalog = null; this.messageCache = new Map(); this.offline = false; this.worker = options.worker || null; }
    async studentView(catalog, session) {
      const view = await super.studentView(catalog, session);
      const account = actorOf(catalog, session.id);
      const dossier = await this.decodeStudent(account, session.key);
      const role = account.role || 'student';
      check((dossier.profile.role || 'student') === role, 'Account role does not match its encrypted profile.', 'FORBIDDEN');
      this.account = account; this.dossier = dossier; this.catalog = catalog; this.offline = false;
      if (role === 'admin' && dossier.keyVault) {
        const local = await this.vault();
        for (const [id, entry] of Object.entries(dossier.keyVault.students || {})) local.students[id] = { ...entry, keys: { ...entry.keys, ...local.students[id]?.keys }, qr: local.students[id]?.qr || entry.qr };
        for (const [id, entry] of Object.entries(dossier.keyVault.announcements || {})) local.announcements[id] = { keys: { ...entry.keys, ...local.announcements[id]?.keys } };
        await this.store.set('admin-vault', local);
      }
      const result = { ...view, role, site: catalog.site || {}, directory: dossier.directory || [], messages: await this.readMessages(catalog, account, dossier), scores: await this.readScores(catalog, account, dossier), revision: this.studentRevision(account) };
      // Keep a small, encrypted, per-repository copy of the last successfully decrypted view.
      // This is read-only fallback data; it never authorizes publishing while offline.
      try { await this.store.set('last-view', { accountId: session.id, authRevision: session.revision, savedAt: new Date().toISOString(), view: result }); } catch { /* Online use must not fail just because caching failed. */ }
      if (role === 'admin') await this.restoreAdminConnection();
      return result;
    }
    async restoreAdminConnection() {
      if (this.admin || this.account?.role !== 'admin') return Boolean(this.admin);
      if (!this.config.apiUrl && !this.worker) return false;
      try { await this.fetchWorkerSnapshot(); this.admin = true; return true; }
      catch { this.admin = false; return false; }
    }
    async refreshStudent() {
      this.offline = false;
      try { return await super.refreshStudent(); }
      catch (error) {
        if (error.code === 'SESSION_REVOKED') {
          this.disconnectAdmin();
          for (const key of ['admin-github-token', 'last-view', 'last-directory']) { try { await this.store.delete(key); } catch { /* Best effort. */ } }
          throw error;
        }
        if (error.code !== 'NETWORK') throw error;
        let session, cached, directory;
        try {
          session = await this.store.get('student-session');
          cached = await this.store.get('last-view');
          directory = await this.store.get('last-directory');
        } catch { throw error; }
        if (!session || !cached || cached.accountId !== session.id || cached.authRevision !== session.revision || !cached.view?.profile || cached.view?.id !== session.id) throw error;
        this.disconnectAdmin();
        this.session = session; this.account = null; this.dossier = null; this.catalog = null; this.messageCache.clear(); this.offline = true;
        const cachedDirectory = directory?.accountId === session.id && directory?.revision === session.revision ? directory.accounts : cached.view.directory;
        return { ...cached.view, directory: Array.isArray(cachedDirectory) ? cachedDirectory : [], offline: true, cacheTimestamp: cached.savedAt };
      }
    }
    async logout() {
      this.disconnectAdmin(); this.account = null; this.dossier = null; this.catalog = null; this.messageCache.clear(); this.offline = false;
      let fileIds = [];
      try { fileIds = await this.store.get('cached-file-ids') || []; } catch { /* Clear the named records below regardless. */ }
      await Promise.all(fileIds.map(id => this.store.delete(`file-cache:${id}`).catch(() => {})));
      await Promise.all(['admin-github-token', 'last-view', 'last-directory', 'cached-file-ids'].map(key => this.store.delete(key).catch(() => {})));
      await super.logout();
    }
    async workerCall(path, payload) {
      if (this.worker) {
        const method = path.split('/').filter(Boolean).at(-1);
        if (typeof this.worker[method] === 'function') return this.worker[method](structuredClone(payload), this);
      }
      check(typeof this.config.apiUrl === 'string' && /^https:\/\//.test(this.config.apiUrl), 'The secure school service is not configured.', 'PUBLISHING_SETUP');
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await root.fetch(new URL(path, this.config.apiUrl.endsWith('/') ? this.config.apiUrl : `${this.config.apiUrl}/`).href, {
          method: 'POST', cache: 'no-store', credentials: 'omit', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload)
        });
        let result = {};
        try { result = await response.json(); } catch { /* The status below supplies the useful failure. */ }
        if (!response.ok) {
          const code = response.status === 409 ? 'CONFLICT' : response.status === 401 || response.status === 403 ? 'FORBIDDEN' : 'PUBLISHING_FAILED';
          const error = new Error(result.error || (response.status === 409 ? 'اطلاعات جدیدتری ثبت شده است؛ فهرست را تازه کنید.' : `سرویس مدرسه پاسخ ${response.status} برگرداند.`));
          error.code = code; error.status = response.status; throw error;
        }
        return result;
      } catch (error) {
        if (error.name === 'AbortError') { const timeout = new Error('ارتباط با سرویس مدرسه بیش از حد طول کشید.'); timeout.code = 'NETWORK'; throw timeout; }
        if (error.code) throw error;
        const network = new Error('ارتباط امن با سرویس مدرسه برقرار نشد. اتصال یا نشانی سرویس را بررسی کنید.'); network.code = 'NETWORK'; throw network;
      } finally { clearTimeout(timer); }
    }
    async workerProof(action, extra = {}) {
      this.requireRole('admin', 'teacher');
      const proof = { format: 'SalehinSc worker request', version: 1, action, scope: this.scope, actorId: this.account.id, actorRevision: credentialRevision(this.account), createdAt: new Date().toISOString(), nonce: C.randomId(), ...extra };
      proof.signature = await sign(proof, this.dossier.identity.signingKey);
      return proof;
    }
    async fetchWorkerSnapshot() {
      const proof = await this.workerProof('snapshot');
      return this.workerCall('/v1/snapshot', proof);
    }
    async connectAdmin() {
      check(this.account?.role === 'admin', 'این دسترسی برای مدیر مدرسه است.', 'FORBIDDEN');
      try { const result = await this.fetchWorkerSnapshot(); this.admin = true; this.offline = false; return result; }
      catch (error) { this.admin = false; throw error; }
    }
    async connectTeacher() {
      check(this.account?.role === 'teacher', 'این دسترسی برای حساب دبیر است.', 'FORBIDDEN');
      const proof = await this.workerProof('teacher-entry');
      const result = await this.workerCall('/v1/teacher-entry', proof);
      check(result?.ok === true && result.teacherId === this.account.id, 'دسترسی این دبیر در فهرست مدرسه فعال نیست.', 'FORBIDDEN');
      this.teacherAuthorized = true;
      this.offline = false;
      return result;
    }
    async testConnection() {
      check(this.account?.role === 'admin', 'این دسترسی برای مدیر مدرسه است.', 'FORBIDDEN');
      const proof = await this.workerProof('connection-test');
      const result = await this.workerCall('/v1/connection-test', proof);
      this.admin = true;
      this.offline = false;
      return result;
    }
    async snapshot() {
      if (this.account?.role === 'admin' && this.admin) {
        const snapshot = await this.fetchWorkerSnapshot();
        this.catalog = snapshot.catalog;
        return snapshot;
      }
      return super.snapshot();
    }
    async commit(snapshot, catalog, files = []) {
      this.requireRole('admin');
      const vault = await this.vault();
      await this.syncRoster(catalog, vault);
      const admin = actorOf(catalog, this.account.id);
      check(admin && !admin.disabled && admin.role === 'admin', 'مدیر فعال در فهرست پیدا نشد.', 'ADMIN_CATALOG_MISSING');
      const adminRootKey = admin.auth.revision === this.session.revision ? this.session.key : this.adminKey(vault, admin.id, admin.auth.revision);
      const dossier = await this.decodeStudent(admin, adminRootKey);
      const legacyToken = Object.prototype.hasOwnProperty.call(dossier, 'publisherToken');
      delete dossier.publisherToken;
      if (legacyToken || canonical(dossier.keyVault || this.emptyVault()) !== canonical(vault)) {
        dossier.keyVault = vault;
        await this.encodeStudent(admin, dossier, adminRootKey);
      }
      catalog.updatedAt = new Date().toISOString();
      base.validateCatalog(catalog, this.scope);
      const staged = [...this.pendingStudentFiles.values()];
      const combined = [...files, ...staged.filter(file => !files.some(item => item.path === file.path))];
      const sourceActor = actorOf(snapshot.catalog, this.account.id);
      check(sourceActor && !sourceActor.disabled && sourceActor.role === 'admin', 'دسترسی مدیر منقضی شده است.', 'SESSION_REVOKED');
      const payload = {
        format: 'SalehinSc admin commit', version: 1, scope: this.scope,
        actorId: sourceActor.id, actorRevision: credentialRevision(sourceActor),
        createdAt: new Date().toISOString(), nonce: C.randomId(), expectedHead: snapshot.head,
        catalog,
        files: combined.map(file => {
          if (file.binary) return { path: file.path, encoding: 'base64', content: C.base64(file.content) };
          if (typeof file.content === 'string') return { path: file.path, encoding: 'utf-8', content: file.content };
          return { path: file.path, encoding: 'base64', content: C.base64(file.content) };
        })
      };
      // The commit is authorized by the currently active identity, even when this
      // same commit installs a freshly re-keyed administrator dossier.
      payload.signature = await sign(payload, this.dossier.identity.signingKey);
      try {
        const result = await this.workerCall('/v1/commit', payload);
        for (const file of staged) this.pendingStudentFiles.delete(file.path);
        this.catalog = catalog; this.account = admin; this.dossier = dossier;
        if (admin.auth.revision !== this.session.revision) {
          this.session.key = adminRootKey;
          this.session.revision = admin.auth.revision;
          if (this.session.authType === 'qr') this.session.qrRevision = credentialRevision(admin);
          await this.store.set('student-session', this.session);
        }
        return result;
      } catch (error) {
        if (error.code === 'CONFLICT') throw error;
        throw error;
      }
    }
    requireRole(...roles) { check(!this.offline, 'This saved view is read-only until the connection returns.', 'NETWORK'); check(this.session && this.account && !this.account.disabled && roles.includes(this.account.role), 'This operation is not available for this account.', 'FORBIDDEN'); }
    async syncRoster(catalog, vault) {
      for (const teacher of catalog.students.filter(account => account.role === 'teacher')) {
        const key = vault.students[teacher.id]?.keys?.[teacher.auth.revision]; if (!key) continue;
        teacher.assignedIds = teacher.allStudents ? catalog.students.filter(item => (item.role || 'student') === 'student' && !item.disabled).map(item => item.id) : (teacher.assignedIds || []).filter(id => actorOf(catalog, id));
        const dossier = await this.decodeStudent(teacher, key);
        const nextDirectory = await Promise.all(catalog.students.filter(student => teacher.assignedIds.includes(student.id) && !student.disabled).map(async student => {
          const studentKey = this.adminKey(vault, student.id, student.auth.revision);
          const data = await this.decodeStudent(student, studentKey); return { id: student.id, ...visibleProfile(data.profile) };
        }));
        // Re-encrypting every teacher dossier on every commit changes its ciphertext
        // even when their roster is identical. That made harmless portal updates look
        // like concurrent edits and caused profile saves to fail with CONFLICT.
        if (canonical(dossier.directory || []) !== canonical(nextDirectory)) {
          dossier.directory = nextDirectory;
          await this.encodeStudent(teacher, dossier, key);
        }
      }
    }
    async exportQrCredentials() {
      this.requireRole('admin');
      const catalog = base.validateCatalog(await this.repository.readPublic(this.config.dataPath), this.scope);
      let vault = await this.vault();
      const entries = [];
      for (const account of catalog.students) {
        const role = account.role || 'student';
        if (account.disabled || role !== 'student') continue;
        const key = vault.students[account.id]?.keys?.[account.auth.revision];
        check(key, `The private access key for account ${account.id} is missing from this device's administrator vault. Restore the administrator key backup before exporting.`, 'KEYS_REQUIRED');
        const dossier = await this.decodeStudent(account, key);
        let qr = account.qrAccess ? vault.students[account.id]?.qr : null;
        if (!account.qrAccess) {
          // Upgrade legacy root-key QR links on first export by re-keying the account
          // dossier and identity, while retaining encrypted history for continuity.
          const rotated = await this.rotateQr(account.id);
          qr = { key: rotated.key, revision: rotated.revision };
          vault = await this.vault();
        }
        check(qr?.key && qr.revision === (account.qrAccess?.revision || qr.revision), `QR access key for ${account.id} is missing; restore the administrator backup.`, 'KEYS_REQUIRED');
        entries.push({ name: String(dossier.profile?.name || 'Student').trim(), id: account.id, key: qr.key, revision: qr.revision, role, grade: dossier.profile?.grade || '' });
      }
      return entries;
    }
    async createAccount({ role, loginKey = base.generateLoginKey(), password, profile, assignedIds = [], allStudents = false }) {
      this.requireRole('admin'); check(['student', 'teacher'].includes(role), 'Only teachers and students can be created.');
      return this.exclusive(async vault => {
        check(profile?.name?.trim() && profile.name.length <= 120, 'A name is required.');
        check(role !== 'student' || profile.grade?.trim(), 'A student grade is required.');
        const id = await base.accountId(loginKey), snapshot = await this.snapshot(), catalog = structuredClone(snapshot.catalog);
        check(!actorOf(catalog, id), 'This login key is already in use.');
        check(Array.isArray(assignedIds) && assignedIds.every(id => { const student = actorOf(catalog, id); return student && (student.role || 'student') === 'student'; }), 'Invalid class assignment.');
        const keys = await identity(), key = C.randomKey();
        const dossier = { profile: { ...profile, role, grade: profile.grade || 'دبیر', assessments: profile.assessments || [] }, identity: keys.private, attachments: [], announcements: {}, directory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        const account = await this.makeStudent(id, key, loginKey, password, dossier);
        Object.assign(account, keys.public, { role, assignedIds: [...new Set(assignedIds)], allStudents: Boolean(allStudents) });
        const qr = await createQrGrant(this.scope, id, key); account.qrAccess = qr.descriptor;
        vault.students[id] = { loginKey: loginKey.trim(), keys: { [account.auth.revision]: key }, qr: { key: qr.key, revision: qr.revision } }; await this.store.set('admin-vault', vault);
        catalog.students.push(account); catalog.identities = { ...catalog.identities, [id]: keys.public.signingKey };
        await this.commit(snapshot, catalog); return { id, role, qrKey: qr.key, qrRevision: qr.revision, qrFragment: base.makeQrFragment(id, qr.key, qr.revision) };
      });
    }
    async rotateLocalTeacherAccess() {
      this.requireRole('admin');
      // Re-key the primary account and its signing identity. The returned access
      // secret is placed only in a local teacher.html file, never in a QR or public asset.
      const rotated = await this.rotateQr(this.account.id);
      return { id: rotated.id, key: rotated.key, revision: rotated.revision };
    }
    async rotateQr(id = this.account?.id) {
      this.requireRole('admin');
      return this.exclusive(async vault => {
        const snapshot = await this.snapshot(), catalog = structuredClone(snapshot.catalog);
        const previous = actorOf(catalog, id);
        check(previous && !previous.disabled, 'این حساب فعال نیست.', 'NOT_FOUND');
        const oldRootKey = id === this.account.id ? this.session.key : this.adminKey(vault, id, previous.auth.revision);
        const oldDossier = await this.decodeStudent(previous, oldRootKey);
        const loginKey = vault.students[id]?.loginKey;
        check(typeof loginKey === 'string' && loginKey.trim(), 'برای این حساب نسخه پشتیبان کلید مدیر لازم است.', 'KEYS_REQUIRED');

        // Rotate the actual dossier and identity keys, not only the QR wrapper.
        // Otherwise a holder of an old QR could recover the old root key from Git
        // history and continue decrypting later dossiers/messages.
        const nextRootKey = C.randomKey();
        const nextIdentity = await identity();
        oldDossier.identityHistory = [...(oldDossier.identityHistory || []), oldDossier.identity];
        oldDossier.identity = nextIdentity.private;
        oldDossier.updatedAt = new Date().toISOString();
        const qr = await createQrGrant(this.scope, id, nextRootKey);
        if (previous.role === 'admin') oldDossier.keyVault = vault;

        const next = await this.makeStudent(id, nextRootKey, loginKey, C.randomKey(), oldDossier);
        Object.assign(next, nextIdentity.public, {
          role: previous.role || 'student',
          assignedIds: previous.assignedIds || [],
          allStudents: Boolean(previous.allStudents),
          disabled: Boolean(previous.disabled),
          qrAccess: qr.descriptor
        });
        const oldSigningKey = previous.signingKey || catalog.identities?.[id];
        if (oldSigningKey) {
          const history = [...(catalog.identityHistory?.[id] || [])];
          if (!history.some(key => canonical(key) === canonical(oldSigningKey))) history.push(oldSigningKey);
          catalog.identityHistory = { ...(catalog.identityHistory || {}), [id]: history };
        }
        catalog.identities = { ...(catalog.identities || {}), [id]: nextIdentity.public.signingKey };
        catalog.students[catalog.students.findIndex(account => account.id === id)] = next;
        vault.students[id] = { loginKey, keys: { [next.auth.revision]: nextRootKey }, qr: { key: qr.key, revision: qr.revision } };
        await this.store.set('admin-vault', vault);
        await this.commit(snapshot, catalog);
        return { id, key: qr.key, revision: qr.revision, qrFragment: base.makeQrFragment(id, qr.key, qr.revision) };
      });
    }
    async updateAccount(id, { profile, disabled, assignedIds, allStudents, expectedRevision }) {
      this.requireRole('admin');
      return this.exclusive(async vault => {
        const snapshot = await this.snapshot(), catalog = structuredClone(snapshot.catalog), account = this.findStudent(catalog, id, expectedRevision);
        check(expectedRevision, 'Refresh the account before editing.');
        check(account.role !== 'admin' || disabled !== true, 'The bootstrap administrator cannot be disabled.');
        const key = this.adminKey(vault, id, account.auth.revision), dossier = await this.decodeStudent(account, key);
        if (profile) { check(profile.name?.trim(), 'A name is required.'); dossier.profile = { ...dossier.profile, ...profile, role: account.role || 'student' }; }
        if (typeof disabled === 'boolean') account.disabled = disabled;
        if (account.role === 'teacher') {
          if (assignedIds) { check(Array.isArray(assignedIds) && assignedIds.every(id => { const student = actorOf(catalog, id); return student && (student.role || 'student') === 'student'; }), 'Invalid class assignment.'); account.assignedIds = [...new Set(assignedIds)]; }
          if (typeof allStudents === 'boolean') account.allStudents = allStudents;
        }
        dossier.updatedAt = new Date().toISOString(); await this.encodeStudent(account, dossier, key); await this.commit(snapshot, catalog);
      });
    }
    async resetAccountPassword(id, password, expectedRevision) {
      this.requireRole('admin');
      return this.exclusive(async vault => {
        const snapshot = await this.snapshot(), catalog = structuredClone(snapshot.catalog), previous = this.findStudent(catalog, id, expectedRevision);
        check(expectedRevision && previous.role !== 'admin', 'Use a private administrator recovery procedure for the bootstrap account.');
        const dossier = await this.decodeStudent(previous, this.adminKey(vault, id, previous.auth.revision)), key = C.randomKey();
        const next = await this.makeStudent(id, key, vault.students[id].loginKey, password, dossier);
        Object.assign(next, { role: previous.role, encryptionKey: previous.encryptionKey, signingKey: previous.signingKey, assignedIds: previous.assignedIds || [], allStudents: previous.allStudents || false, disabled: previous.disabled });
        vault.students[id].keys[next.auth.revision] = key; await this.store.set('admin-vault', vault);
        catalog.students[catalog.students.findIndex(account => account.id === id)] = next; await this.commit(snapshot, catalog);
      });
    }
    async saveSite({ schoolName, schoolYear }) {
      this.requireRole('admin');
      return this.exclusive(async () => {
        const snapshot = await this.snapshot(), catalog = structuredClone(snapshot.catalog);
        check(typeof schoolName === 'string' && schoolName.trim() && schoolName.length <= 160, 'A school name is required.');
        catalog.site = { schoolName: schoolName.trim(), schoolYear: String(schoolYear || '').slice(0, 40) };
        await this.commit(snapshot, catalog);
      });
    }
    async loadDirectory() {
      this.requireRole('admin', 'teacher');
      let accounts;
      if (this.account.role === 'teacher') accounts = this.dossier.directory || [];
      else {
        // refreshStudent() has already fetched the latest conditional catalog. Reuse
        // it here instead of hitting the GitHub REST API twice more for every refresh.
        const catalog = this.catalog || (await this.snapshot()).catalog;
        const vault = await this.vault();
        accounts = await Promise.all(catalog.students.map(async student => {
          const key = vault.students[student.id]?.keys?.[student.auth.revision];
          const dossier = key ? await this.decodeStudent(student, this.adminKey(vault, student.id, student.auth.revision)) : null;
          return { id: student.id, revision: this.studentRevision(student), disabled: Boolean(student.disabled), ...(dossier?.profile || {}), locked: !dossier };
        }));
      }
      try { await this.store.set('last-directory', { accountId: this.account.id, revision: this.session.revision, savedAt: new Date().toISOString(), accounts }); } catch { /* Directory remains available from the live response. */ }
      return accounts;
    }
    async loadStudentRecord(id) {
      this.requireRole('admin');
      const catalog = base.validateCatalog(await this.repository.readPublic(this.config.dataPath), this.scope);
      const account = actorOf(catalog, id);
      check(account && (account.role || 'student') === 'student', 'Student record was not found.', 'NOT_FOUND');
      const vault = await this.vault();
      const key = this.adminKey(vault, account.id, account.auth.revision);
      const dossier = await this.decodeStudent(account, key);
      const messages = await this.readMessages(catalog, account, dossier);
      const scores = await this.readScores(catalog, account, dossier);
      return {
        id: account.id,
        revision: this.studentRevision(account),
        disabled: Boolean(account.disabled),
        profile: { ...dossier.profile },
        assessments: Array.isArray(dossier.profile?.assessments) ? dossier.profile.assessments : [],
        scores,
        messages
      };
    }
    async makeMessage({ title, blocks, recipients, category = 'message', pinned = false, files = [], score }, catalogOverride) {
      this.requireRole('admin', 'teacher');
      check(typeof title === 'string' && title.trim() && title.length <= 200, 'A title of up to 200 characters is required.');
      check(Array.isArray(blocks) && blocks.length <= 100 && blocks.every(block => ['text', 'attachment'].includes(block.type)) && JSON.stringify(blocks).length <= 30000, 'Message text is too long.');
      check(['message', 'announcement', 'score'].includes(category) && Array.isArray(recipients) && recipients.length, 'Choose recipients.');
      check(Array.isArray(files) && files.length <= 12 && files.reduce((sum, file) => sum + file.size, 0) <= MAX_BATCH_BYTES, 'Use at most 12 files and 16 MiB per message.');
      if (category === 'score') check(score && typeof score.title === 'string' && score.title.trim() && Number.isFinite(score.score) && Number.isFinite(score.total) && score.total > 0 && score.score >= 0 && score.score <= score.total && recipients.length === 1, 'Choose one student and a valid score.');
      const catalog = catalogOverride || base.validateCatalog(await this.repository.readPublic(this.config.dataPath), this.scope);
      const actor = actorOf(catalog, this.account.id); check(actor && !actor.disabled && actor.auth.revision === this.session?.revision, 'Sign in again.', 'SESSION_REVOKED');
      const allowed = new Set(allowedRecipients(catalog, actor).map(account => account.id)); check(recipients.every(id => allowed.has(id)), 'A recipient is outside your assigned classes.', 'FORBIDDEN');
      const ids = [...new Set([...recipients, actor.id, ...catalog.students.filter(account => account.role === 'admin' && !account.disabled).map(account => account.id)])];
      const prepared = []; for (const file of files) prepared.push(await prepareFile(file, this.scope));
      const id = C.randomId(), key = C.randomKey(), createdAt = new Date().toISOString();
      const safeBlocks = blocks.map(block => block.type === 'text' ? { type: 'text', text: String(block.text || '') } : { type: 'attachment', attachmentId: prepared[block.fileIndex]?.descriptor.id });
      check(safeBlocks.every(block => block.type !== 'attachment' || block.attachmentId), 'An inline attachment is missing.');
      if (category === 'score') check((actorOf(catalog, recipients[0])?.role || 'student') === 'student', 'Scores must target a student.');
      const body = { title: title.trim(), blocks: safeBlocks, attachments: prepared.map(item => item.descriptor), author: { ...visibleProfile(this.dossier.profile), avatar: this.dossier.profile.avatar || null }, score: score || null, studentId: category === 'score' ? recipients[0] : null };
      const message = { format: 'SalehinSc message', version: 1, id, authorId: actor.id, category, pinned: Boolean(pinned), createdAt, recipients: await Promise.all(ids.map(recipientId => wrapFor(key, actorOf(catalog, recipientId), `${messageContext(this.scope, id)}:${recipientId}`))), payload: await C.seal(body, key, messageContext(this.scope, id)) };
      message.signature = await sign(message, this.dossier.identity.signingKey);
      return { id, message, files: prepared.map(item => item.file) };
    }
    async publishMessage(input, onProgress = () => {}) {
      if (this.account.role === 'admin') {
        check(this.admin, 'سرویس امن مدیریت مدرسه در دسترس نیست.', 'PUBLISHING_SETUP');
        // Build the encrypted message from the same catalog snapshot that is being
        // committed. If another administrator wins the Git ref race, re-read and
        // rebuild instead of leaving the Send button as a dead end.
        return this.exclusive(async () => {
          for (let attempt = 0; attempt < 4; attempt++) {
            const snapshot = await this.snapshot();
            const prepared = await this.makeMessage(input, snapshot.catalog);
            const catalog = structuredClone(snapshot.catalog);
            const scoreRecord = prepared.message.category === 'score';
            const collection = scoreRecord ? 'scores' : 'messages';
            const path = `data/${collection}/${prepared.id}.json`;
            catalog[collection] = [...(catalog[collection] || []), { id: prepared.id, path, recipients: prepared.message.recipients.map(item => item.id) }];
            if (prepared.message.pinned && !scoreRecord) catalog.site = { ...(catalog.site || {}), pinnedMessage: prepared.id };
            try {
              await this.commit(snapshot, catalog, [...prepared.files, { path, content: JSON.stringify(prepared.message) }]);
              return { id: prepared.id, status: 'published' };
            } catch (error) {
              if (error.code !== 'CONFLICT' || attempt === 3) throw error;
            }
          }
        });
      }
      const prepared = await this.makeMessage(input);
      return this.stageRequest({ operation: 'message', message: prepared.message, id: prepared.id }, prepared.files, onProgress);
    }
    async stageRequest(operation, files, onProgress = () => {}) {
      this.requireRole('admin', 'teacher');
      const requestId = operation.id || C.randomId();
      const metadata = await Promise.all(files.map(async file => ({ path: file.path, size: file.content.length, hash: await digest(file.content) })));
      const proof = { format: 'SalehinSc staging request', version: 1, scope: this.scope, actorId: this.account.id, actorRevision: credentialRevision(this.account), createdAt: new Date().toISOString(), requestId, files: metadata };
      proof.signature = await sign(proof, this.dossier.identity.signingKey);
      const staged = await this.workerCall('/v1/stage', { proof, files: files.map((file, index) => ({ ...metadata[index], content: C.base64(file.content) })) });
      let request = { format: 'SalehinSc signed request', version: 1, scope: this.scope, id: requestId, actorId: this.account.id, actorRevision: credentialRevision(this.account), createdAt: proof.createdAt, ...operation, files: staged.files };
      request.signature = await sign(request, this.dossier.identity.signingKey);
      await this.workerCall('/v1/submit', { issue: staged.issue, request });
      const entry = { id: request.id, issue: staged.issue, createdAt: request.createdAt };
      const addPending = async () => {
        const previous = await this.store.get('pending-publishes');
        const list = Array.isArray(previous) ? previous : [];
        await this.store.set('pending-publishes', [...list.filter(item => item.id !== entry.id), entry]);
      };
      if (root.navigator?.locks) await navigator.locks.request(`${this.scope}:pending-publishes`, addPending); else await addPending();
      onProgress(1);
      return { id: request.id, issue: staged.issue, status: 'pending' };
    }
    async updateOwnProfile({ name, title, subject, avatarFile }) {
      this.requireRole('admin', 'teacher'); check(name?.trim() && name.trim().length <= 120, 'A name is required.');
      const prepared = avatarFile ? await base.prepareImage(avatarFile, this.scope) : null;
      const updateProfile = dossier => {
        dossier.profile = { ...dossier.profile, name: name.trim(), title: String(title || '').slice(0, 120), subject: String(subject || '').slice(0, 120) };
        if (prepared) dossier.profile.avatar = prepared.descriptor;
        dossier.updatedAt = new Date().toISOString();
        return dossier;
      };
      if (this.account.role === 'admin') return this.exclusive(async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
          const snapshot = await this.snapshot(), catalog = structuredClone(snapshot.catalog);
          const account = actorOf(catalog, this.account.id);
          check(account && !account.disabled && account.auth.revision === this.session?.revision, 'Sign in again.', 'SESSION_REVOKED');
          // Use the newest encrypted dossier, preserving newer key-vault and account
          // changes instead of rejecting a harmless edit because this tab was stale.
          const dossier = updateProfile(await this.decodeStudent(account, this.session.key));
          await this.encodeStudent(account, dossier, this.session.key);
          try {
            await this.commit(snapshot, catalog, prepared ? [prepared.file] : []);
            return { status: 'published' };
          } catch (error) {
            if (error.code !== 'CONFLICT' || attempt === 3) throw error;
          }
        }
      });
      // Teachers publish via the signed workflow, but the request should be based on
      // the latest public account payload, not the possibly stale object from login.
      const latestCatalog = base.validateCatalog(await this.repository.readPublic(this.config.dataPath), this.scope);
      const latestAccount = actorOf(latestCatalog, this.session.id);
      check(latestAccount && !latestAccount.disabled && latestAccount.auth.revision === this.session.revision, 'Sign in again.', 'SESSION_REVOKED');
      const currentDossier = await this.decodeStudent(latestAccount, this.session.key);
      const draftDossier = updateProfile(structuredClone(currentDossier));
      const payload = await C.seal(draftDossier, this.session.key, C.profileContext(this.scope, latestAccount));
      this.account = latestAccount; this.catalog = latestCatalog; this.dossier = currentDossier;
      const payloadRevision = await digest(enc.encode(payload.ciphertext));
      return this.stageRequest({ operation: 'profile', accountId: latestAccount.id, expectedRevision: this.studentRevision(latestAccount), payload, payloadRevision }, prepared ? [prepared.file] : []);
    }
    async readMessages(catalog = this.catalog, account = this.account, dossier = this.dossier) {
      if (!dossier.identity) return [];
      const messages = [];
      const activePinnedId = catalog.site?.pinnedMessage || '';
      for (const index of catalog.messages || []) {
        if (!index.recipients?.includes(account.id)) continue;
        check(idPattern.test(index.id) && index.path === `data/messages/${index.id}.json`, 'Invalid message index.');
        let decoded = this.messageCache.get(index.id);
        if (!decoded) {
          const message = await this.repository.readPublic(index.path);
          const { signature, ...unsigned } = message;
          check(message.id === index.id && await verifyMessageAuthor(unsigned, signature, catalog, message.authorId), 'A message signature could not be verified.', 'TAMPERED');
          const grant = message.recipients.find(item => item.id === account.id); check(grant, 'A message key is missing.');
          const key = await unwrapForHistory(grant, dossier, `${messageContext(this.scope, message.id)}:${account.id}`);
          decoded = { id: message.id, category: message.category, pinned: Boolean(message.pinned), createdAt: message.createdAt, authorId: message.authorId, ...await C.open(message.payload, key, messageContext(this.scope, message.id)) };
          this.messageCache.set(index.id, decoded);
        }
        messages.push({ ...decoded, pinned: activePinnedId ? index.id === activePinnedId : Boolean(decoded.pinned) });
      }
      if (!activePinnedId) {
        let assigned = false;
        for (const message of messages) { message.pinned = Boolean(message.pinned && !assigned); if (message.pinned) assigned = true; }
      }
      return messages.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
    }
    async readScores(catalog = this.catalog, account = this.account, dossier = this.dossier) {
      if (!dossier.identity) return [];
      const scores = [];
      for (const index of catalog.scores || []) {
        if (!index.recipients?.includes(account.id)) continue;
        check(idPattern.test(index.id) && index.path === `data/scores/${index.id}.json`, 'Invalid score index.');
        let decoded = this.messageCache.get(index.id);
        if (!decoded) {
          const message = await this.repository.readPublic(index.path);
          const { signature, ...unsigned } = message;
          check(message.id === index.id && message.category === 'score' && await verifyMessageAuthor(unsigned, signature, catalog, message.authorId), 'A score record could not be verified.', 'TAMPERED');
          const grant = message.recipients.find(item => item.id === account.id); check(grant, 'A score access key is missing.');
          const key = await unwrapForHistory(grant, dossier, `${messageContext(this.scope, message.id)}:${account.id}`);
          decoded = { id: message.id, category: 'score', pinned: false, createdAt: message.createdAt, authorId: message.authorId, ...await C.open(message.payload, key, messageContext(this.scope, message.id)) };
          this.messageCache.set(index.id, decoded);
        }
        scores.push(decoded);
      }
      return scores.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    async readFile(descriptor) {
      const cacheKey = `file-cache:${descriptor.id}`;
      let cached;
      try { cached = await this.store.get(cacheKey); } catch { cached = null; }
      // Prefer the repository while online so a cached copy can never hide a
      // changed or tampered remote attachment. The cache is an offline fallback.
      let blob;
      try {
        if (descriptor.kind !== 'file') blob = await super.readImage(descriptor);
        else {
          validateFileDescriptor(descriptor); const ciphertext = await this.repository.readPublic(descriptor.path, 'bytes');
          check(ciphertext.length === descriptor.size + 16 && await digest(ciphertext) === descriptor.hash, 'This attachment was damaged or changed.', 'TAMPERED');
          const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: C.unbase64(descriptor.iv), additionalData: enc.encode(`${this.scope}:file:${descriptor.id}`) }, await C.aesKey(descriptor.key), ciphertext);
          blob = new Blob([plain], { type: descriptor.inline ? descriptor.mime : 'application/octet-stream' });
        }
      } catch (error) {
        if (cached?.data && error.code === 'NETWORK') return new Blob([C.unbase64(cached.data)], { type: cached.type || 'application/octet-stream' });
        throw error;
      }
      // Keep only small, recently used files so IndexedDB stays bounded on shared devices.
      if (blob.size <= 1024 * 1024) {
        try {
          await this.store.set(cacheKey, { type: blob.type || 'application/octet-stream', data: C.base64(new Uint8Array(await blob.arrayBuffer())) });
          let ids = await this.store.get('cached-file-ids') || [];
          ids = ids.filter(id => id !== descriptor.id); ids.push(descriptor.id);
          while (ids.length > 8) { const expired = ids.shift(); await this.store.delete(`file-cache:${expired}`); }
          await this.store.set('cached-file-ids', ids);
        } catch { try { await this.store.delete(cacheKey); } catch { /* Avoid leaving an untracked partial cache entry. */ } }
      }
      return blob;
    }
    async deleteMessage(id) {
      this.requireRole('admin'); return this.exclusive(async () => {
        const snapshot = await this.snapshot(), catalog = structuredClone(snapshot.catalog);
        catalog.messages = (catalog.messages || []).filter(message => message.id !== id);
        if (catalog.site?.pinnedMessage === id) { catalog.site = { ...catalog.site }; delete catalog.site.pinnedMessage; }
        await this.commit(snapshot, catalog); this.messageCache.delete(id);
      });
    }
    async pendingStatus() {
      let entries = await this.store.get('pending-publishes');
      entries = Array.isArray(entries) ? entries : [];
      const legacy = await this.store.get('pending-publish');
      if (legacy && !entries.some(item => item.id === legacy.id)) entries.push(legacy);
      if (!entries.length) return null;

      const active = [], completed = [];
      for (const item of entries) {
        try {
          const receipt = await this.repository.readPublic(`data/requests/${item.id}.json`);
          if (receipt?.status === 'published') { completed.push({ ...item, ...receipt, status: 'published' }); continue; }
        } catch (error) {
          if (error.code !== 'NOT_FOUND' && error.code !== 'NETWORK') throw error;
        }
        if (Date.now() - Date.parse(item.createdAt) > 24 * 60 * 60 * 1000) {
          completed.push({ ...item, status: 'failed' }); continue;
        }
        active.push(item);
      }

      // Publication receipts are public, immutable per request, and sufficient for
      // pending status. The browser never needs a GitHub credential to poll Actions.
      // A second tab may finish staging a request while receipt checks above are
      // waiting on the network. Re-read before persisting so this refresh cannot
      // overwrite that newer request with the older snapshot it started with.
      const knownIds = new Set(entries.map(item => item.id));
      const savePending = async () => {
        const latest = await this.store.get('pending-publishes');
        const newlyAdded = (Array.isArray(latest) ? latest : []).filter(item => !knownIds.has(item.id));
        const merged = new Map([...active, ...newlyAdded].map(item => [item.id, item]));
        await this.store.set('pending-publishes', [...merged.values()]);
        await this.store.delete('pending-publish');
      };
      if (root.navigator?.locks) await navigator.locks.request(`${this.scope}:pending-publishes`, savePending);
      else await savePending();
      if (active.length) return { ...active[0], status: 'pending' };
      if (completed.length) return completed.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
      return null;
    }
  }
  async function createBootstrap(config, { loginKey, password, name }) {
    const portal = new base.Portal(config), id = await base.accountId(loginKey), key = C.randomKey(), keys = await identity();
    const dossier = { profile: { name, role: 'admin', grade: 'مدیریت', title: 'مدیر سامانه', assessments: [] }, identity: keys.private, attachments: [], announcements: {}, directory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const account = await portal.makeStudent(id, key, loginKey, password, dossier);
    Object.assign(account, keys.public, { role: 'admin', assignedIds: [] });
    const qr = await createQrGrant(portal.scope, id, key); account.qrAccess = qr.descriptor;
    dossier.keyVault = portal.emptyVault(); dossier.keyVault.students[id] = { loginKey, keys: { [account.auth.revision]: key }, qr: { key: qr.key, revision: qr.revision } };
    await portal.encodeStudent(account, dossier, key);
    const catalog = base.emptyCatalog(portal.scope); catalog.students = [account]; catalog.messages = []; catalog.identities = { [id]: keys.public.signingKey }; catalog.site = { schoolName: 'مدرسه صالحین', schoolYear: '۱۴۰۵ — ۱۴۰۶' };
    return { catalog, files: [...portal.pendingStudentFiles.values()], qrFragment: base.makeQrFragment(id, qr.key, qr.revision) };
  }
  const api = Object.freeze({ RolePortal, createBootstrap, canonical, sign, verify, digest, validateRequest, prepareFile, credentialRevision, createQrGrant, MAX_FILE_BYTES, MAX_BATCH_BYTES });
  root.SalehinRoles = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
