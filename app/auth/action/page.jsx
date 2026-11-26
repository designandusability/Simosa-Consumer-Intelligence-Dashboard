import { redirect } from "next/navigation";
import { firebaseConfig } from "../../../lib/auth";
import ConfirmAuthenticatorRemoval from "./confirm-authenticator-removal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account Security | Semantic CX", referrer: "no-referrer" };

const hostedModes = new Set(["resetPassword", "verifyEmail", "recoverEmail", "verifyAndChangeEmail"]);

export default async function EmailAction({ searchParams }) {
  const { mode, oobCode, apiKey, continueUrl, lang } = await searchParams;
  const config = firebaseConfig();
  if (config && typeof oobCode === "string" && oobCode && apiKey === config.apiKey) {
    if (hostedModes.has(mode)) {
      const target = new URL(`https://${config.projectId}.firebaseapp.com/__/auth/action`);
      for (const [name, value] of Object.entries({ mode, oobCode, apiKey, continueUrl, lang })) {
        if (typeof value === "string") target.searchParams.set(name, value);
      }
      redirect(target.toString());
    }
    if (mode === "revertSecondFactorAddition") {
      return <main className="login-layout"><section className="login-card" aria-labelledby="action-title">
        <h1 id="action-title">Remove an authenticator?</h1>
        <p>Confirm only if you did not add this authenticator to your Semantic CX account.</p>
        <ConfirmAuthenticatorRemoval config={config} code={oobCode} />
      </section></main>;
    }
  }

  return <main className="login-layout"><section className="login-card">
    <h1>Account action unavailable</h1>
    <p>This link is incomplete or unsupported. Contact the dashboard administrator for help.</p>
  </section></main>;
}
