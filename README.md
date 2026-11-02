# صالحین | SalehinSc

SalehinSc is a Persian-first, RTL school score and messaging portal. Students use a personal QR paper to open only their own record. Staff use one shared staff QR to open the school roster, manage student records, issue student QR papers, record scores and send messages.

The site shell is static GitHub Pages. **Writing is authorized by a small Cloudflare Worker**; the browser never receives a GitHub Personal Access Token. Do not deploy this as a write-enabled site until the Worker setup in [INSTALL.txt](INSTALL.txt) is complete.

## Run locally

```bash
npm ci
npm run serve
```

Open `http://127.0.0.1:8080/`. The app also has local synthetic previews:

- `http://127.0.0.1:8080/?preview=student`
- `http://127.0.0.1:8080/?preview=admin`

Preview data is fake and read-only. It does not test a real QR, GitHub repository, Worker, or deployment.

## The normal workflows

- Staff scan the shared **ورود معلمان** QR. The roster has search, class filter, edit/history, activation/deactivation, message, score and QR actions.
- Add a student with a name and class. The app creates their private access credential and displays a QR paper/link.
- Use **چاپ برگه‌های QR** for active student cards, or open a student's QR action for one card.
- Use **چاپ QR دبیران** for the shared staff card. Use **تعویض QR دبیران** if the paper is lost or exposed; the old QR stops working immediately.
- Students scan their own QR to see their scores, feedback and messages.

QRs are bearer credentials. Anyone with a QR image or complete URL can use it, so never post QR cards in public channels or send them to an online QR generator.

## Architecture

- `index.html`, `modern.css`, `styles.css`, `app.js`: Persian RTL interface and print layouts.
- `backend.js`: encrypted account sessions, QR parsing and repository reads.
- `role-backend.js`: role checks, encrypted dossier/message/score logic, signed writes and QR-key rotation.
- `worker/index.mjs`: server-side GitHub API proxy, signed authorization, compare-and-swap commits and teacher request staging.
- `wrangler.toml`: Cloudflare Worker deployment configuration; it contains repository metadata, not credentials.
- `data/portal.json`: public catalogue and encrypted-file references.
- `data/students/`, `data/messages/`, `data/scores/`, `data/attachments/`: separate encrypted records.
- `.github/workflows/pages.yml`: publishes the static website and skips `data/**`-only changes.
- `.github/workflows/portal-publish.yml`: validates and publishes signed teacher messages, scores and profile updates.

See [BACKEND.md](BACKEND.md), [DATA-ARCHITECTURE.md](DATA-ARCHITECTURE.md), [SECURITY.md](SECURITY.md), and [TEACHER-GUIDE.md](TEACHER-GUIDE.md).

## Checks

```bash
npm run check
npm test
```

The local tests use a test Worker adapter and synthetic data; they do not prove that your own Cloudflare account, GitHub token, repository permissions, Pages settings, or deployed origin are configured correctly.
