# SalehinSc security notes

## Teacher access

- The primary teacher uses a private local `teacher.html` file. It is generated locally by bootstrap or downloaded after an authorized teacher session.
- `teacher.html` is in `.gitignore` and the GitHub Pages workflow explicitly excludes it. The ZIP does not contain any real school credential or generated teacher file.
- The file contains a high-entropy bearer access key in its local HTML source. Anyone who obtains a copy can enter as the primary teacher until that credential is rotated. Protect the device and the file; do not email, commit, upload or synchronize it to a public/shared folder.
- Replacing the local file rotates the administrator dossier and signing identity, invalidating the previous file. Previously copied plaintext or historical repository contents cannot be recalled.
- There is no teacher QR generation or printing workflow. Student QR codes remain unchanged.

## Backend and publishing

- The GitHub write token is stored as a Cloudflare Worker Secret and is never delivered to browser JavaScript or included in `teacher.html`.
- The local teacher file opens the normal project-relative GitHub Pages application with a secret URL fragment. The app removes the fragment after processing and asks the Worker for an authorized snapshot.
- Worker writes require a current ECDSA P-256 signature, account role, primary-teacher directory membership, credential revision, timestamp, repository scope and optimistic Git head. GitHub Actions independently validates publishing requests.
- Student dossiers, scores, messages and attachments remain end-to-end encrypted. Student access keys are separate from the teacher credential.

## Important limitations

- `teacher.html` is a bearer credential. It is not bound to a particular person or device; file possession grants the primary teacher's permissions.
- A compromised teacher computer, browser extension, malware or unlocked browser session can use the authority.
- The local file redirects to the hosted application; it does not contain a full offline copy of the dashboard. The hosted app and Worker must be reachable.
- The public GitHub catalogue exposes identifiers, role metadata, recipients, credential revisions, ciphertext sizes and timestamps.
- Git history cannot be erased by credential rotation. Rotation prevents the old key from unlocking the current dossier and future data, but does not erase previous copies, screenshots or already downloaded plaintext.
- The architecture reserves teacher IDs and ownership references for a future multi-teacher version, but no registration or teacher-management UI is included today.

## Student isolation

Student QR keys only unlock their own encrypted dossier. Message/score payload keys are wrapped to intended recipients' public ECDH keys. The Worker and publishing workflow validate recipients and account roles rather than relying on hidden interface controls.

## Deployment checklist

Before using real records, configure the repository-scoped GitHub token in Cloudflare, set the exact Pages origin, choose GitHub Actions as the Pages source, verify workflow permissions, generate and protect the local teacher file, test adding a dummy student, publish a test score/message, and verify that another student cannot decrypt it. Unit tests do not replace a live deployment test.
