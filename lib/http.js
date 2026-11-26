import "server-only";
import { viewer } from "./auth";
import { canAccessDashboard } from "./dashboard-access.mjs";

export class DashboardError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.status = status;
  }
}

export async function protectedResponse(dashboardId, action) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await viewer();
    if (!user) {
      return Response.json({ error: "Your session has ended. Sign in again." }, { status: 401, headers });
    }
    if (!canAccessDashboard(user.dashboardClaims, dashboardId)) {
      return Response.json({ error: "You don’t have access to this dashboard." }, { status: 403, headers });
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
