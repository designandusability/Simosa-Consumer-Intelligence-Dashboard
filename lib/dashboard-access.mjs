export const simosaDashboard = Object.freeze({
  id: "simosa",
  name: "SIMOSA Sentiment Analysis",
  logo: "/brand/simosa-app.png",
});

export const dashboards = Object.freeze([simosaDashboard]);

export function canAccessDashboard(claims, dashboardId) {
  if (!dashboardId || !dashboards.some(({ id }) => id === dashboardId)) return false;
  const access = claims?.cx_dashboards;
  if (access === undefined) return dashboardId === simosaDashboard.id && Boolean(claims?.simosa_email);
  return access === "*" || (Array.isArray(access) && access.includes(dashboardId));
}
