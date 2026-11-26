import { cookies } from "next/headers";
import { sessionCookie, validAuthOrigin } from "../../../../lib/auth";

export async function POST(request) {
  if (!validAuthOrigin(request)) return new Response(null, { status: 403 });
  (await cookies()).delete(sessionCookie);
  return new Response(null, { status: 303, headers: { Location: "/", "Cache-Control": "no-store" } });
}
