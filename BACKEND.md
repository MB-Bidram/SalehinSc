# SalehinSc — backend and deployment architecture

## Why a Worker is required

GitHub Pages serves public static files. It cannot safely store a GitHub write token, and a client-side PIN or hidden button is not authentication. The previous publisher-token-in-browser approach exposed a repository credential to anyone controlling the browser session.

The updated design keeps the GitHub fine-grained token in a Cloudflare Worker secret. The browser signs narrowly scoped requests with a per-account ECDSA P-256 private key; the Worker reads the current public catalogue and `data/teachers/teacher.json`, checks the actor's active teacher identity and current local-file credential revision, verifies the signature and timestamp, and only then performs an allowed Git operation. The browser receives no general-purpose GitHub token.

## Components

- GitHub Pages: static HTML, CSS, JavaScript and public encrypted records.
- Browser Web Crypto: decrypts the matching account dossier, scores and messages; signs authorized requests.
- Cloudflare Worker (`worker/index.mjs`): one-repository GitHub API proxy; stores `GITHUB_TOKEN` as a secret; validates signed requests and optimistic concurrency.
- GitHub Actions (`portal-publish.yml`): independently re-validates signed teacher requests and publishes the encrypted message/score/profile data.

## Worker endpoints

All application endpoints are POST except the simple GET health route.

- `GET /v1/health`: confirms that the Worker is deployed.
- `POST /v1/teacher-entry`: requires a current signed proof from a role-`teacher` account explicitly listed as active in the teacher directory; reserved for a future additional teacher.
- `POST /v1/connection-test`: requires a current primary-teacher signature and performs read-only checks against the configured repository, branch, catalogue, Issues API and publish workflow. It never accepts or returns a GitHub token.
- `POST /v1/snapshot`: requires a current active primary-teacher signature and returns the current catalogue plus Git head.
- `POST /v1/commit`: requires a current active primary-teacher signature and `expectedHead`; commits the catalogue and allowlisted encrypted files atomically.
- `POST /v1/stage`: accepts a current signed primary-teacher proof for profile attachments or a listed future teacher staging proof and encrypted attachment bytes; stages chunks on a GitHub issue.
- `POST /v1/submit`: verifies the staged issue and the signed teacher request against the same teacher directory, then dispatches the publishing workflow.

The Worker has a fixed repository, branch and catalogue path in `wrangler.toml`. The primary identity lives in the separate public `data/teachers/teacher.json`; the file contains only account IDs, a `kind` (`primary` or `teacher`) and active flags. It is not an authentication secret. The Worker requires exactly one active primary entry that matches the sole account allowed to use admin snapshot/commit operations. The Actions publishing script repeats teacher-directory membership checks so direct workflow dispatch cannot bypass the directory. `safePath()` limits what an administrator commit can change. Git ref updates are non-force and use a compare-and-swap check against the expected head. Conflicts are reported rather than silently overwriting concurrent edits.

## Permissions

Create a fine-grained PAT scoped to the single target repository, with Contents read/write, Issues read/write and Actions read/write. Store it only with `npx wrangler secret put GITHUB_TOKEN`. The Settings dialog intentionally does not accept or display the PAT: browser JavaScript and local storage cannot protect it. Replace/remove the secret with `wrangler secret put/delete`; do not paste it into the website. The GitHub Actions workflow itself uses its short-lived `GITHUB_TOKEN` with Contents write and Issues read; the workflow permissions are declared in its YAML.

## Access identity and rotation

Student QR codes and the private local teacher file hold a random high-entropy access key that unwraps the account's random dossier root key. The catalogue stores only the wrapped root key and a random credential revision. The access key is never stored in public source files; the teacher copy exists only in the local-only `teacher.html` file. The current access-credential revision is checked by the Worker for every signed write.

Rotation re-encrypts the current dossier under a new root key and creates new ECDH/ECDSA identity keys. The old signing and encryption private keys are retained inside the newly encrypted dossier solely to verify/read older messages. The new public signing key and its previous verification keys are published as metadata. Rotating therefore prevents the old access file/key from decrypting the current dossier or future recipient envelopes while preserving readable history for the new credential.

Legacy student root-key QR links are accepted only while an account has no `qrAccess` record. The first student QR export for that account upgrades it through the same re-keying rotation. A student key must exist in the administrator vault to migrate that student's old QR grant.

## Teacher publishing path

The primary teacher keeps a private local `teacher.html` file. Opening it redirects to the project-relative Pages application with a high-entropy credential in the URL fragment. The browser processes the fragment and removes it from the visible URL; it then asks the Worker for a signed snapshot. The Worker validates the primary account against `data/teachers/teacher.json`. The local file is ignored by Git and explicitly excluded from Pages deployment. There is no teacher QR generator or public `/teacher/` entry route. Student QR codes continue to open the app root.

The local file does not contain a GitHub PAT and does not write directly to GitHub. Teacher operations use signed requests through the Worker. The Worker keeps the PAT server-side, verifies the current credential revision and allowed operations, and performs GitHub API reads/writes. Encrypted attachments are split into bounded GitHub issue comments. GitHub Actions independently verifies the signed request, role and recipients, reconstructs and hashes encrypted chunks, and publishes the score/message plus receipt.

The schema reserves teacher IDs for a future multi-teacher version. Additional accounts are not provisioned by the current UI; a later version can create a separate identity and explicit allowlist entry without changing today's one-primary-teacher workflow.

## Pages performance

`pages.yml` ignores `data/**`-only commits. The GitHub Pages source must be set to GitHub Actions. This lets score/message/profile updates land as repository commits without rebuilding the site shell. Clients poll the public catalogue and use the encrypted record paths. This is not an instant database: GitHub API latency, Action queues and repository limits still apply.

## Deployment

See `INSTALL.txt` for the exact Worker, secret, PAT, Pages and migration sequence. Never place the PAT in a browser, local teacher file, URL, metadata tag, config file, or committed workflow output.
