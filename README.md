# Semantic CX Intelligence Platform

A Next.js portal for Jazz Lifestyle Ventures. SIMOSA and Tamasha share the same sentiment analysis dashboard layout. It uses Firebase Authentication for Jazz-only sign-in with a dashboard password and authenticator app, Google Sheets for reporting data, and Gemini for optional summaries. Vercel can build and host it directly from the repository. The original Streamlit files are retained for reference and rollback.

## Run on your Mac

1. Use Node.js 24. In this folder, run `npm ci`.
2. Copy `.env.example` to `.env.local` if you do not have one. Use the settings below. Keep the file out of Git and chat.
3. Add `localhost` to the Firebase Authentication authorized domains for your test project.
4. Run `npm run dev` and open [the local dashboard](http://localhost:3000). Sign in with an approved Jazz account and its dashboard password. Enroll an authenticator app if prompted, then wait for a fresh code before signing in again.
5. Run `npm test` for the access and analytics checks and `npm run build` for the production build.

| Variable | Where to find it |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Firebase Web app config, `projectId`. |
| `FIREBASE_API_KEY` | Firebase Web app config, `apiKey`. |
| `FIREBASE_AUTH_DOMAIN` | Firebase Web app config, `authDomain`. Defaults to the project's Firebase domain. |
| `FIREBASE_ADMIN_CREDENTIALS` | Server-only service-account JSON from the Firebase Auth project, as one JSON line. |
| `APP_BASE_URL` | `http://localhost:3000` locally. In Vercel use a stable HTTPS URL for the deployment. |
| `APP_ADDITIONAL_ORIGIN` | Optional. Another trusted origin for the same deployment, such as `https://semantic-cx.vercel.app`. |
| `GOOGLE_SPREADSHEET_ID` | The ID between `/d/` and the next slash in the SIMOSA Google Sheet URL. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The authorized Google service-account JSON. Paste it as one JSON line. The account needs Viewer access to the SIMOSA sheet. |
| `TAMASHA_GOOGLE_SPREADSHEET_ID` | The ID of the separate Tamasha reporting sheet. Grant the portal service account Viewer access to it. |
| `TAMASHA_GOOGLE_SERVICE_ACCOUNT_JSON` | Optional. A separate server-only Google credential for Tamasha when the shared service account cannot access its sheet. |
| `GEMINI_API_KEY` | Optional. Use the appropriate Gemini project key to enable the summary buttons. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-3.8-flash`. |

### Firebase Authentication

Enable Email/Password and [authenticator-app MFA](https://firebase.google.com/docs/auth/web/totp-mfa) in Firebase Authentication with Identity Platform.

Confirm the employee’s exact Jazz email through a trusted work channel, then add their account under **Firebase Authentication → Users**. Record your confirmation and run `node --env-file=.env.local scripts/approve-firebase-user.mjs person@jazz.com.pk --confirmed-work-email --dashboards=simosa`. The approval is bound to that exact email. Disable self-service signup in Identity Platform if enabled for the project. Existing Auth0 users need Firebase accounts.

Use `--dashboards=simosa` for the SIMOSA team, `--dashboards=tamasha` for the Tamasha team, `--dashboards=simosa,tamasha` for explicitly approved users who need both, `--all-dashboards` for explicitly approved cross-application users, or `--no-dashboards` to remove dashboard access. Running the script without an access option preserves existing grants and defaults new users to SIMOSA. Users approved before the portal update retain their SIMOSA access.

Firebase verifies the dashboard password and authenticator code. The server issues one-hour sessions only after MFA. Each data request checks the current account’s approval, enrolled factor, and dashboard assignment. Each reporting request uses the selected dashboard ID to choose the spreadsheet and authorize access. The Tamasha spreadsheet contains competitor rows. The portal selects Tamasha’s rows for its own metrics and charts.

## Deploy to Vercel

1. Push the Next.js changes to the repository. In the authorized Vercel workspace, choose **Add New → Project** and import the repository. Select the **Next.js** preset and the repository root. Use Node.js 24.
2. Set the variables above in **Settings → Environment Variables**. Keep credential variables server-side. For the first deployment, use an assigned stable Vercel domain. If the domain isn't known yet, deploy once to obtain it, add `APP_BASE_URL`, and redeploy.
3. Add each production hostname to Firebase Authentication authorized domains. Set the Firebase variables for the target Vercel environment before deploying.
4. In a private browser window, check sign-in and sign-out with an approved Jazz account. Confirm a non-Jazz account and direct unauthenticated API requests are blocked. Then check month switching, comparisons, review filters, and Gemini summaries if enabled.
5. Use a stable preview domain and separate values if you want a preview deployment with real sign-in. Keep the existing deployment available until the Vercel checks pass.

[Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs) · [Vercel environment variables](https://vercel.com/docs/environment-variables) · [Firebase session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies)

### Portal-managed authenticator preview

This preview requires its own Firebase project and is disabled in Vercel Production. Enable email and password sign-in and create a private Firestore database. Keep `semantic-cx-private-totp` inaccessible to client reads and writes. Give the server credential access to Firestore.

In the preview environment, point the Firebase settings at that project, set `APP_BASE_URL` to the exact preview origin, set `PORTAL_TOTP_PREVIEW=1`, and store a separate 32-byte hex key in `PORTAL_TOTP_KEY`. Generate it with `openssl rand -hex 32`. Keep the key server-side.

Use verified Jazz accounts with both the normal `simosa_email` approval and a `portal_totp_preview: true` Firebase custom claim. Approve testers through a trusted channel. The first login sets up a separate authenticator entry. Future logins use that entry. If a tester needs a reset, revoke preview approval before deleting their Firestore factor record, verify their identity out of band, and restore approval only when ready for re-enrollment.

### Production authenticator enrollment

Set `PORTAL_TOTP_ENABLED=1` in Vercel Production to use the portal authenticator for all approved Jazz accounts. The existing Firebase account approval and per-dashboard assignments still apply. Share a unique initial password directly with each user. Their first password sign-in starts QR enrollment. Later sign-ins require only the password and a current authenticator code. Use a separate `PORTAL_TOTP_KEY` in each environment and keep Firestore factor records client-inaccessible.

A single-account pilot can use `PORTAL_TOTP_PILOT_EMAIL` while the broad rollout is off. If an authenticator needs a reset, revoke the account's dashboard approval before removing its portal factor record. Verify the person's identity through a trusted channel before restoring approval for re-enrollment.
