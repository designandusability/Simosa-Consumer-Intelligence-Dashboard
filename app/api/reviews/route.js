import { filterReviews, taggedReviews } from "../../../lib/analytics.mjs";
import { protectedResponse, DashboardError } from "../../../lib/http";
import { openDashboardSheets, requireMonth, requireTabs } from "../../../lib/sheets";
import { requestedDashboardId } from "../../../lib/dashboard-access.mjs";
import { productRows, reportTabs } from "../../../lib/product-reports.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const query = new URL(request.url).searchParams;
  const dashboardId = requestedDashboardId(query);
  return protectedResponse(dashboardId, async () => {
    const { tabTitles, readTabs } = openDashboardSheets(dashboardId);
    const min = Number(query.get("min") ?? 1);
    const max = Number(query.get("max") ?? 5);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > 5 || min > max) {
      throw new DashboardError("Choose a rating range between 1 and 5.", 400);
    }
    const titles = await tabTitles();
    const month = requireMonth(query.get("month"), titles);
    const { tagged: tab } = reportTabs(dashboardId, month);
    requireTabs(titles, [tab]);
    return filterReviews(taggedReviews(productRows(dashboardId, (await readTabs([tab]))[tab])), {
      aspects: query.getAll("aspect"),
      sentiments: query.getAll("sentiment"),
      min, max,
    });
  });
}
