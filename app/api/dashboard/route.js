import { protectedResponse, DashboardError } from "../../../lib/http";
import { availableMonths, readTabs, requireMonth, requireTabs, tabTitles } from "../../../lib/sheets";
import {
  aspectsFrom, issueMovement, monthLabel, number, overviewMetrics,
  prioritize, reviewActivity, reviewDate, taggedReviews, trendMonth,
} from "../../../lib/analytics.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return protectedResponse(async () => {
    const query = new URL(request.url).searchParams;
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
    const names = {
      summary: `summary_${month}`, weekly: `weekly_${month}`, daily: `daily_ratings_${month}`,
      aspects: `simosa_aspects_${month}`, tagged: `simosa_tagged_reviews_${month}`, insights: `simosa_insights_${month}`,
    };
    requireTabs(titles, Object.values(names));
    const trendKeys = months.slice(monthIndex, monthIndex + 3).reverse();
    const historyKeys = months.slice(monthIndex, monthIndex + 4);
    const optional = [`simosa_raw_reviews_${month}`, `simosa_untagged_${month}`];
    const baselineNames = baseline ? [`summary_${baseline}`, `simosa_aspects_${baseline}`] : [];
    const rows = await readTabs([
      ...Object.values(names), ...historyKeys.map((key) => `summary_${key}`),
      ...[...optional, ...baselineNames].filter((title) => titles.has(title)),
    ]);
    const metrics = overviewMetrics(rows[names.summary][0], rows[names.insights][0]);
    const aspects = aspectsFrom(rows[names.aspects]);
    const priority = prioritize(aspects);
    const [baselineSummary, baselineAspects] = baselineNames;
    const movement = issueMovement(aspects, aspectsFrom(rows[baselineAspects] ?? []));
    const tagged = taggedReviews(rows[names.tagged]);
    const activity = reviewActivity(tagged, month);
    const raw = rows[optional[0]]?.length || metrics.total || 0;

    return {
      months: months.map((key) => ({ key, label: monthLabel(key) })),
      month, label: monthLabel(month), baseline, baselineLabel: monthLabel(baseline),
      metrics, comparison: rows[baselineSummary]?.[0] ? overviewMetrics(rows[baselineSummary][0]) : null,
      daily: rows[names.daily].map((row) => ({
        date: reviewDate(row.date), rating: number(row.avg_rating), reviews: number(row.n_reviews),
      })).filter((row) => row.date).sort((a, b) => a.date.localeCompare(b.date)),
      weekly: rows[names.weekly].map((row) => ({
        week: String(row.week_label ?? ""), reviews: number(row.reviews), sentiment: number(row.avg_sentiment),
      })),
      activity: activity.windows, priority, movement,
      trends: trendKeys.flatMap((key) => {
        const trend = trendMonth(key, rows[`summary_${key}`]?.[0]);
        if (!trend) return [];
        const prior = historyKeys[historyKeys.indexOf(key) + 1];
        const priorTrend = trendMonth(prior, rows[`summary_${prior}`]?.[0]);
        return [{ ...trend, previous: priorTrend && { month: priorTrend.month, stars: priorTrend.stars } }];
      }),
      coverage: { tagged: activity.unique, untagged: rows[optional[1]]?.length ?? 0,
        detectedRate: raw ? activity.unique * 100 / raw : 0 },
    };
  });
}
