import { filterReviews, taggedReviews } from "../../../lib/analytics.mjs";
import { protectedResponse, DashboardError } from "../../../lib/http";
import { readTabs, requireMonth, requireTabs, tabTitles } from "../../../lib/sheets";

import { simosaDashboard } from "../../../lib/dashboard-access.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return protectedResponse(simosaDashboard.id, async () => {
    const query = new URL(request.url).searchParams;
    const min = Number(query.get("min") ?? 1);
    const max = Number(query.get("max") ?? 5);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > 5 || min > max) {
      throw new DashboardError("Choose a rating range between 1 and 5.", 400);
    }
    const titles = await tabTitles();
    const month = requireMonth(query.get("month"), titles);
    const tab = `simosa_tagged_reviews_${month}`;
    requireTabs(titles, [tab]);
    return filterReviews(taggedReviews((await readTabs([tab]))[tab]), {
      aspects: query.getAll("aspect"),
      sentiments: query.getAll("sentiment"),
      min, max,
    });
  });
}
