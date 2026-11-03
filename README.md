# SalehinSc

SalehinSc is a Persian-first, RTL school score and messaging portal. Students use their own personal QR to view only their records. There is one primary teacher in the current version. The teacher enters by opening a **private local `teacher.html` file** stored on the trusted school computer. There is no teacher QR, registration, username/password form or teacher-selection screen.

GitHub Pages hosts the public application shell. A Cloudflare Worker keeps the GitHub write token server-side, fetches repository data and publishes authorized, signed changes. The private local teacher file does not contain a GitHub PAT and is never committed or deployed.

## Use it

- Fresh install: `npm ci`, then `npm run bootstrap -- --owner OWNER --repo REPOSITORY --branch main --name "مدیر مدرسه"`. Bootstrap creates a private local `teacher.html`; keep it off Git.
- Existing install: back up `data/`, deploy the new site and Worker, enter once with the current access method, then choose **ساخت / تعویض فایل خصوصی دبیر** from the roster. This rotates the primary credential and downloads a new local file; the previous credential is revoked.
- Every teacher session: open the local `teacher.html`. It redirects to the project-relative Pages app, where the Worker validates access.
- Student: scan their own personal QR. Student QR generation and isolation are unchanged.
- Student QR papers: use **چاپ برگه‌های QR** or the QR action on one student row.

Anyone who obtains the local teacher file can use it as the primary teacher until it is replaced. Store it securely; do not commit, email, chat or share it.

## Run locally

```bash
npm ci
npm run serve
```

Open `http://127.0.0.1:8080/`. Synthetic previews are available at `/?preview=student` and `/?preview=admin`; they use fake read-only data and do not test the real Worker.

## Architecture

- `index.html`, `modern.css`, `styles.css`, `app.js`: student experience and primary-teacher dashboard.
- `teacher-local.js`: builds the private local teacher launcher.
- `backend.js`: encrypted account sessions, student QR parsing and repository reads.
- `role-backend.js`: role checks, encryption, signed publishing requests and credential rotation.
- `worker/index.mjs`: server-side GitHub proxy, signed authorization and optimistic commits.
- `data/teachers/teacher.json`: public teacher identity metadata only; no access keys.
- `data/portal.json`, `data/students/`, `data/messages/`, `data/scores/`, `data/attachments/`: catalogue and encrypted data records.
- `.github/workflows/pages.yml`: publishes the site, skips data-only updates and explicitly excludes `teacher.html`.
- `.github/workflows/portal-publish.yml`: independently verifies and publishes signed changes.

See `INSTALL.txt`, `BACKEND.md`, `DATA-ARCHITECTURE.md`, `SECURITY.md` and `TEACHER-GUIDE.md` for details.

## Checks

```bash
npm run check
npm test
```

Unit tests use synthetic data and a test Worker adapter. They do not prove that your Cloudflare account, GitHub permissions, Pages settings or production origin are configured correctly.
