import "server-only";
import { viewer } from "./auth";

export class DashboardError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.status = status;
  }
}

export async function protectedResponse(action) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (!(await viewer())) {
      return Response.json({ error: "Your session has ended. Sign in again." }, { status: 401, headers });
    }
    return Response.json(await action(), { headers });
  } catch (error) {
    const userError = error instanceof DashboardError;
    if (!userError) console.error("Dashboard request failed.", error?.name);
    return Response.json({
      error: userError ? error.message : "The dashboard could not load. Please try again.",
    }, { status: userError ? error.status : 500, headers });
  }
}
