# SIMOSA Consumer Intelligence

A Next.js dashboard for Google Play review intelligence. It uses the existing Auth0 application for Jazz-only sign-in with an authenticator app, Google Sheets for reporting data, and Gemini for optional summaries. Vercel can build and host it directly from the repository. The original Streamlit files are retained for reference and rollback.

## Run on your Mac

1. Use Node.js 24. In this folder, run `npm ci`.
2. Copy `.env.example` to `.env.local` if you do not have one. Use the settings below. Keep the file out of Git and chat.
3. In Auth0, open **Applications → SIMOSA Dashboard → Settings**. Add `http://localhost:3000/auth/callback` to **Allowed Callback URLs** and `http://localhost:3000/` to **Allowed Logout URLs**. Keep the old Streamlit URLs if you still use that deployment. Save.
4. Run `npm run dev` and open [the local dashboard](http://localhost:3000). Use the same SIMOSA account and authenticator entry you enrolled with the existing Auth0 application.
5. Run `npm test` for the access and analytics checks and `npm run build` for the production build.

| Variable | Where to find it |
| --- | --- |
| `AUTH0_DOMAIN` | Auth0 application **Settings → Domain**. Enter just the domain, such as `your-tenant.us.auth0.com`. |
| `AUTH0_CLIENT_ID` | Auth0 application **Settings → Client ID**. Use the same app that is configured in the two Actions. |
| `AUTH0_CLIENT_SECRET` | Auth0 application **Settings → Client Secret**. |
| `AUTH0_SECRET` | Run `node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'`. Use a separate value per environment. |
| `APP_BASE_URL` | `http://localhost:3000` locally. In Vercel use the stable HTTPS URL for the deployment. |
| `GOOGLE_SPREADSHEET_ID` | The ID between `/d/` and the next slash in the SIMOSA Google Sheet URL. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The authorized Google service-account JSON. Paste it as one JSON line. The account needs Viewer access to the SIMOSA sheet. |
| `GEMINI_API_KEY` | Optional. Use the appropriate Gemini project key to enable the summary buttons. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-3.8-flash`. |

### Auth0 Actions

Reuse the existing **Require Jazz MFA** and **Confirm Jazz MFA** Actions, in that order. They verify the Jazz mailbox, require an authenticator-app code, and issue the signed claim the dashboard checks. A new Auth0 application needs its Client ID added as `SIMOSA_CLIENT_ID` in both Actions. The second Action also expects `SIMOSA_MFA_CLAIM` set to `https://github.com/designandusability/Simosa-Consumer-Intelligence-Dashboard/otp_verified`.

Action source is in `auth0/`. The Next.js app retains the claim in the encrypted session and checks it again on every dashboard API request. Sessions are capped at one hour. Deployments without valid authentication settings stay locked.

## Deploy to Vercel

1. Push the Next.js changes to the repository. In the authorized Vercel workspace, choose **Add New → Project** and import the repository. Select the **Next.js** preset and the repository root. Use Node.js 24.
2. Set the variables above in **Settings → Environment Variables**. Keep credential variables server-side. For the first deployment, use an assigned stable Vercel domain. If the domain isn't known yet, deploy once to obtain it, add `APP_BASE_URL`, and redeploy.
3. In Auth0, add the production dashboard URL plus `/auth/callback` to **Allowed Callback URLs**. Add its base HTTPS URL to **Allowed Logout URLs**. Save and redeploy after any Vercel environment changes.
4. In a private browser window, check sign-in and sign-out with a verified Jazz account. Confirm a non-Jazz account and direct unauthenticated API requests are blocked. Then check month switching, comparisons, review filters, and Gemini summaries if enabled.
5. Use a stable preview domain and separate values if you want a preview deployment with real sign-in. Keep the existing deployment available until the Vercel checks pass.

[Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs) · [Vercel environment variables](https://vercel.com/docs/environment-variables) · [Auth0 SDK settings](https://github.com/auth0/nextjs-auth0)
