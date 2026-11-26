import { protectedResponse, DashboardError } from "../../../lib/http";
import { availableMonths, openDashboardSheets, requireMonth, requireTabs } from "../../../lib/sheets";
import {
  aspectsFrom, issueMovement, monthLabel, number, overviewMetrics,
  prioritize, reviewActivity, reviewDate, taggedReviews, trendMonth,
} from "../../../lib/analytics.mjs";
import { requestedDashboardId, simosaDashboard } from "../../../lib/dashboard-access.mjs";
import { productRows, reportTabs } from "../../../lib/product-reports.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const query = new URL(request.url).searchParams;
  const dashboardId = requestedDashboardId(query);
  return protectedResponse(dashboardId, async () => {
    const { tabTitles, readTabs } = openDashboardSheets(dashboardId);
    const titles = await tabTitles();
    const months = availableMonths(titles);
    if (!months.length) throw new DashboardError("No monthly summary worksheets were found.");
    const meta = titles.has("meta") ? (await readTabs(["meta"])).meta : [];
    const latest = String(meta.find((row) => row.key === "latest_month")?.value ?? "").trim();
    const requestedMonth = query.get("month");
    const month = requestedMonth ? requireMonth(requestedMonth, titles) : months.includes(latest) ? latest : months[0];
    const monthIndex = months.indexOf(month);
    const compare = query.get("compare") ?? "previous";
    if (!["previous", "custom", "none"].includes(compare)) throw new DashboardError("Invalid comparison mode.", 400);
    const baseline = compare === "previous" ? months[monthIndex + 1]
      : compare === "custom" ? query.get("baseline") : null;
    if (baseline && !months.slice(monthIndex + 1).includes(baseline)) {
      throw new DashboardError("Choose an earlier reporting month for the comparison.", 400);
    }
    const { raw, untagged, ...names } = reportTabs(dashboardId, month);
    requireTabs(titles, Object.values(names));
    const trendKeys = months.slice(monthIndex, monthIndex + 3).reverse();
    const historyKeys = months.slice(monthIndex, monthIndex + 4);
    const baselineTabs = baseline ? reportTabs(dashboardId, baseline) : null;
    const optional = [raw, untagged, baselineTabs?.summary, baselineTabs?.aspects].filter(title => titles.has(title));
    const rows = await readTabs([
      ...Object.values(names), ...historyKeys.map(key => reportTabs(dashboardId, key).summary), ...optional,
    ]);
    const summaryFor = key => productRows(dashboardId, rows[reportTabs(dashboardId, key).summary] ?? [])[0];
    const comparison = baseline ? summaryFor(baseline) : undefined;
    const current = summaryFor(month);
    if (!current) throw new DashboardError("No matching product summary was found for this reporting month.");
    const metrics = overviewMetrics(current, productRows(dashboardId, rows[names.insights])[0]);
    const aspects = aspectsFrom(rows[names.aspects]);
    const priority = prioritize(aspects);
    const movement = issueMovement(aspects, aspectsFrom(rows[baselineTabs?.aspects] ?? []));
    const tagged = taggedReviews(productRows(dashboardId, rows[names.tagged]));
    const activity = reviewActivity(tagged, month);
    const rawCount = rows[raw]?.length || metrics.total || 0;

    return {
      months: months.map((key) => ({ key, label: monthLabel(key) })),
      month, label: monthLabel(month), baseline, baselineLabel: monthLabel(baseline),
      metrics, comparison: comparison ? overviewMetrics(comparison) : null,
      daily: productRows(dashboardId, rows[names.daily], "source").map((row) => ({
        date: reviewDate(row.date), rating: number(row.avg_rating), reviews: number(row.n_reviews),
      })).filter((row) => row.date).sort((a, b) => a.date.localeCompare(b.date)),
      weekly: productRows(dashboardId, rows[names.weekly]).map((row) => ({
        week: String(row.week_label ?? ""), reviews: number(row.reviews), sentiment: number(row.avg_sentiment),
      })),
      activity: activity.windows, priority, movement,
      trends: trendKeys.flatMap((key) => {
        const trend = trendMonth(key, summaryFor(key));
        if (!trend) return [];
        const prior = historyKeys[historyKeys.indexOf(key) + 1];
        const priorTrend = prior ? trendMonth(prior, summaryFor(prior)) : null;
        return [{ ...trend, previous: priorTrend && { month: priorTrend.month, stars: priorTrend.stars } }];
      }),
      coverage: { tagged: activity.unique,
        untagged: rows[untagged]?.length ?? (dashboardId === simosaDashboard.id ? 0 : null),
        detectedRate: rawCount ? activity.unique * 100 / rawCount : 0 },
    };
  });
}
