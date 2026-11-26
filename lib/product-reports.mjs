import { simosaDashboard, tamashaDashboard } from "./dashboard-access.mjs";

export function reportTabs(dashboardId, month) {
  return {
    summary: `summary_${month}`,
    weekly: `weekly_${month}`,
    daily: `daily_ratings_${month}`,
    aspects: `${dashboardId}_aspects_${month}`,
    tagged: `${dashboardId}_tagged_reviews_${month}`,
    insights: `${dashboardId}_insights_${month}`,
    raw: `${dashboardId}_raw_reviews_${month}`,
    untagged: `${dashboardId}_untagged_${month}`,
  };
}

export function productRows(dashboardId, rows, column = "app") {
  if (dashboardId === simosaDashboard.id) return rows;
  if (dashboardId !== tamashaDashboard.id) return [];
  return rows.filter(row => String(row[column] ?? "").trim().toLowerCase() === dashboardId);
}
