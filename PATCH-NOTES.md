## 2026-11-02 — Secure QR access, Worker publishing and teacher workspace

- Moved GitHub write credentials out of the browser and into a Cloudflare Worker secret. The Worker validates signed account proofs, role, QR revision, timestamps and repository head before accepting changes.
- Added a shared administrator/staff QR paper workflow, QR rotation and revocation, and separate student QR grants. Rotation re-keys the account while preserving encrypted historical scores/messages and their verification keys.
- Added Worker-backed score/message publishing, encrypted teacher request staging, compare-and-swap commits and conflict reporting. Added Worker authorization tests.
- Added a modern Persian-first, light-only RTL roster with search/class filtering, student create/edit/deactivate/restore, score history and entry, individual messages, and printable single/all-student QR papers.
- Added deployment, migration and threat-model guidance in INSTALL.txt, BACKEND.md, DATA-ARCHITECTURE.md, TEACHER-GUIDE.md and SECURITY.md.

## 2026-11-02 — QR-first interface, per-student data and compact encrypted records

- Replaced the visible account/login/role-panel experience with one light-only Persian RTL interface. A student QR opens their scores and messages; teacher QR permissions expose score entry and messaging controls on the same page.
- Added an editorial, information-first visual system in `modern.css`: restrained colors, typography-led hierarchy, responsive score rows, accessible focus styling and no dark-mode variant or decorative gradients.
- The original school logo image was not present in the supplied archive. The header therefore uses a restrained Persian «ص» monogram instead of requesting a missing image file.
- Externalized encrypted profile dossiers to `data/students/<id>.json`; the catalogue now points to each file with a SHA-256 ciphertext revision. Messages and scores remain separate `data/messages/<id>.json` files. Changed student files and the catalogue are committed atomically.
- Added a one-time migration script (`npm run migrate:data-split`) that moves ciphertext without decrypting it, plus revision verification for referenced files. The uploaded source archive had no live `data/portal.json`, so production migration was not executed.
- Text envelopes now use GZIP only when the compressed representation is smaller, then retain AES-256-GCM authenticated encryption. Existing uncompressed envelopes remain readable.
- Added a local-only QR card generator (`scripts/print-qr-cards.py`) and `requirements-qr.txt`; it converts an existing private CSV into printable SVG cards without sending secrets to an external service. It does not provision accounts or recover keys from existing dossiers.
- Data-only commits continue to bypass Pages deployment when Pages is configured to use GitHub Actions. Updated documentation for QR handling, migration and permission boundaries.
- Verified `npm run check` and 43 backend/role tests (one live-catalog test skipped because production data is absent). The DOM suite could not be run in this environment because `linkedom` is not installed; full `npm test` therefore remains unverified.
# Full patch notes

## October 30, 2026 — portable login, automatic refresh, local caching and pinned messages

- Removed the school-brand navigation link, manual refresh button, and role picker; one credential form lets the encrypted account determine its role.
- Replaced the generic school notice with a dynamic pinned-message banner. The shared catalog pointer makes a newly pinned admin/teacher message replace the currently pinned one; older message bodies remain intact but are no longer pinned.
- Made controls and interface chrome non-selectable while retaining selection for editable fields and message/data content. Refined the login illustration layout, card depth, hover states, and reduced-motion support.
- Added repository-scoped encrypted local caching for the last successful view, directory data, administrator management token, and up to eight recent small attachments. Offline views are read-only; successful online file reads still verify remote attachment integrity before refreshing the local cache.
- Fixed bootstrap repository parsing so `--repo` accepts GitHub URLs and SSH remotes as well as plain names. A populated catalog already scoped to the target repository is still protected against replacement.
- Bumped the service-worker shell cache to v11 so browsers fetch the updated interface.
- Checks: `npm run check` and the backend, config, bootstrap, and role tests pass. The DOM tests could not run here because `linkedom` was unavailable in the local environment; no live GitHub repository was changed by these edits.

## October 30, 2026 — correct deployed repository and administrator diagnostics

- Matched the live Pages site: `MB-Bidram/Hamdars-SalehinSc`, branch `master`. Re-encrypted the initial administrator catalog for this scope while retaining its login credentials, root key, signing/encryption identity and account ID. The verified deployed catalog contained only this unchanged bootstrap account.
- Administrator token connection now validates the repository catalog immediately. A missing admin reports the target repository, branch and path instead of the misleading bootstrap message; revoked/disabled administrators fail before local write preparation.
- Updated deployment instructions and the service-worker cache version. Changes are local until the corrected files are uploaded to the existing repository.

## October 30, 2026 — role-based school interface and signed publishing

- Rebuilt the Persian RTL interface around the supplied reference: blue school header, role navigation, profile sidebar, announcement feed, file cards and responsive dialogs, with bundled Vazirmatn fonts.
- Added student, teacher and administrator account roles, encrypted AdminSrc initialization, teacher assignment management, persistent logins, profile photos, score entry and arbitrary encrypted file attachments with inline raster images.
- Added signed teacher requests staged as encrypted GitHub issue content, a role-validating publishing workflow, atomic publication receipts, paced uploads, quota retry handling and publication status.
- Added read-only previews and backend/storage/interface tests. Updated deployment and token instructions. No live repository, Pages setting or remote account was changed.

## October 30, 2026 — encrypted portal backend v4

- Replaced QR/URL decryption keys with admin-provisioned login keys and passwords, automatic encrypted local key storage, encrypted export/import, and persistent student sessions.
- Added per-account encrypted profiles, separately encrypted image attachments, targeted announcements with image support, announcement edits with key rotation, and account reset/disable/delete APIs.
- Added atomic GitHub data commits and explicit conflict handling. Removed automatic site/repository publication from admin login.
- Added configuration and deployment/migration instructions in `BACKEND.md`. The score layout and stylesheet are retained; basic forms connect the new backend.
- Local tests cover crypto, persistence, isolation, recovery, transport, conflicts, migration, and page adapters. No live repository was modified. The older entries below describe the previous release.

## Fixed

- Public student-record requests no longer send custom `Cache-Control` or `Pragma` request headers to `raw.githubusercontent.com`. Those headers can trigger a cross-origin preflight that a static raw-file host may not support, causing the student page to show a network error despite the file being available.
- Student reports now try three public data routes: the raw repository file, the same-origin GitHub Pages file, and the GitHub Contents API. Each request bypasses normal browser caching, has a timeout, validates the record structure, and reports a useful error if every route fails.
- The student refresh button stays visible even when the report has failed to load, so the student can retry without reloading the page.
- The student's logo no longer links to `student.html` without the QR fragment. That link used to discard the private record ID/key when tapped. The teacher logo no longer redirects staff to the student screen either.
- Removed the duplicate bottom cancel button from the teacher editor.
- Reworked the interface into a flat, compact school register with neutral gray controls, less decoration, fewer cards and no large decorative banner. The actual student list and editing controls are the focus.
- Bumped the service-worker cache version so deployed browsers replace the old shell after the next successful update.
- Updated the offline/bootstrap asset bundle to match the shipped HTML, CSS, JavaScript and guide.

## Speed

Student pages check for updates every 5 seconds. The primary data route reads the committed repository file directly, without waiting for a GitHub Pages rebuild. If that route is unavailable, alternate routes are tried. Actual propagation still depends on GitHub and the student's network.

## Scope and deployment

This ZIP contains the modified project, including the Cloudflare Worker source. It has **not** been deployed to Cloudflare or pushed to the live GitHub repository by this patch process. The site remains read-only until the Worker is deployed, its GitHub credential is stored as a Worker secret, and its URL is configured in the Pages HTML. See INSTALL.txt and SECURITY.md. The Worker token is never sent to the browser.

## Checks run

- JavaScript syntax checks for `app.js`, `qrcode.js`, `sw.js` and `bootstrap-assets.js`.
- HTML checks for duplicate element IDs and the removal of the old `?teachers=1` routing.
- Verified that `bootstrap-assets.js` mirrors all 13 assets it bundles.
- Unit-style tests for primary public-data loading, recovery through the same-origin route, recovery through the GitHub API fallback, and absence of the custom cache headers.

## 2026-10-30 — Data-only publishing, avatar crop, refresh stability

- Added `.github/workflows/pages.yml` for GitHub Actions-based Pages publishing with `data/**` excluded from push-triggered deployment. Select **Settings → Pages → Source → GitHub Actions** and run the workflow once after applying the patch; branch-based Pages publishing ignores workflow path filters.
- Profile photos now open a drag-and-zoom cropper. The committed avatar output is a square PNG capped at 768×768, and the profile card avatar is a direct shortcut to profile settings for staff.
- Large PNG/JPEG/WebP message images are downscaled proportionally to a maximum 768-pixel edge and encoded before encryption/upload. Animated GIFs and non-image files are not transformed.
- Refreshes keep the current avatar visible while the encrypted image is fetched, and settings fields retain unsaved edits instead of snapping back to their defaults every refresh.
- Bumped the service-worker shell cache so the updated UI and crop code are fetched.


## October 30, 2026 — profile conflict, message sending and live sync reliability

- Profile updates now merge into the latest administrator dossier instead of encrypting stale tab data. Unchanged administrator and teacher encrypted payloads stay byte-for-byte stable during ordinary message/site commits, preventing false `CONFLICT` errors.
- Teacher message requests can be queued independently; pending-status checks merge newly queued work rather than overwriting a request started in another tab. The app no longer has a single-pending-message lockout or a fixed artificial delay. GitHub's own API quota still applies, with bounded retry handling for genuine server rate limits.
- Public data reads use stable URLs and the browser's native conditional HTTP cache validation. JavaScript no longer sets `If-None-Match` itself, avoiding a cross-origin CORS preflight on public raw-file reads. After this device writes a file, that path is force-refreshed once.
- The signed-in UI checks for changes every 10 seconds while the tab is visible, skips overlapping refreshes, and avoids rebuilding the active panel when its visible data has not changed. Administrator directory reads reuse the catalog already fetched for that refresh.
- Added regression tests for unchanged encrypted payloads, stale-tab profile merging, multiple queued teacher messages, and cache invalidation. Verified with `npm run check` and 52 non-DOM Node tests. The full DOM suite was not verified because the local `linkedom` dependency install did not complete.


## 2026-11-02 — QR-first student experience and separated records

- Replaced the visible login/role portal with a single QR-first student record experience; teacher QR access reveals score and message actions in the same interface.
- Split encrypted student profiles, messages, scores and attachments into independent Git data files. New score writes use `data/scores/` and a separate catalogue index; old inline/legacy score records remain readable.
- Added conditional GZIP-before-AES-GCM envelopes, retaining AES-256-GCM authentication and backward compatibility.
- Added local QR export for active student/teacher access keys and an offline printable QR-card script.
- Added a light-only, responsive RTL interface, keyboard focus styles, reduced-motion handling and mobile touch targets.
