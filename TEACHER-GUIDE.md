# SalehinSc — teacher guide

## Primary teacher access

There is exactly one primary teacher in the current release. No teacher QR, login form, username/password, registration or teacher-selection screen is used.

The teacher opens a private local `teacher.html` file saved on the trusted school computer. The file redirects into the project-relative GitHub Pages application. It is not part of the Git repository and is explicitly excluded from Pages deployment.

### Existing school transition

1. Deploy the updated application and Worker while preserving the live `data/` directory.
2. Enter once using the current authorized access method.
3. From the teacher roster, choose **ساخت / تعویض فایل خصوصی دبیر**.
4. Confirm. SalehinSc rotates the primary account root key and signing identity, revokes the prior credential and downloads `teacher.html`.
5. Save the downloaded file in a private local folder. Do not commit or share it.
6. Open that file for future sessions.

The old access key is invalid after rotation. No teacher QR image is created or printed.

### Fresh school

`npm run bootstrap` creates a local `teacher.html` file in the project root automatically. The file is ignored by Git and omitted by the Pages deployment workflow. Deploy Pages and the Worker before opening it.

## Student management

- Add a student with name and class; the application creates the encrypted student record and personal QR.
- Search by name and filter by class.
- Open a student's record to edit details, review score history, add scores or send messages.
- Deactivate a student without deleting records; restore when appropriate.
- Print one or all active student QR papers. Student QR behavior is unchanged.

## GitHub publishing

The local teacher file does not contain a GitHub Personal Access Token. The public application fetches encrypted records and sends signed write requests to the Cloudflare Worker. The Worker uses the server-side GitHub token to publish approved changes. If the Worker is unavailable, the dashboard explains the connection problem and cannot silently pretend a write succeeded.

## Protect the local file

Anyone with a copy of `teacher.html` can act as the primary teacher until it is replaced. Keep it off GitHub, email, chat, shared drives and public cloud folders. To revoke a lost copy, use a currently authorized session to create a replacement; the previous file immediately stops working.
