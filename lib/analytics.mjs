export const STARS = ["one_star", "two_star", "three_star", "four_star", "five_star"];
export const MONTH = /^\d{4}_(?:0[1-9]|1[0-2])$/;

export function number(value) {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
const count = (value) => number(value) ?? 0;
const text = (value) => String(value ?? "").trim();
const isOverall = (value) => text(value).toLowerCase() === "overall experience";

export function monthLabel(key) {
  if (!key || !MONTH.test(key)) return "";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(key.replace("_", "-") + "-01T00:00:00Z"));
}

export function reviewDate(value) {
  if (typeof value === "number") {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return Number.isFinite(date.valueOf()) ? date.toISOString().slice(0, 10) : null;
  }
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.valueOf()) ? date.toISOString().slice(0, 10) : null;
}

export function aspectsFrom(rows) {
  return rows.filter((r) => text(r.Aspect) && !isOverall(r.Aspect)).map((r) => ({
    aspect: text(r.Aspect), mentions: count(r.mentions), positive: count(r.Positive),
    neutral: count(r.Neutral), negative: count(r.Negative), unknown: count(r.Unknown),
    positivePct: number(r["pos_%"]), neutralPct: number(r["neu_%"]), negativePct: number(r["neg_%"]),
  }));
}

export function taggedReviews(rows) {
  return rows.map((r) => ({
    aspect: text(r.aspects), sentiment: text(r.sentiment), date: reviewDate(r.date),
    rating: number(r.rating), name: text(r.name), text: text(r.review_text),
  }));
}

export function actionableReviews(rows) {
  return rows.filter((row) => !isOverall(row.aspect));
}

function quantile(sorted, q) {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
}

export function prioritize(aspects) {
  if (!aspects.length) return [];
  const maximum = Math.max(1, ...aspects.map((row) => row.mentions));
  const rows = aspects.map((row) => {
    const negativeRate = row.mentions > 0 ? row.negative * 100 / row.mentions : 0;
    const score = (row.mentions * 100 / maximum) * .58 + negativeRate * .42;
    return { ...row, negativeRate, score };
  });
  const sorted = rows.map((row) => row.score).sort((a, b) => a - b);
  const p1 = quantile(sorted, .7);
  const p2 = quantile(sorted, .4);
  return rows.sort((a, b) => b.score - a.score || b.negative - a.negative)
    .map((row) => ({ ...row, priority: row.score >= p1 ? "P1" : row.score >= p2 ? "P2" : "P3" }));
}

export function issueMovement(current, previous) {
  if (!current.length || !previous.length) return [];
  const before = new Map(previous.map((row) => [row.aspect, row]));
  const after = new Map(current.map((row) => [row.aspect, row]));
  return [...new Set([...after.keys(), ...before.keys()])].map((aspect) => {
    const present = after.get(aspect);
    const past = before.get(aspect);
    const negative = present?.negative ?? 0;
    const baselineNegative = past?.negative ?? 0;
    return { aspect, negative, baselineNegative, change: negative - baselineNegative,
      rateChange: (present?.negativePct ?? 0) - (past?.negativePct ?? 0) };
  }).sort((a, b) => b.change - a.change);
}

export function overviewMetrics(row = {}, insight = {}) {
  const total = number(row.total_reviews);
  const rating = number(row.avg_rating);
  const positive = number(row.positive_pct);
  const negative = number(row.negative_pct);
  const neutral = number(row.neutral_pct);
  return {
    total, rating, positive, negative, neutral, coverage: number(insight.aspect_coverage_pct),
    health: Math.max(0, Math.min(100, .45 * count(positive) + .35 * count(rating) * 20 + .2 * (100 - count(negative)))),
    stars: STARS.map((key) => number(row[key])),
  };
}

function roundEven(value) {
  const lower = Math.floor(value);
  return value - lower === .5 ? lower + lower % 2 : Math.round(value);
}

export function trendMonth(month, row) {
  if (!row) return null;
  const { total, positive, negative, stars } = overviewMetrics(row);
  return { month: monthLabel(month), total: count(total),
    positives: roundEven(count(total) * count(positive) / 100),
    negatives: roundEven(count(total) * count(negative) / 100), stars };
}

export function reviewActivity(rows, month) {
  const unique = [...new Map(rows.map((row) => [JSON.stringify([row.name, row.text, row.date]), row])).values()];
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5));
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const hasDates = rows.some((row) => row.date);
  const windows = rows.length && hasDates ? [1, 6, 11, 16, 21, 26].map((start) => {
    const end = start === 26 ? days : start + 4;
    return { period: `${start}–${end}`,
      reviews: unique.filter((row) => {
        const day = Number(row.date?.slice(8, 10));
        return day >= start && day <= end;
      }).length };
  }) : [];
  return { unique: unique.length, windows };
}

export function filterReviews(rows, { aspects = [], sentiments = [], min = 1, max = 5 }) {
  const active = actionableReviews(rows);
  const ratingAvailable = rows.some((row) => row.rating != null);
  const matched = active.filter((row) =>
    (!aspects.length || aspects.includes(row.aspect)) &&
    (!sentiments.length || sentiments.includes(row.sentiment)) &&
    (!ratingAvailable || (row.rating !== null && row.rating >= min && row.rating <= max)))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return {
    total: matched.length, rows: matched.slice(0, 300).map((row) => ({
      ...row, name: row.name.slice(0, 240), text: row.text.slice(0, 2000),
    })),
    aspects: [...new Set(active.map((row) => row.aspect).filter(Boolean))].sort(),
    sentiments: [...new Set(rows.map((row) => row.sentiment).filter(Boolean))].sort(),
  };
}

export function executiveEvidence(rows) {
  const seen = new Set();
  const groups = new Map();
  for (const row of actionableReviews(rows)) {
    if (!row.text) continue;
    const key = JSON.stringify([row.aspect, row.text]);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!groups.has(row.aspect)) groups.set(row.aspect, []);
    groups.get(row.aspect).push(row);
  }
  return [...groups.values()].flatMap((group) => {
    const selected = [["Negative", 12], ["Positive", 8], ["Neutral", 3]]
      .flatMap(([sentiment, limit]) => group.filter((row) => row.sentiment === sentiment).slice(0, limit));
    return selected.length ? selected : group.slice(0, 15);
  }).slice(0, 230).map(({ aspect, sentiment, rating, text }) => ({ aspect, sentiment, rating, text: text.slice(0, 800) }));
}
