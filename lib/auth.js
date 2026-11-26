import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { cookies } from "next/headers";
import { hasCurrentAuthenticator, isApprovedFirebaseSignIn } from "./firebase-policy.mjs";

import { isPortalTotpAccount, matchesPortalProof, portalProofCookie, portalTotpPreview } from "./portal-totp.mjs";

export const sessionCookie = "simosa_totp_session";

export function firebaseConfig() {
  const apiKey = process.env.FIREBASE_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN || (projectId && `${projectId}.firebaseapp.com`);
  return apiKey && projectId && process.env.FIREBASE_ADMIN_CREDENTIALS
    && process.env.APP_BASE_URL
    ? { apiKey, authDomain, projectId }
    : null;
}

export function firebaseAdminApp() {
  const config = firebaseConfig();
  if (!config) return null;
  const existing = getApps().find(app => app.name === "simosa");
  if (existing) return existing;
  const credentials = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
  if (credentials.project_id !== config.projectId) throw new Error("Firebase Auth project mismatch.");
  return initializeApp({ projectId: config.projectId, credential: cert(credentials) }, "simosa");
}

export function adminAuth() {
  const app = firebaseAdminApp();
  return app ? getAuth(app) : null;
}

export function validAuthOrigin(request) {
  const origin = request.headers.get("origin");
  return [process.env.APP_BASE_URL, process.env.APP_ADDITIONAL_ORIGIN]
    .some(configured => configured && new URL(configured).origin === origin);
}

export function isCurrentApprovedAccount(account, user) {
  return !account.disabled && account.emailVerified && account.customClaims?.simosa_email === user.simosa_email
    && account.email?.toLowerCase() === user.simosa_email;
}

export async function viewer() {
  const jar = await cookies();
  const cookie = jar.get(sessionCookie)?.value;
  if (!cookie) return null;
  try {
    const auth = adminAuth();
    const user = await auth?.verifySessionCookie(cookie, true);
    if (!isApprovedFirebaseSignIn(user)) return null;
    const account = await auth.getUser(user.uid);
    if (!isCurrentApprovedAccount(account, user)) return null;
    if (isPortalTotpAccount(account)) {
      const proof = jar.get(portalProofCookie)?.value;
      if (!proof) return null;
      const { enrolledPortalFactorId } = await import("./portal-totp-store");
      const factorId = await enrolledPortalFactorId(firebaseAdminApp(), user.uid);
      if (!matchesPortalProof(process.env.PORTAL_TOTP_KEY, user.uid, factorId, cookie, proof)) return null;
    } else if (portalTotpPreview() || !hasCurrentAuthenticator(account, user)) {
      return null;
    }
    return { dashboardClaims: account.customClaims };
  } catch {
    return null;
  }
}
