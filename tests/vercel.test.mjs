import { strict as assert } from "node:assert";
import { test } from "node:test";
import { productRows, reportTabs } from "../lib/product-reports.mjs";
import {
  aspectsFrom, executiveEvidence, filterReviews, issueMovement, overviewMetrics,
  prioritize, reviewActivity, reviewDate, taggedReviews, trendMonth,
} from "../lib/analytics.mjs";
import { MFA_CLAIM, canAccessDashboard } from "../lib/policy.mjs";

test("the Vercel access policy requires a verified Jazz address, signed MFA claim, and current token", () => {
  const now = 100000;
  const user = { email: "employee@JAZZ.COM.PK", email_verified: true, [MFA_CLAIM]: true, iat: now - 1, exp: now + 1 };
  assert.equal(canAccessDashboard(user, now), true);
  for (const invalid of [
    { email: "employee@jazz.com.pk.example" },
    { email: "employee@jazz.com.pk\n" },
    { email: "@jazz.com.pk" },
    { email_verified: false },
    { [MFA_CLAIM]: "true" },
    { iat: now + 1 }, { iat: now - 3600 }, { exp: now },
  ]) assert.equal(canAccessDashboard({ ...user, ...invalid }, now), false);
  assert.equal(canAccessDashboard(null, now), false);
});

test("monthly metrics preserve missing values, health formula, and rounding", () => {
  const row = { total_reviews: "250", avg_rating: 4, positive_pct: 65, negative_pct: 15, five_star: 150, one_star: 20 };
  const metrics = overviewMetrics(row, { aspect_coverage_pct: 55 });
  assert.equal(metrics.health, 74.25);
  assert.deepEqual(metrics.stars, [20, null, null, null, 150]);
  assert.equal(metrics.coverage, 55);
  const trend = trendMonth("2026_10", row);
  assert.equal(trend.positives, 162);
  assert.equal(trend.negatives, 38);
  assert.equal(trend.month, "October 2026");
});

test("aspect ranking excludes broad sentiment and movement includes themes on either side", () => {
  const current = aspectsFrom([
    { Aspect: " Overall Experience ", mentions: 1000, Negative: 900 },
    { Aspect: "Recharge", mentions: 100, Negative: 50, "neg_%": 50 },
    { Aspect: "Navigation", mentions: 10, Negative: 9, "neg_%": 90 },
  ]);
  const baseline = aspectsFrom([
    { Aspect: "Recharge", mentions: 100, Negative: 40, "neg_%": 40 },
    { Aspect: "Bundles", mentions: 30, Negative: 20, "neg_%": 66.7 },
  ]);
  assert.equal(prioritize(current)[0].aspect, "Recharge");
  assert.equal(prioritize(current)[0].score, 79);
  assert.equal(prioritize(current)[0].priority, "P1");
  assert.deepEqual(issueMovement(current, baseline).map(({ aspect, change }) => [aspect, change]),
    [["Recharge", 10], ["Navigation", 9], ["Bundles", -20]]);
});

test("review filters and evidence use actionable records; monthly activity deduplicates reviews", () => {
  const rows = taggedReviews([
    { aspects: "Recharge", name: "Example", review_text: "Fictional first review", date: "2026-10-31", rating: 1, sentiment: "Negative" },
    { aspects: "Navigation", name: "Example", review_text: "Fictional first review", date: "2026-10-31", rating: 1, sentiment: "Negative" },
    { aspects: "Overall Experience", name: "Example", review_text: "Overall comment", date: "2026-10-01", rating: 2, sentiment: "Negative" },
    { aspects: "Recharge", name: "Example", review_text: "Fictional second review", date: "2026-10-04", rating: 5, sentiment: "Positive" },
  ]);
  const filters = { aspects: ["Recharge"], sentiments: ["Negative"], min: 1, max: 2 };
  const result = filterReviews(rows, filters);
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].date, "2026-10-31");
  assert.deepEqual(result.aspects, ["Navigation", "Recharge"]);
  const activity = reviewActivity(rows, "2026_10");
  assert.equal(activity.unique, 3);
  assert.deepEqual(activity.windows.at(-1), { period: "26–31", reviews: 1 });
  assert.equal(executiveEvidence(rows).length, 3);
  assert.equal(executiveEvidence(rows).some((row) => "name" in row), false);
  assert.equal(reviewDate(2), "1900-01-01");
});

test("Tamasha rows never fall back to competitors in shared reporting tabs", () => {
  const competitor = { app: "myco", source: "tapmad", total_reviews: 500 };
  const tamasha = { app: " Tamasha ", source: "TAMASHA", total_reviews: 41 };
  assert.deepEqual(productRows("tamasha", [competitor, tamasha]), [tamasha]);
  assert.deepEqual(productRows("tamasha", [competitor, tamasha], "source"), [tamasha]);
  assert.deepEqual(productRows("tamasha", [competitor]), []);
  assert.deepEqual(productRows("simosa", [{ total_reviews: 23 }]), [{ total_reviews: 23 }]);
  assert.equal(reportTabs("tamasha", "2026_09").tagged, "tamasha_tagged_reviews_2026_09");
  assert.equal(reportTabs("simosa", "2026_09").tagged, "simosa_tagged_reviews_2026_09");
});
