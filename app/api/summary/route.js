import { actionableReviews, aspectsFrom, executiveEvidence, monthLabel, overviewMetrics, taggedReviews } from "../../../lib/analytics.mjs";
import { generateSummary } from "../../../lib/gemini";
import { protectedResponse, DashboardError } from "../../../lib/http";
import { availableMonths, readTabs, requireMonth, requireTabs, tabTitles } from "../../../lib/sheets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const executiveInstructions = "Write 5 to 7 complete Markdown bullet points for leadership. Cover review volume and rating, sentiment, the strongest product pain points, positive signals, and practical priorities. Label the comparison and quantify changes where supported. Do not invent numbers.";
const hasBulletList = (text) => {
  const bullets = text.split("\n").filter((line) => /^\s*[-*]\s+\S/.test(line));
  return bullets.length >= 5 && bullets.length <= 7 && /[.!?]["')\]]*$/.test(text);
};

export async function POST(request) {
  return protectedResponse(async () => {
    if (request.headers.get("origin") !== new URL(process.env.APP_BASE_URL).origin) {
      throw new DashboardError("Open the dashboard to request a summary.", 403);
    }
    let input;
    try {
      input = await request.json();
    } catch {
      throw new DashboardError("Invalid summary request.", 400);
    }
    const { kind, aspect, month: requestedMonth, baseline } = input ?? {};
    if (!["executive", "aspect"].includes(kind) || (kind === "aspect" && typeof aspect !== "string")) {
      throw new DashboardError("Choose an executive or aspect summary.", 400);
    }
    const titles = await tabTitles();
    const month = requireMonth(requestedMonth, titles);
    const taggedTab = `simosa_tagged_reviews_${month}`;
    const summaryTab = `summary_${month}`;
    const aspectsTab = `simosa_aspects_${month}`;
    const names = kind === "aspect" ? [taggedTab] : [taggedTab, summaryTab, aspectsTab];
    if (kind === "executive" && baseline) {
      requireMonth(baseline, titles);
      if (!availableMonths(titles).slice(availableMonths(titles).indexOf(month) + 1).includes(baseline)) {
        throw new DashboardError("Choose an earlier comparison month.", 400);
      }
      names.push(`summary_${baseline}`);
    }
    requireTabs(titles, names);
    const tabs = await readTabs(names);
    const reviews = taggedReviews(tabs[taggedTab]);

    if (kind === "aspect") {
      const excerpts = [...new Set(actionableReviews(reviews)
        .filter((review) => review.aspect === aspect).map((review) => review.text).filter(Boolean))].slice(0, 150);
      if (!excerpts.length) throw new DashboardError("No review text is available for this aspect.", 400);
      const summary = await generateSummary("Write one 90–130 word paragraph about this aspect. Focus on specific recurring experiences. Output the paragraph only.", {
        month: monthLabel(month), aspect, excerpts: excerpts.map((item) => item.slice(0, 800)),
      });
      return { summary, sampleSize: excerpts.length };
    }

    const excerpts = executiveEvidence(reviews);
    if (!excerpts.length) throw new DashboardError("No tagged review evidence is available for this month.", 400);
    const evidence = {
      month: monthLabel(month), metrics: overviewMetrics(tabs[summaryTab][0]),
      comparison: baseline ? { month: monthLabel(baseline), metrics: overviewMetrics(tabs[`summary_${baseline}`][0]) } : null,
      aspects: aspectsFrom(tabs[aspectsTab]), excerpts,
    };
    let summary = await generateSummary(executiveInstructions, evidence);
    if (!hasBulletList(summary)) summary = await generateSummary(executiveInstructions + " End each bullet with a complete sentence.", evidence);
    if (!hasBulletList(summary)) throw new DashboardError("Gemini returned an incomplete summary. Try again.");
    return { summary, sampleSize: excerpts.length };
  });
}
