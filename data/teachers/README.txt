This directory contains public teacher identity metadata only.

`teacher.json` is created automatically by a fresh bootstrap, or for an
already initialized v4 portal by running:

  npm run migrate:primary-teacher

The file records exactly one active primary teacher and may contain secondary teacher IDs as inactive entries for a future
multi-teacher configuration. Migration does not grant those accounts access;
set an entry's active flag to true only when a second teacher is approved. It MUST
NOT contain QR keys, private signing/encryption keys, passwords, login keys, or
GitHub tokens. The Worker and GitHub Actions publishing workflow check this
allowlist before authorizing teacher entry or staged publishing.
