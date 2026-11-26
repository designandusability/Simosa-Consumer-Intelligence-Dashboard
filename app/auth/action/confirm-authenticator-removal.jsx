"use client";

import { useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import { ActionCodeOperation, applyActionCode, checkActionCode, getAuth } from "firebase/auth";

export default function ConfirmAuthenticatorRemoval({ config, code }) {
  const [state, setState] = useState("ready");

  async function confirm() {
    setState("working");
    try {
      const name = "semantic-email-action";
      const app = getApps().find(item => item.name === name) ?? initializeApp(config, name);
      const auth = getAuth(app);
      const action = await checkActionCode(auth, code);
      if (action.operation !== ActionCodeOperation.REVERT_SECOND_FACTOR_ADDITION) throw new Error("Unexpected action");
      await applyActionCode(auth, code);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return <div className="login-actions">
    {state === "done" ? <p role="status">Authenticator removed. Contact the dashboard administrator if you suspect unauthorized access.</p>
      : <>
        <button type="button" className="button primary" onClick={confirm} disabled={state === "working"}>
          {state === "working" ? "Removing…" : "Confirm removal"}
        </button>
        {state === "error" && <p className="notice" role="alert">The link could not be used. It may be expired or already used.</p>}
      </>}
    <a href="/">Return to sign in</a>
  </div>;
}
