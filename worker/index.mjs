const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });
const ID32 = /^[a-f0-9]{32}$/;
const ID64 = /^[a-f0-9]{64}$/;
const MAX_BODY = 28 * 1024 * 1024;
const MAX_FILE = 8 * 1024 * 1024;
const MAX_BATCH = 16 * 1024 * 1024;
const CHUNK_BYTES = 42000;
const PUBLISH_WORKFLOW = 'portal-publish.yml';

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function check(value, message, status = 400) {
  if (!value) fail(message, status);
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function b64(bytes) {
  let binary = '';
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
  return btoa(binary);
}
function unb64(value) {
  const raw = atob(value);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}
function hex(bytes) {
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}
async function sha256(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}
function repoConfig(env) {
  const [owner, repo, extra] = String(env.GITHUB_REPOSITORY || '').split('/');
  check(owner && repo && !extra, 'Worker repository configuration is invalid.', 500);
  const branch = String(env.GITHUB_BRANCH || 'main');
  const dataPath = String(env.DATA_PATH || 'data/portal.json');
  check(/^[A-Za-z0-9_.-]+$/.test(owner) && /^[A-Za-z0-9_.-]+$/.test(repo), 'Worker repository configuration is invalid.', 500);
  check(/^[A-Za-z0-9_./-]{1,120}$/.test(branch) && !branch.includes('..'), 'Worker branch configuration is invalid.', 500);
  check(dataPath === 'data/portal.json', 'Worker data path is invalid.', 500);
  return {
    owner, repo, branch, dataPath,
    scope: `SalehinSc:v4:${owner.toLowerCase()}/${repo.toLowerCase()}:${branch}:${dataPath}`,
    api: `https://api.github.com/repos/${owner}/${repo}`
  };
}
function headers(env, accept = 'application/vnd.github+json') {
  check(typeof env.GITHUB_TOKEN === 'string' && env.GITHUB_TOKEN.length > 20, 'The server-side GitHub credential is not configured.', 503);
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'SalehinSc-Worker'
  };
}
async function github(env, path, options = {}, allowNotFound = false) {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${path}`, {
    ...options,
    headers: { ...headers(env), ...(options.headers || {}) }
  });
  if (allowNotFound && response.status === 404) return null;
  const text = await response.text();
  let result = {};
  try { result = text ? JSON.parse(text) : {}; } catch { result = { message: text.slice(0, 500) }; }
  if (!response.ok) {
    const status = response.status === 409 || response.status === 422 ? 409 : response.status === 401 || response.status === 403 ? 502 : 502;
    const message = response.status === 409 || response.status === 422
      ? 'داده‌های مخزن هم‌زمان تغییر کرده‌اند؛ صفحه را تازه کنید و دوباره تلاش کنید.'
      : `GitHub API ${response.status}: ${String(result.message || 'request failed').slice(0, 220)}`;
    fail(message, status);
  }
  return result;
}
async function currentHead(env, cfg) {
  const ref = await github(env, `/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
  const head = ref?.object?.sha;
  check(typeof head === 'string' && /^[a-f0-9]{40}$/.test(head), 'Could not read the repository branch.', 502);
  return head;
}
async function readCatalog(env, cfg) {
  const result = await github(env, `/contents/${cfg.dataPath}?ref=${encodeURIComponent(cfg.branch)}`);
  check(result.encoding === 'base64' && typeof result.content === 'string', 'The school catalogue could not be read.', 502);
  let catalog;
  try { catalog = JSON.parse(dec.decode(unb64(result.content.replace(/\s/g, '')))); }
  catch { fail('The school catalogue is invalid JSON.', 502); }
  validateCatalog(catalog, cfg.scope);
  return catalog;
}
const TEACHER_DIRECTORY_PATH = 'data/teachers/teacher.json';
async function readTeacherDirectory(env, cfg) {
  const result = await github(env, `/contents/${TEACHER_DIRECTORY_PATH}?ref=${encodeURIComponent(cfg.branch)}`);
  check(result.encoding === 'base64' && typeof result.content === 'string', 'فهرست دبیر اصلی در مخزن پیدا نشد؛ مهاجرت فهرست دبیران را اجرا کنید.', 409);
  let directory;
  try { directory = JSON.parse(dec.decode(unb64(result.content.replace(/\s/g, '')))); }
  catch { fail('فهرست دبیر اصلی معتبر نیست.', 409); }
  validateTeacherDirectory(directory);
  return directory;
}
function validateTeacherDirectory(directory) {
  check(directory && directory.format === 'SalehinSc teacher directory' && directory.version === 1
    && ID64.test(directory.primaryTeacherId || '') && Array.isArray(directory.teachers)
    && directory.teachers.length >= 1 && directory.teachers.length <= 100,
  'فهرست دبیران معتبر نیست.', 409);
  const ids = new Set();
  for (const teacher of directory.teachers) {
    check(teacher && ID64.test(teacher.id || '') && !ids.has(teacher.id)
      && typeof teacher.active === 'boolean' && ['primary', 'teacher'].includes(teacher.kind),
    'یک ورودی فهرست دبیران معتبر نیست.', 409);
    ids.add(teacher.id);
  }
  const primary = directory.teachers.filter(teacher => teacher.kind === 'primary');
  check(primary.length === 1 && primary[0].id === directory.primaryTeacherId && primary[0].active,
    'دسترسی دبیر اصلی غیرفعال یا نامعتبر است.', 403);
  return directory;
}
function validateCatalog(catalog, scope) {
  check(catalog && catalog.format === 'SalehinSc portal' && catalog.version === 4 && catalog.scope === scope, 'This repository does not contain the expected SalehinSc catalogue.', 409);
  check(Array.isArray(catalog.students) && catalog.students.length <= 20000, 'The school catalogue is invalid.', 409);
  const ids = new Set();
  for (const account of catalog.students) {
    check(account && ID64.test(account.id || '') && !ids.has(account.id) && account.auth && ID32.test(account.auth.revision || ''), 'A school account in the catalogue is invalid.', 409);
    ids.add(account.id);
    check(['student', 'teacher', 'admin'].includes(account.role || 'student'), 'An account role is invalid.', 409);
    if (account.qrAccess) {
      const wrapped = account.qrAccess.wrappedKey;
      check(ID32.test(account.qrAccess.revision || '') && wrapped?.algorithm === 'A256GCM'
        && typeof wrapped.iv === 'string' && wrapped.iv.length <= 64
        && typeof wrapped.ciphertext === 'string' && wrapped.ciphertext.length >= 16 && wrapped.ciphertext.length <= 4096,
      'A QR access grant is invalid.', 409);
    }
  }
}
function revision(account) {
  return account?.qrAccess?.revision || account?.auth?.revision || '';
}
async function verifySigned(value, actor) {
  const signature = value?.signature;
  check(typeof signature === 'string' && signature.length < 1024 && actor?.signingKey?.kty === 'EC' && actor.signingKey.crv === 'P-256', 'Invalid request signature.', 403);
  const { signature: _ignored, ...unsigned } = value;
  let key;
  try {
    key = await crypto.subtle.importKey('jwk', actor.signingKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  } catch { fail('The account signing key is invalid.', 403); }
  let bytes;
  try { bytes = unb64(signature); } catch { fail('Invalid request signature.', 403); }
  const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, bytes, enc.encode(canonical(unsigned)));
  check(valid, 'درخواست امضای معتبر ندارد.', 403);
}
function timestampCheck(value, maxAge = 5 * 60 * 1000) {
  const time = Date.parse(value || '');
  check(Number.isFinite(time) && Math.abs(Date.now() - time) <= maxAge, 'این درخواست منقضی شده است.', 403);
}
async function authorize(payload, catalog, cfg, roles, format, action) {
  check(payload?.format === format && payload.version === 1 && payload.scope === cfg.scope && (!action || payload.action === action), 'درخواست معتبر نیست.');
  timestampCheck(payload.createdAt);
  const actor = catalog.students.find(item => item.id === payload.actorId);
  check(actor && !actor.disabled && roles.includes(actor.role || 'student'), 'این حساب اجازه این عملیات را ندارد.', 403);
  check(revision(actor) === payload.actorRevision, 'این QR لغو یا جایگزین شده است.', 403);
  await verifySigned(payload, actor);
  return actor;
}
async function authorizePrimaryTeacher(payload, catalog, directory, cfg, format, action) {
  const actor = await authorize(payload, catalog, cfg, ['admin'], format, action);
  validateTeacherDirectory(directory);
  check(directory.primaryTeacherId === actor.id, 'این QR متعلق به دبیر اصلی فعال نیست.', 403);
  const entry = directory.teachers.find(teacher => teacher.id === actor.id && teacher.kind === 'primary');
  check(entry?.active === true, 'دسترسی دبیر اصلی لغو شده است.', 403);
  return actor;
}
async function authorizeListedTeacher(payload, catalog, directory, cfg, format, action) {
  const actor = await authorize(payload, catalog, cfg, ['teacher'], format, action);
  validateTeacherDirectory(directory);
  const entry = directory.teachers.find(teacher => teacher.id === actor.id && teacher.kind === 'teacher');
  check(entry?.active === true, 'این دبیر در فهرست دسترسی فعال نیست.', 403);
  return actor;
}
async function authorizeStaff(payload, catalog, directory, cfg, format, action) {
  const candidate = catalog.students.find(item => item.id === payload?.actorId);
  if (candidate?.role === 'admin') return authorizePrimaryTeacher(payload, catalog, directory, cfg, format, action);
  return authorizeListedTeacher(payload, catalog, directory, cfg, format);
}
function safePath(path) {
  return path === 'data/portal.json'
    || /^data\/students\/[a-f0-9]{64}\.json$/.test(path)
    || /^data\/(?:messages|scores)\/[a-f0-9]{32}\.json$/.test(path)
    || /^data\/attachments\/[a-f0-9]{32}\.bin$/.test(path);
}
async function createCommit(env, cfg, payload, expectedHead, catalog) {
  const head = await currentHead(env, cfg);
  check(head === expectedHead, 'داده‌های مخزن هم‌زمان تغییر کرده‌اند؛ فهرست را تازه کنید.', 409);
  const commit = await github(env, `/git/commits/${head}`);
  const files = Array.isArray(payload.files) ? payload.files : [];
  check(files.length <= 300, 'درخواست تعداد فایل بیش از حد دارد.');
  let total = 0;
  const tree = [];
  const contentFiles = [{ path: cfg.dataPath, encoding: 'utf-8', content: `${JSON.stringify(catalog, null, 2)}\n` }, ...files];
  const seen = new Set([cfg.dataPath]);
  for (const item of contentFiles) {
    check(item && typeof item.path === 'string' && safePath(item.path) && !seen.has(item.path), 'مسیر فایل مجاز نیست.');
    seen.add(item.path);
    let bytes;
    if (item.encoding === 'base64') {
      check(typeof item.content === 'string' && item.content.length <= Math.ceil(MAX_FILE * 4 / 3) + 16, 'محتوای فایل بیش از اندازه بزرگ است.');
      try { bytes = unb64(item.content); } catch { fail('محتوای فایل معتبر نیست.'); }
    } else if (item.encoding === 'utf-8') {
      check(typeof item.content === 'string' && item.content.length <= MAX_FILE, 'محتوای فایل بیش از اندازه بزرگ است.');
      bytes = enc.encode(item.content);
    } else fail('نوع محتوای فایل پشتیبانی نمی‌شود.');
    total += bytes.length;
    check(bytes.length > 0 && bytes.length <= MAX_FILE && total <= MAX_BATCH, 'حجم فایل‌ها از حد مجاز بیشتر است.');
    const blob = await github(env, '/git/blobs', { method: 'POST', headers: { 'Content-Type': 'application/vnd.github+json' }, body: JSON.stringify({ content: b64(bytes), encoding: 'base64' }) });
    tree.push({ path: item.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const nextTree = await github(env, '/git/trees', { method: 'POST', headers: { 'Content-Type': 'application/vnd.github+json' }, body: JSON.stringify({ base_tree: commit.tree.sha, tree }) });
  const nextCommit = await github(env, '/git/commits', { method: 'POST', headers: { 'Content-Type': 'application/vnd.github+json' }, body: JSON.stringify({ message: 'Update encrypted SalehinSc portal data', tree: nextTree.sha, parents: [head] }) });
  try {
    await github(env, `/git/refs/heads/${encodeURIComponent(cfg.branch)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/vnd.github+json' }, body: JSON.stringify({ sha: nextCommit.sha, force: false }) });
  } catch (error) {
    if (error.status === 409) throw error;
    throw error;
  }
  return { head: nextCommit.sha, updatedAt: catalog.updatedAt };
}
async function stageFiles(env, cfg, proof, actor, files) {
  check(Array.isArray(files) && files.length <= 12 && proof.files?.length === files.length, 'فهرست پیوست‌ها معتبر نیست.');
  let total = 0;
  const normalized = [];
  for (let i = 0; i < files.length; i++) {
    const item = files[i], meta = proof.files[i];
    check(item.path === meta.path && item.size === meta.size && item.hash === meta.hash && safeAttachmentPath(item.path), 'مشخصات پیوست با درخواست امضا‌شده یکسان نیست.');
    check(Number.isInteger(item.size) && item.size > 16 && item.size <= MAX_FILE + 16 && /^[a-f0-9]{64}$/.test(item.hash), 'مشخصات فایل نامعتبر است.');
    let bytes;
    try { bytes = unb64(item.content); } catch { fail('داده پیوست معتبر نیست.'); }
    check(bytes.length === item.size && await sha256(bytes) === item.hash, 'اعتبار پیوست تأیید نشد.', 400);
    total += bytes.length;
    check(total <= MAX_BATCH, 'حجم پیوست‌ها از حد مجاز بیشتر است.');
    normalized.push({ path: item.path, size: bytes.length, hash: item.hash, bytes });
  }
  const marker = `SalehinSc staging ${proof.requestId}`;
  const search = await github(env, `/issues?state=all&per_page=100&sort=created&direction=desc`);
  let issue = (Array.isArray(search) ? search : []).find(item => !item.pull_request && item.title === marker && String(item.body || '').includes('SalehinSc staging envelope v1'));
  const envelope = { format: 'SalehinSc staging envelope v1', proof, files: [] };
  if (!issue) issue = await github(env, '/issues', { method: 'POST', headers: { 'Content-Type': 'application/vnd.github+json' }, body: JSON.stringify({ title: marker, body: JSON.stringify(envelope) }) });
  else {
    try {
      const prior = JSON.parse(issue.body);
      check(prior.proof?.actorId === actor.id && prior.proof?.requestId === proof.requestId && prior.proof?.signature === proof.signature, 'درخواست مرحله‌بندی با حساب دیگری ساخته شده است.', 403);
      if (Array.isArray(prior.files) && prior.files.length === normalized.length && prior.files.every((file, i) => file.hash === normalized[i].hash && file.size === normalized[i].size)) return { issue: issue.number, files: prior.files };
    } catch (error) { if (error.status) throw error; }
  }
  const comments = [];
  const jobs = [];
  for (const file of normalized) {
    const chunks = [];
    for (let offset = 0; offset < file.bytes.length; offset += CHUNK_BYTES) chunks.push(file.bytes.slice(offset, offset + CHUNK_BYTES));
    const chunkIds = new Array(chunks.length);
    for (let i = 0; i < chunks.length; i++) jobs.push({ fileIndex: normalized.indexOf(file), chunkIndex: i, body: `salehin-chunk-v1:${b64(chunks[i])}` });
    file.chunks = chunkIds;
  }
  // Bound concurrency: each GitHub issue comment is independently committed by the API.
  for (let i = 0; i < jobs.length; i += 8) {
    const batch = jobs.slice(i, i + 8);
    const created = await Promise.all(batch.map(job => github(env, `/issues/${issue.number}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/vnd.github+json' }, body: JSON.stringify({ body: job.body }) })));
    created.forEach((comment, j) => { const job = batch[j]; normalized[job.fileIndex].chunks[job.chunkIndex] = comment.id; });
  }
  const staged = normalized.map(({ path, size, hash, chunks }) => ({ path, size, hash, chunks }));
  envelope.files = staged;
  await github(env, `/issues/${issue.number}`, { method: 'PATCH', headers: { 'Content-Type': 'application/vnd.github+json' }, body: JSON.stringify({ body: JSON.stringify(envelope) }) });
  return { issue: issue.number, files: staged };
}
function safeAttachmentPath(path) {
  return /^data\/attachments\/[a-f0-9]{32}\.bin$/.test(path || '');
}
async function submitRequest(env, cfg, body) {
  check(Number.isSafeInteger(body.issue) && body.issue > 0 && body.request?.format === 'SalehinSc signed request', 'درخواست انتشار معتبر نیست.');
  const issue = await github(env, `/issues/${body.issue}`);
  check(!issue.pull_request && typeof issue.body === 'string' && issue.body.length <= 60000, 'درخواست مرحله‌بندی پیدا نشد.', 404);
  let envelope;
  try { envelope = JSON.parse(issue.body); } catch { fail('اطلاعات مرحله‌بندی معتبر نیست.'); }
  check(envelope?.format === 'SalehinSc staging envelope v1' && Array.isArray(envelope.files), 'پیوست‌های مرحله‌بندی پیدا نشدند.', 409);
  const catalog = await readCatalog(env, cfg);
  const teachers = await readTeacherDirectory(env, cfg);
  const actor = await authorizeStaff(body.request, catalog, teachers, cfg, 'SalehinSc signed request');
  check(body.request.operation === 'message' || body.request.operation === 'profile', 'نوع درخواست مجاز نیست.');
  check(actor.role !== 'admin' || body.request.operation === 'profile', 'دبیر اصلی باید تغییرات پیام را از مسیر ثبت مستقیم انجام دهد.', 403);
  check(envelope.proof?.actorId === actor.id && envelope.proof?.requestId === body.request.id && envelope.proof?.scope === cfg.scope, 'این درخواست به QR فعلی تعلق ندارد.', 403);
  await authorizeStaff(envelope.proof, catalog, teachers, cfg, 'SalehinSc staging request');
  check(revision(actor) === envelope.proof.actorRevision, 'مجوز دسترسی دبیر لغو یا جایگزین شده است.', 403);
  check(envelope.proof.signature && envelope.files.length === body.request.files.length, 'فهرست پیوست‌ها یکسان نیست.', 409);
  for (let i = 0; i < envelope.files.length; i++) {
    const a = envelope.files[i], b = body.request.files[i];
    check(a.path === b.path && a.size === b.size && a.hash === b.hash && JSON.stringify(a.chunks) === JSON.stringify(b.chunks), 'فهرست پیوست‌ها تغییر کرده است.', 403);
  }
  const issueBody = JSON.stringify(body.request);
  await github(env, `/issues/${body.issue}`, { method: 'PATCH', headers: { 'Content-Type': 'application/vnd.github+json' }, body: JSON.stringify({ body: issueBody }) });
  const cfgPath = PUBLISH_WORKFLOW;
  await github(env, `/actions/workflows/${cfgPath}/dispatches`, { method: 'POST', headers: { 'Content-Type': 'application/vnd.github+json' }, body: JSON.stringify({ ref: cfg.branch, inputs: { issue: String(body.issue) } }) });
  return { issue: body.issue, status: 'pending' };
}
async function handle(request, env) {
  const cfg = repoConfig(env);
  const url = new URL(request.url);
  const bodyText = await request.text();
  check(bodyText.length <= MAX_BODY, 'درخواست بیش از اندازه بزرگ است.', 413);
  let body;
  try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { fail('بدنه درخواست معتبر نیست.'); }
  if (url.pathname === '/v1/health') return Response.json({ ok: true, repository: `${cfg.owner}/${cfg.repo}` });
  if (url.pathname === '/v1/teacher-entry') {
    const catalog = await readCatalog(env, cfg);
    const teachers = await readTeacherDirectory(env, cfg);
    const actor = await authorizeListedTeacher(body, catalog, teachers, cfg, 'SalehinSc worker request', 'teacher-entry');
    return Response.json({ ok: true, teacherId: actor.id, role: 'teacher' });
  }
  if (url.pathname === '/v1/snapshot') {
    const catalog = await readCatalog(env, cfg);
    const teachers = await readTeacherDirectory(env, cfg);
    await authorizePrimaryTeacher(body, catalog, teachers, cfg, 'SalehinSc worker request', 'snapshot');
    const head = await currentHead(env, cfg);
    return Response.json({ head, catalog });
  }
  if (url.pathname === '/v1/connection-test') {
    // This check is deliberately signed by the primary-teacher local credential. It never
    // accepts a GitHub token from the browser and never returns credential data.
    const catalog = await readCatalog(env, cfg);
    const teachers = await readTeacherDirectory(env, cfg);
    await authorizePrimaryTeacher(body, catalog, teachers, cfg, 'SalehinSc worker request', 'connection-test');
    const repo = await github(env, '');
    check(String(repo.full_name || '').toLowerCase() === `${cfg.owner}/${cfg.repo}`.toLowerCase(), 'توکن به مخزن تنظیم‌شده دسترسی ندارد.', 403);
    const head = await currentHead(env, cfg);
    // Read-only probes verify that the token can reach the workflow and issue
    // APIs used by the publishing pipeline. No test issue or workflow run is made.
    await github(env, '/issues?state=open&per_page=1');
    const workflow = await github(env, `/actions/workflows/${PUBLISH_WORKFLOW}`);
    return Response.json({
      ok: true,
      repository: `${cfg.owner}/${cfg.repo}`,
      branch: cfg.branch,
      head,
      checks: {
        tokenAccepted: true,
        repositoryAccessible: true,
        branchAccessible: true,
        catalogueReadable: true,
        issuesApiReadable: true,
        publishWorkflowReadable: Boolean(workflow?.id),
        repositoryPushRole: repo.permissions?.push === true
      },
      writePermissionNote: 'GitHub does not expose a safe read-only probe for every fine-grained write permission. Actual commit and workflow dispatch requests remain the definitive write checks.'
    });
  }
  if (url.pathname === '/v1/commit') {
    const catalog = await readCatalog(env, cfg);
    const teachers = await readTeacherDirectory(env, cfg);
    const actor = await authorizePrimaryTeacher(body, catalog, teachers, cfg, 'SalehinSc admin commit');
    check(typeof body.expectedHead === 'string' && /^[a-f0-9]{40}$/.test(body.expectedHead), 'نسخه مبنای مخزن معتبر نیست.');
    validateCatalog(body.catalog, cfg.scope);
    const candidateAdmin = body.catalog.students.find(item => item.id === actor.id);
    check(candidateAdmin && !candidateAdmin.disabled && candidateAdmin.role === 'admin', 'مدیر فعال در نسخه جدید پیدا نشد.', 403);
    const result = await createCommit(env, cfg, body, body.expectedHead, body.catalog);
    return Response.json(result);
  }
  if (url.pathname === '/v1/stage') {
    const catalog = await readCatalog(env, cfg);
    const teachers = await readTeacherDirectory(env, cfg);
    const proof = body.proof;
    const actor = await authorizeStaff(proof, catalog, teachers, cfg, 'SalehinSc staging request');
    check(ID32.test(proof.requestId || ''), 'شناسه درخواست نامعتبر است.');
    check(Array.isArray(proof.files) && proof.files.length === body.files?.length, 'فهرست پیوست‌ها معتبر نیست.');
    const result = await stageFiles(env, cfg, proof, actor, body.files);
    return Response.json(result);
  }
  if (url.pathname === '/v1/submit') return Response.json(await submitRequest(env, cfg, body));
  fail('مسیر سرویس پیدا نشد.', 404);
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = new Set([String(env.ALLOWED_ORIGIN || ''), 'http://localhost:8080', 'http://127.0.0.1:8080'].filter(Boolean));
    const headers = {
      'Access-Control-Allow-Origin': allowed.has(origin) ? origin : String(env.ALLOWED_ORIGIN || 'null'),
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
      'Cache-Control': 'no-store'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!allowed.has(origin) && origin) return Response.json({ error: 'Origin is not allowed.' }, { status: 403, headers });
    if (request.method === 'GET' && new URL(request.url).pathname === '/v1/health') return Response.json({ ok: true }, { headers });
    if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers });
    try {
      const response = await handle(request, env);
      const outHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(headers)) outHeaders.set(key, value);
      return new Response(response.body, { status: response.status, headers: outHeaders });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      return Response.json({ error: error.message || 'Unexpected Worker error.' }, { status, headers });
    }
  }
};

export const workerInternals = Object.freeze({ canonical, sha256, revision, validateCatalog, validateTeacherDirectory, safePath, safeAttachmentPath, verifySigned, authorize, authorizePrimaryTeacher, authorizeListedTeacher, authorizeStaff, timestampCheck, publishWorkflow: PUBLISH_WORKFLOW, teacherDirectoryPath: TEACHER_DIRECTORY_PATH });
