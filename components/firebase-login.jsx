"use client";

import { useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import {
  getAuth, getMultiFactorResolver, inMemoryPersistence, multiFactor, setPersistence,
  signInWithEmailAndPassword, signOut, TotpMultiFactorGenerator,
} from "firebase/auth";
import QRCode from "qrcode";
import { isJazzEmail } from "../lib/firebase-policy.mjs";

function getLoginAuth(config) {
  const app = getApps().find(item => item.name === "simosa-login") ?? initializeApp(config, "simosa-login");
  return getAuth(app);
}

function requestDashboardSession(idToken) {
  return fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

export default function FirebaseLogin({ config }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function backToSignIn(auth) {
    setCode("");
    setEnrollment(null);
    setChallenge(null);
    await signOut(auth);
  }

  async function run(action) {
    setBusy(true);
    setFeedback(null);
    try {
      await action(getLoginAuth(config));
    } catch (error) {
      const messages = {
        "auth/too-many-requests": "Too many attempts. Wait a while and try again.",
        "auth/invalid-verification-code": "That code didn’t work. Wait for a new code in your authenticator and try again.",
        "auth/code-expired": "This sign-in attempt expired. Go back and sign in again.",
      };
      setFeedback({ error: true, text: messages[error.code] || "Couldn’t complete this step. Check your details and try again." });
    } finally {
      setBusy(false);
    }
  }

  async function finishSignIn(auth, user, mayEnroll) {
    let response;
    let enrolling = false;
    try {
      response = await requestDashboardSession(await user.getIdToken());
      if (response.status === 409 && mayEnroll) {
        const session = await multiFactor(user).getSession();
        const secret = await TotpMultiFactorGenerator.generateSecret(session);
        const qr = await QRCode.toDataURL(secret.generateQrCodeUrl(user.email, "SIMOSA Dashboard"));
        setEnrollment({ user, secret, qr });
        enrolling = true;
        return;
      }
    } finally {
      if (!enrolling) await backToSignIn(auth);
    }

    if (response.ok) {
      window.location.replace("/");
    } else {
      setFeedback({ error: true, text: response.status === 403
        ? "This account isn’t ready for SIMOSA sign-in. Contact the dashboard administrator."
        : "Couldn’t complete sign-in. Try again shortly." });
    }
  }

  function submit(event) {
    event.preventDefault();
    return run(async auth => {
      if (enrollment) {
        const assertion = TotpMultiFactorGenerator.assertionForEnrollment(enrollment.secret, code);
        await multiFactor(enrollment.user).enroll(assertion, "Authenticator app");
        await backToSignIn(auth);
        setFeedback({ text: "Authenticator added. Wait for a new six-digit code in your app, then sign in again." });
        return;
      }
      if (challenge) {
        const assertion = TotpMultiFactorGenerator.assertionForSignIn(challenge.factor.uid, code);
        const { user } = await challenge.resolver.resolveSignIn(assertion);
        await finishSignIn(auth, user, false);
        return;
      }

      const address = email.trim().toLowerCase();
      if (!isJazzEmail(address)) {
        setFeedback({ error: true, text: "Enter your @jazz.com.pk email address." });
        return;
      }
      await setPersistence(auth, inMemoryPersistence);
      let user;
      try {
        ({ user } = await signInWithEmailAndPassword(auth, address, password));
      } catch (error) {
        if (error.code !== "auth/multi-factor-auth-required") throw error;
        const resolver = getMultiFactorResolver(auth, error);
        const factor = resolver.hints.find(hint => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        if (!factor) throw error;
        setChallenge({ resolver, factor });
      } finally {
        setPassword("");
      }
      if (user) await finishSignIn(auth, user, true);
    });
  }

  const needsCode = Boolean(enrollment || challenge);
  return <div className="login-actions">
    <form className="login-form" onSubmit={submit}>
      {enrollment && <div className="login-setup">
        <p>Scan this QR code in your authenticator app, then enter the six-digit code.</p>
        <img src={enrollment.qr} alt="SIMOSA authenticator setup QR code" width="160" height="160" />
        <details><summary>Enter the setup key manually</summary><code>{enrollment.secret.secretKey}</code></details>
      </div>}
      {needsCode ? <label>Authenticator code<input value={code} onChange={event => setCode(event.target.value)}
        inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required /></label> : <>
        <label>Jazz email<input type="email" value={email} onChange={event => setEmail(event.target.value)}
          placeholder="you@jazz.com.pk" autoComplete="username" required /></label>
        <label>Dashboard password<input type="password" value={password}
          onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></label>
      </>}
      {feedback && <p className="notice" role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
      <button className="button primary" type="submit" disabled={busy}>
        {busy ? "Please wait…" : enrollment ? "Add authenticator" : challenge ? "Verify code" : "Sign in"}
      </button>
    </form>
    <div className="login-help login-links">
      {needsCode ? <button type="button" disabled={busy} onClick={() => run(backToSignIn)}>Back to sign in</button>
        : <p>For password or authenticator help, contact the dashboard administrator.</p>}
    </div>
  </div>;
}
