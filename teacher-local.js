/* Builds a private, local-only teacher launcher. It contains no GitHub PAT. */
'use strict';
(function (root) {
  const ID = /^[a-f0-9]{64}$/;
  const KEY = /^[A-Za-z0-9_-]{40,48}$/;
  const REVISION = /^[a-f0-9]{32}$/;

  function normalizeAppUrl(value) {
    let url;
    try { url = new URL(String(value || '')); }
    catch { throw new Error('نشانی سایت معتبر نیست.'); }
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
      throw new Error('نشانی ورود دبیر باید HTTPS باشد.');
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error('نشانی سایت نباید نام کاربری، رمز، query یا fragment داشته باشد.');
    }
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
    return url.href;
  }

  function buildTeacherLauncherHtml({ appUrl, id, key, revision, schoolName = 'مدرسه صالحین' }) {
    const base = normalizeAppUrl(appUrl);
    const accessKey = String(key || '').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    if (!ID.test(String(id || '')) || !KEY.test(accessKey) || !REVISION.test(String(revision || ''))) {
      throw new Error('اعتبارنامهٔ محلی دبیر معتبر نیست.');
    }
    const destination = `${base}#s=${id}&k=${accessKey}&r=${revision}`;
    // JSON string literals are escaped for safe placement inside an inline script.
    const targetLiteral = JSON.stringify(destination).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    const title = String(schoolName || 'مدرسه صالحین').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch])).slice(0, 120);
    return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">
<title>ورود دبیر | ${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f6f2;color:#20231f;font:16px/1.8 Tahoma,Arial,sans-serif}.box{width:min(90vw,420px);padding:28px;background:white;border:1px solid #dedfd8;border-radius:10px;text-align:center}p{color:#666}a{color:#245c4c}</style>
</head>
<body><main class="box"><strong>${title}</strong><p>در حال بازکردن پنل خصوصی دبیر…</p><noscript>برای ورود، JavaScript را فعال کنید.</noscript><p><a id="continue" href="#">ادامهٔ ورود</a></p></main>
<script>
(() => {
  'use strict';
  const destination = ${targetLiteral};
  const link = document.getElementById('continue');
  link.href = destination;
  location.replace(destination);
})();
</script>
</body></html>`;
  }

  const api = Object.freeze({ normalizeAppUrl, buildTeacherLauncherHtml });
  root.SalehinTeacherLocal = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
