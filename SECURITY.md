# SalehinSc security notes

## What this design protects

- The GitHub write token is server-side in a Cloudflare Worker secret; it is not delivered to browser JavaScript.
- Worker writes require a current account signature, allowed role, current QR/auth revision, recent timestamp and a matching repository scope.
- Admin commits use an expected Git head and a non-force ref update to avoid silently replacing concurrent commits.
- The publishing workflow verifies teacher signatures, role, recipient permissions, file hashes and encrypted attachment chunks again before committing.
- Student dossiers, message bodies, scores and attachment bytes are encrypted. Recipient-specific ECDH envelopes prevent one student QR from decrypting another student's private content.
- QR rotation changes the account root key and messaging/signing identity, not just the URL token.

## Important trade-offs

**The shared staff QR is an administrator credential.** Everyone who scans it can manage the roster, read student records, change QR access, and publish school data. There is no individual teacher attribution in this shared mode. If individual accountability is required, issue separate teacher accounts and restrict their assigned student IDs instead of sharing the administrator QR.

QR possession is bearer authentication. Anyone who photographs, forwards or copies the QR can use it until revoked. The website cannot distinguish the intended teacher from another person holding the same paper.

GitHub remains the public data host. The catalogue exposes metadata such as student IDs, roles, recipients, ciphertext sizes and timestamps. Encrypted records are not anonymous. Use a private repository only if the Pages hosting/access model is separately redesigned; a private repo may not serve public student Pages reads as currently implemented.

Git history is immutable from the perspective of this app. Re-keying stops an old QR from opening the current dossier and decrypting future data, but it cannot erase plaintext already seen, copies already downloaded, screenshots, or historical ciphertext in old commits. Anyone holding an old QR may still decrypt the historical account snapshot whose matching wrapped root key they retained.

The administrator vault contains the private keys needed to read/manage student dossiers. It is encrypted inside the admin dossier and recovered after an admin QR login, but the shared admin QR therefore has school-wide impact. Protect the printed QR and the device/browser session.

## What this project does not provide

- Per-teacher identity or a tamper-proof audit trail of which human performed an action while using the shared QR.
- Protection against a compromised staff phone, malicious browser extension, XSS, or a person using an already-unlocked shared device.
- Guaranteed real-time delivery or availability. GitHub API, Cloudflare, DNS, Actions queue and network outages can delay updates.
- Erasure of records from repository history.
- A live integration test against the school's real Cloudflare account and GitHub token from this source archive.

## Deployment checklist

Before using real student data, configure a repository-scoped fine-grained PAT in the Worker, set the exact Pages origin, choose GitHub Actions as the Pages source, verify workflow permissions, scan a replacement staff QR on a second device, create a test student, check that student QR, publish a test score/message, and verify that a second student cannot decrypt it. Do not treat the unit tests as a substitute for this live check.
