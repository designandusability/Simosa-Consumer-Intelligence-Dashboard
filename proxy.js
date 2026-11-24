import { NextResponse } from "next/server";
import { authClient } from "./lib/auth";

export async function proxy(request) {
  if (!["/auth/login", "/auth/callback", "/auth/logout"].includes(request.nextUrl.pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const auth = authClient();
  return auth
    ? auth.middleware(request)
    : new NextResponse("Dashboard sign-in is not configured.", { status: 503 });
}

export const config = { matcher: ["/auth/:path*"] };
