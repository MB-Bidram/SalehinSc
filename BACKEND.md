# SalehinSc — backend and deployment architecture

## Why a Worker is required

GitHub Pages serves public static files. It cannot safely store a GitHub write token, and a client-side PIN or hidden button is not authentication. The previous publisher-token-in-browser approach exposed a repository credential to anyone controlling the browser session.

The updated design keeps the GitHub fine-grained token in a Cloudflare Worker secret. The browser signs narrowly scoped requests with a per-account ECDSA P-256 private key; the Worker reads the current public catalogue, checks the actor's active role and QR revision, verifies the signature and timestamp, and only then performs an allowed Git operation. The browser receives no general-purpose GitHub token.

## Components

- GitHub Pages: static HTML, CSS, JavaScript and public encrypted records.
- Browser Web Crypto: decrypts the matching account dossier, scores and messages; signs authorized requests.
- Cloudflare Worker (`worker/index.mjs`): one-repository GitHub API proxy; stores `GITHUB_TOKEN` as a secret; validates signed requests and optimistic concurrency.
- GitHub Actions (`portal-publish.yml`): independently re-validates signed teacher requests and publishes the encrypted message/score/profile data.

## Worker endpoints

All application endpoints are POST except the simple GET health route.

- `GET /v1/health`: confirms that the Worker is deployed.
- `POST /v1/snapshot`: requires a current active administrator signature and returns the current catalogue plus Git head.
- `POST /v1/commit`: requires a current active administrator signature and `expectedHead`; commits the catalogue and allowlisted encrypted files atomically.
- `POST /v1/stage`: accepts only a current signed teacher staging proof and encrypted attachment bytes; stages chunks on a GitHub issue.
- `POST /v1/submit`: verifies the staged issue and the signed teacher request, then dispatches the publishing workflow.

The Worker has a fixed repository, branch and catalogue path in `wrangler.toml`. `safePath()` limits what an administrator commit can change. Git ref updates are non-force and use a compare-and-swap check against the expected head. Conflicts are reported rather than silently overwriting concurrent edits.

## Permissions

Create a fine-grained PAT scoped to the single target repository, with Contents read/write, Issues read/write and Actions read/write. Store it only with `npx wrangler secret put GITHUB_TOKEN`. The GitHub Actions workflow itself uses its short-lived `GITHUB_TOKEN` with Contents write and Issues read; the workflow permissions are declared in its YAML.

## QR identity and rotation

New QR codes hold a random high-entropy access key that unwraps the account's random dossier root key. The catalogue stores only the wrapped root key and a random QR revision. The QR key is not stored in public source files. The current QR revision is checked by the Worker for every signed write.

Rotation re-encrypts the current dossier under a new root key and creates new ECDH/ECDSA identity keys. The old signing and encryption private keys are retained inside the newly encrypted dossier solely to verify/read older messages. The new public signing key and its previous verification keys are published as metadata. Rotating therefore prevents the old QR/key from decrypting the current dossier or future recipient envelopes while preserving readable history for the new credential.

Legacy root-key QR links are accepted only while an account has no `qrAccess` record. The first QR export for that account upgrades it through the same re-keying rotation. A student key must exist in the administrator vault to migrate that student's old QR.

## Teacher publishing path

Teacher operations use signed requests and do not write directly to the repository. Encrypted attachments are split into bounded GitHub issue comments. The Worker verifies the teacher QR revision before staging and again before submit. The Actions workflow verifies request signatures, role and recipients again, reconstructs and hashes encrypted chunks, and publishes a message/score plus a receipt. Scores and messages have distinct files and indices.

## Pages performance

`pages.yml` ignores `data/**`-only commits. The GitHub Pages source must be set to GitHub Actions. This lets score/message/profile updates land as repository commits without rebuilding the site shell. Clients poll the public catalogue and use the encrypted record paths. This is not an instant database: GitHub API latency, Action queues and repository limits still apply.

## Deployment

See `INSTALL.txt` for the exact Worker, secret, PAT, Pages and migration sequence. Never place the PAT in a browser, QR code, metadata tag, config file, or committed workflow output.
