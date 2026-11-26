import { cookies } from "next/headers";
import { sessionCookie, validAuthOrigin } from "../../../../lib/auth";

import { portalProofCookie } from "../../../../lib/portal-totp.mjs";

export async function POST(request) {
  if (!validAuthOrigin(request)) return new Response(null, { status: 403 });
  const jar = await cookies();
  jar.delete(sessionCookie);
  if (jar.has(portalProofCookie)) jar.delete(portalProofCookie);
  return new Response(null, { status: 303, headers: { Location: "/", "Cache-Control": "no-store" } });
}
