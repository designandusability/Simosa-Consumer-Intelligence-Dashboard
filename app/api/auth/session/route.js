import { cookies } from "next/headers";
import { adminAuth, isCurrentApprovedAccount, sessionCookie, validAuthOrigin } from "../../../../lib/auth";
import { hasCurrentAuthenticator, isApprovedFirebaseSignIn, SESSION_SECONDS } from "../../../../lib/firebase-policy.mjs";

const headers = { "Cache-Control": "no-store" };

export async function POST(request) {
  if (!validAuthOrigin(request)) return new Response(null, { status: 403, headers });
  const { idToken } = await request.json().catch(() => null) ?? {};
  if (typeof idToken !== "string" || idToken.length > 12000) {
    return new Response(null, { status: 400, headers });
  }

  try {
    const auth = adminAuth();
    if (!auth) return new Response(null, { status: 503, headers });
    const user = await auth.verifyIdToken(idToken, true).catch(() => null);
    const age = Date.now() / 1000 - user?.auth_time;
    if (!isApprovedFirebaseSignIn(user) || !(age >= 0 && age < 300)) {
      return new Response(null, { status: 403, headers });
    }

    const account = await auth.getUser(user.uid);
    if (!isCurrentApprovedAccount(account, user)) return new Response(null, { status: 403, headers });

    if (!hasCurrentAuthenticator(account, user)) {
      const needsEnrollment = !account.multiFactor?.enrolledFactors.length && !user.firebase.sign_in_second_factor;
      return new Response(null, { status: needsEnrollment ? 409 : 403, headers });
    }

    const value = await auth.createSessionCookie(idToken, { expiresIn: SESSION_SECONDS * 1000 });
    (await cookies()).set(sessionCookie, value, {
      httpOnly: true, secure: new URL(process.env.APP_BASE_URL).protocol === "https:", sameSite: "lax",
      path: "/", maxAge: SESSION_SECONDS,
    });
    return new Response(null, { status: 204, headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
