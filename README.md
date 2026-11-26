# Semantic CX Intelligence Platform

A Next.js portal for Jazz Lifestyle Ventures. SIMOSA Sentiment Analysis is the first application dashboard. It uses Firebase Authentication for Jazz-only sign-in with a dashboard password and authenticator app, Google Sheets for reporting data, and Gemini for optional summaries. Vercel can build and host it directly from the repository. The original Streamlit files are retained for reference and rollback.

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
| `GEMINI_API_KEY` | Optional. Use the appropriate Gemini project key to enable the summary buttons. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-3.8-flash`. |

### Firebase Authentication

Enable Email/Password and [authenticator-app MFA](https://firebase.google.com/docs/auth/web/totp-mfa) in Firebase Authentication with Identity Platform.

Confirm the employee’s exact Jazz email through a trusted work channel, then add their account under **Firebase Authentication → Users**. Record your confirmation and run `node --env-file=.env.local scripts/approve-firebase-user.mjs person@jazz.com.pk --confirmed-work-email --dashboards=simosa`. The approval is bound to that exact email. Disable self-service signup in Identity Platform if enabled for the project. Existing Auth0 users need Firebase accounts.

Use `--dashboards=simosa` for the SIMOSA team, `--all-dashboards` for explicitly approved cross-application users, or `--no-dashboards` to remove dashboard access. Running the script without an access option preserves existing grants and defaults new users to SIMOSA. Users approved before the portal update retain their SIMOSA access.

Firebase verifies the dashboard password and authenticator code. The server issues one-hour sessions only after MFA. Each data request checks the current account’s approval, enrolled factor, and dashboard assignment. Add future dashboards to the registry in `lib/dashboard-access.mjs`, render the matching dashboard in the portal, and protect its data routes with the same dashboard ID.

## Deploy to Vercel

1. Push the Next.js changes to the repository. In the authorized Vercel workspace, choose **Add New → Project** and import the repository. Select the **Next.js** preset and the repository root. Use Node.js 24.
2. Set the variables above in **Settings → Environment Variables**. Keep credential variables server-side. For the first deployment, use an assigned stable Vercel domain. If the domain isn't known yet, deploy once to obtain it, add `APP_BASE_URL`, and redeploy.
3. Add each production hostname to Firebase Authentication authorized domains. Set the Firebase variables for the target Vercel environment before deploying.
4. In a private browser window, check sign-in and sign-out with an approved Jazz account. Confirm a non-Jazz account and direct unauthenticated API requests are blocked. Then check month switching, comparisons, review filters, and Gemini summaries if enabled.
5. Use a stable preview domain and separate values if you want a preview deployment with real sign-in. Keep the existing deployment available until the Vercel checks pass.

[Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs) · [Vercel environment variables](https://vercel.com/docs/environment-variables) · [Firebase session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies)
