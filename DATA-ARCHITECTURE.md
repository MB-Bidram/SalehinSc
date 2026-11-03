# SalehinSc data layout and migration

## Public catalogue and encrypted records

```text
data/
├── teachers/teacher.json        # public primary teacher ID and future teacher allowlist; no secrets
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

Dossiers and message payloads use AES-256-GCM with contextual authenticated data. Student QR secrets and the private local teacher file wrap the random dossier root key; the actual account root key is not printed or stored in the URL. Each access grant has a public random revision so the old grant can be rejected without storing its secret.

Message and score records have ECDSA P-256 signatures. The catalogue holds public identity keys so clients can verify records without trusting their author label. On account access-credential rotation, the new dossier keeps old private encryption identities for reading earlier recipient envelopes, and the catalogue keeps previous public signing keys for verifying earlier records.

## Access credential rotation

Rotating the teacher local-file credential is more than changing a URL token. It changes the root key and account identity keys, re-encrypts the current dossier and rotates the access grant. This prevents a holder of an old key plus public Git history from decrypting the latest version or future messages. The old local teacher file is invalid for the current revision. Student QR rotation remains separate. Previously downloaded plaintext, historical repository snapshots and copies of old ciphertext cannot be recalled.

Legacy accounts without `qrAccess` use a legacy access fragment. The first student QR export or teacher local-file replacement upgrades the account through a full re-key. Migration requires the corresponding private account key in the admin vault. If that key has been lost, do not overwrite the account or bootstrap a new catalogue over production data.

## Keeping existing data

When updating a live portal:

1. Back up the repository and its full `data/` directory.
2. Copy application, Worker, documentation, and workflow changes, but do not copy the ZIP's sample `data/` over production.
3. Verify `scope`, owner/repository, default branch and `dataPath` still match.
4. Use the existing authorized teacher session once to download a private local `teacher.html`; this rotates the old credential. Deploy the updated Worker before relying on it.
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

The last decrypted view is cached locally for read-only fallback. The administrator key vault is encrypted inside the primary teacher dossier and restored to the trusted browser after a successful private local teacher-file login. Local browser storage must still be protected; anyone with an unlocked staff session or shared browser profile can use its permissions.


## Primary teacher identity directory

`data/teachers/teacher.json` is deliberately separate from student dossiers and
public application settings. Example:

```json
{
  "format": "SalehinSc teacher directory",
  "version": 1,
  "primaryTeacherId": "<64-hex-account-id>",
  "teachers": [
    { "id": "<64-hex-account-id>", "kind": "primary", "active": true }
  ],
  "updatedAt": "2026-11-03T12:00:00.000Z"
}
```

The identifiers are public references, not credentials. Never put access keys,
private encryption/signing keys, login keys, passwords or GitHub tokens here.
A fresh `npm run bootstrap` creates this file. For a live v4 school, run
`npm run migrate:primary-teacher`, review the generated file and commit it to
the same branch as `data/portal.json`. The migration refuses ambiguous or
multiple admin accounts and does not modify student or message records.

The primary teacher's private local `teacher.html` carries the access fragment and redirects to the project root. The public deployment does not contain `teacher.html`; `.gitignore` and `pages.yml` both exclude it. The application then requires a successful signed Worker snapshot and validates the teacher identity, active flag and credential revision. Students continue to use their personal QR at the root route.

The schema reserves `kind: "teacher"` entries for a future multi-teacher mode.
No teacher-registration or teacher-selection UI is included today. The existing-v4
migration preserves secondary teacher IDs as inactive entries; it does not grant
them access automatically. A second teacher must be intentionally activated in
this allowlist after their encrypted account is confirmed. The Worker and Actions
workflow check membership and the active flag.
