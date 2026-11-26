export const simosaDashboard = Object.freeze({
  id: "simosa",
  name: "SIMOSA Sentiment Analysis",
  logo: "/brand/simosa-app.png",
  heroLogo: "/brand/simosa.png",
  product: "SIMOSA",
});

export const tamashaDashboard = Object.freeze({
  id: "tamasha",
  name: "Tamasha Sentiment Analysis",
  logo: "/brand/tamasha-app.png",
  heroLogo: "/brand/tamasha-app.png",
  product: "Tamasha",
});

export const dashboards = Object.freeze([simosaDashboard, tamashaDashboard]);

export function requestedDashboardId(query) {
  return query.get("dashboard") ?? simosaDashboard.id;
}

export function canAccessDashboard(claims, dashboardId) {
  if (!dashboardId || !dashboards.some(({ id }) => id === dashboardId)) return false;
  const access = claims?.cx_dashboards;
  if (access === undefined) return dashboardId === simosaDashboard.id && Boolean(claims?.simosa_email);
  return access === "*" || (Array.isArray(access) && access.includes(dashboardId));
}
