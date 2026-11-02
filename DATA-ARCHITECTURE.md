# SalehinSc data layout and migration

## Public catalogue and encrypted records

```text
data/
├── portal.json                  # public IDs, roles, revisions, recipients and file references
├── students/<64-hex-id>.json    # encrypted account dossier
├── messages/<32-hex-id>.json    # encrypted message/announcement
├── scores/<32-hex-id>.json      # encrypted score record
├── attachments/<32-hex-id>.bin # encrypted attachment bytes
└── requests/<32-hex-id>.json    # teacher publication receipt/status
```

The public catalogue is intentionally not private. It exposes account IDs, roles, credential revisions, recipient IDs, ciphertext sizes and update timing. Profiles, message content, score values, feedback, attachment names and decryption keys are encrypted.

A student QR opens only the matching account dossier. Message/score payload keys are wrapped individually to each intended recipient's ECDH public key. The student app fetches only the student's addressed entries. Access control is cryptographic: possessing one student's key does not derive another student's root key or recipient private key.

## Encryption and identity

Dossiers and message payloads use AES-256-GCM with contextual authenticated data. Account QR secrets wrap the random dossier root key; the actual account root key is not printed or stored in the URL. Each QR grant has a public random revision so the old grant can be rejected without storing its secret.

Message and score records have ECDSA P-256 signatures. The catalogue holds public identity keys so clients can verify records without trusting their author label. On account QR rotation, the new dossier keeps old private encryption identities for reading earlier recipient envelopes, and the catalogue keeps previous public signing keys for verifying earlier records.

## QR rotation

Rotating a QR is more than changing a URL token. It changes the root key and account identity keys, re-encrypts the current dossier and rotates the QR grant. This prevents a holder of an old key plus public Git history from decrypting the latest version or future messages. The old QR is invalid for the current revision. Previously downloaded plaintext, historical repository snapshots and copies of old ciphertext cannot be recalled.

Legacy accounts without `qrAccess` use a legacy QR containing their dossier key. The first print/export upgrades the account through a full re-key. Migration requires the corresponding private account key in the admin vault. If that key has been lost, do not overwrite the account or bootstrap a new catalogue over production data.

## Keeping existing data

When updating a live portal:

1. Back up the repository and its full `data/` directory.
2. Copy application, Worker, documentation, and workflow changes, but do not copy the ZIP's sample `data/` over production.
3. Verify `scope`, owner/repository, default branch and `dataPath` still match.
4. Use the live administrator QR to enter, deploy the Worker, then print a new staff QR.
5. Export student QR papers to upgrade legacy student grants after confirming that the administrator vault has each account key.

The archive's current `data/portal.json` contains one encrypted administrator seed only. It contains no student records, messages or scores, and it does not contain the QR secret. The secret is intentionally not present in the public catalogue.

## Existing inline profile migration

Older catalogues may still contain inline encrypted profile payloads. The app supports `payloadRef` per-student files and the migration script can split these envelopes without decrypting them:

```bash
npm run migrate:data-split -- --dry-run
npm run migrate:data-split
```

Run this on a private clone/backup of the live repository. Review every generated file and `git diff` before committing. The migration is idempotent for records that already have valid references. It does not erase older ciphertext from Git history.

## Offline and persistence behavior

The last decrypted view is cached locally for read-only fallback. The administrator key vault is encrypted inside the administrator dossier and restored to the trusted browser after a successful admin QR login. Local browser storage must still be protected; anyone with an unlocked staff session or shared browser profile can use its permissions.
