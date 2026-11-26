import { cookies } from "next/headers";
import { adminAuth, firebaseAdminApp, isCurrentApprovedAccount, sessionCookie, validAuthOrigin } from "../../../../lib/auth";
import { isApprovedFirebaseSignIn, SESSION_SECONDS } from "../../../../lib/firebase-policy.mjs";
import { isPortalTotpAccount, portalProof, portalProofCookie, portalTotpPreview } from "../../../../lib/portal-totp.mjs";
import { updatePortalFactor } from "../../../../lib/portal-totp-store";

const headers = { "Cache-Control": "no-store" };
const response = status => new Response(null, { status, headers });

export async function POST(request) {
  const preview = portalTotpPreview();
  if (!preview && !process.env.PORTAL_TOTP_PILOT_EMAIL) return response(404);
  if (!validAuthOrigin(request)) return response(403);
  const { idToken, code } = await request.json().catch(() => null) ?? {};
  if (typeof idToken !== "string" || !idToken || idToken.length > 12000 ||
      (code !== undefined && (typeof code !== "string" || !/^[0-9]{6}$/.test(code)))) return response(400);

  try {
    const auth = adminAuth();
    const masterKey = process.env.PORTAL_TOTP_KEY;
    if (!auth || !/^[0-9a-f]{64}$/i.test(masterKey ?? "")) return response(503);
    const user = await auth.verifyIdToken(idToken, true).catch(() => null);
    const age = Date.now() / 1000 - user?.auth_time;
    if (!isApprovedFirebaseSignIn(user) || !(age >= 0 && age < 300)) return response(403);
    const account = await auth.getUser(user.uid);
    if (!isCurrentApprovedAccount(account, user) || !isPortalTotpAccount(account)) return response(403);

    const result = await updatePortalFactor(firebaseAdminApp(), {
      uid: user.uid, authTime: user.auth_time, code, masterKey,
    });
    if (result.status === 201) return Response.json({ setupKey: result.setupKey }, { status: 201, headers });
    if (result.status !== 204) return response(result.status);

    const value = await auth.createSessionCookie(idToken, { expiresIn: SESSION_SECONDS * 1000 });
    const proof = portalProof(masterKey, user.uid, result.factorId, value);
    const jar = await cookies();
    const options = {
      httpOnly: true, secure: new URL(process.env.APP_BASE_URL).protocol === "https:", sameSite: "lax",
      path: "/", maxAge: SESSION_SECONDS,
    };
    jar.set(sessionCookie, value, options);
    jar.set(portalProofCookie, proof, options);
    return response(204);
  } catch (error) {
    console.error("Preview authenticator request failed.", error?.name);
    return response(503);
  }
}
