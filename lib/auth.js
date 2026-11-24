import "server-only";
import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";
import { MFA_CLAIM, SESSION_SECONDS, canAccessDashboard } from "./policy.mjs";

let auth0;

export function authClient() {
  if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_CLIENT_ID ||
      !process.env.AUTH0_CLIENT_SECRET || !process.env.APP_BASE_URL ||
      !/^[\da-f]{64}$/i.test(process.env.AUTH0_SECRET ?? "")) {
    return null;
  }
  return auth0 ??= new Auth0Client({
    authorizationParameters: { scope: "openid profile email", prompt: "login" },
    enableAccessTokenEndpoint: false,
    session: { rolling: false, absoluteDuration: SESSION_SECONDS },
    async beforeSessionSaved(session) {
      const { sub, email, email_verified, iat, exp } = session.user;
      return {
        ...session,
        user: { sub, email, email_verified, iat, exp, [MFA_CLAIM]: session.user[MFA_CLAIM] },
      };
    },
    async onCallback(error) {
      return NextResponse.redirect(new URL(error ? "/?auth=failed" : "/", process.env.APP_BASE_URL));
    },
  });
}

export async function viewer() {
  const session = await authClient()?.getSession();
  return canAccessDashboard(session?.user) ? session.user : null;
}
