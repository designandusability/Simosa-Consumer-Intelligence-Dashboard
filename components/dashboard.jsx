"use client";

import { useEffect, useState } from "react";
import { Activity, BarChart3, CalendarDays, Layers3, LogOut, MessageSquareText, RefreshCw, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Markdown from "react-markdown";
import { ChartCard, Empty, RatingChart, SentimentChart, ThemeChart, TrendChart, VolumeChart, WeeklyChart } from "./charts";

const tabs = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "intelligence", label: "Product intelligence", icon: Layers3 },
  { id: "reviews", label: "Review explorer", icon: MessageSquareText },
];
const metricLabels = [
  ["total", "Total reviews", null], ["rating", "Average rating", "/5"],
  ["positive", "Positive sentiment", "%"], ["negative", "Negative sentiment", "%"],
  ["coverage", "Aspect coverage", "%"], ["health", "Product health", "/100"],
];
const int = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function show(value, unit) {
  if (value == null) return "—";
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "/5") return value.toFixed(2);
  return int.format(value);
}

function useJson(url) {
  const [state, setState] = useState({ url: "", data: null, error: "", status: 0 });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!controller.signal.aborted) setState({
        url, data: response.ok ? data : null, error: data.error ?? "", status: response.status,
      });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ url, data: null, error: "The dashboard could not load. Try again.", status: 500 });
    });
    return () => controller.abort();
  }, [url]);
  return state.url === url ? state : { data: null, error: "", status: 0 };
}

function Summary({ kind, month, baseline, aspect }) {
  const [summary, setSummary] = useState("");
  const [sampleSize, setSampleSize] = useState(0);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  async function generate() {
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/summary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, month, baseline, aspect }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSummary(result.summary);
      setSampleSize(result.sampleSize);
    } catch (error) {
      setError(error.message || "The summary could not be generated.");
    } finally {
      setWorking(false);
    }
  }
  return <section className="panel summary-card">
    <div><div className="small-icon"><Sparkles size={18} /></div><h3>{kind === "executive" ? "Executive summary" : `${aspect} summary`}</h3>
      <p className="muted">Generate a Gemini summary from a sample of tagged reviews.</p></div>
    <button type="button" className="button secondary" onClick={generate} disabled={working}>
      <Sparkles size={16} />{working ? "Generating…" : summary ? "Generate again" : "Generate summary"}
    </button>
    {error && <p className="notice full" role="alert">{error}</p>}
    {summary && <div className="summary-result full"><Markdown allowedElements={["ul", "ol", "li", "p", "strong", "em"]} unwrapDisallowed>{summary}</Markdown><p className="muted sample">{int.format(sampleSize)} sampled reviews</p></div>}
  </section>;
}

function Metrics({ data }) {
  return <div className="metric-grid">
    {metricLabels.map(([key, label, unit]) => {
      const value = data.metrics[key];
      const previous = data.comparison?.[key];
      const delta = value != null && previous != null && ["total", "rating", "positive", "negative"].includes(key) ? value - previous : null;
      const favorable = key === "negative" ? delta < 0 : delta > 0;
      return <article className="panel metric-card" key={key}>
        <p>{label}</p>
        <strong>{show(value, unit)}{value != null && unit?.startsWith("/") && <small>{unit}</small>}</strong>
        {delta != null && <span className={`metric-delta ${delta === 0 ? "" : favorable ? "good" : "bad"}`}>
          {delta > 0 ? <TrendingUp size={13} /> : delta < 0 ? <TrendingDown size={13} /> : null}
          {delta > 0 ? "+" : ""}{key === "rating" ? delta.toFixed(2) : unit === "%" ? `${delta.toFixed(1)} pp` : int.format(delta)}
        </span>}
      </article>;
    })}
  </div>;
}

function Overview({ data }) {
  const strongest = [...data.priority].sort((a, b) => (b.positivePct ?? 0) - (a.positivePct ?? 0))[0];
  const worsening = data.movement.find((row) => row.change > 0);
  const signals = [
    ["Primary risk", data.priority[0]?.aspect ?? "No actionable risk detected", "Highest combined complaint volume and negative intensity."],
    ["Strongest positive theme", strongest?.aspect ?? "No positive theme detected", "Actionable theme with the highest positive share."],
    ["Fastest worsening signal", worsening?.aspect ?? (data.baseline ? "No worsening theme detected" : "Enable a comparison"), "Change in negative mentions versus the comparison month."],
  ];
  return <div className="tab-content">
    <Metrics data={data} />
    <div className="signal-grid">{signals.map(([title, value, detail]) => <article key={title} className="panel signal-card">
      <p className="eyebrow">{title}</p><h3>{value}</h3><p className="muted">{detail}</p>
    </article>)}</div>
    <div className="grid-charts overview-charts">
      <ChartCard title="Rating trajectory" description="Average rating across daily observations."><RatingChart rows={data.daily} /></ChartCard>
      <ChartCard title="Sentiment mix" description="Share of reviews by sentiment."><SentimentChart metrics={data.metrics} /></ChartCard>
    </div>
    <ChartCard title="Weekly sentiment pulse" description="Review volume and average sentiment by reporting week."><WeeklyChart rows={data.weekly} /></ChartCard>
    <div className="grid-charts">
      <ChartCard title="Star rating distribution" description="Review volumes by star rating."><VolumeChart rows={data.metrics.stars.map((value, i) => ({ label: `${i + 1}★`, value }))} /></ChartCard>
      <ChartCard title="Review activity windows" description="Unique tagged reviews by days of the month."><VolumeChart rows={data.activity.map((row) => ({ label: row.period, value: row.reviews }))} /></ChartCard>
    </div>
  </div>;
}

function Intelligence({ data }) {
  const mostDiscussed = [...data.priority].sort((a, b) => b.mentions - a.mentions)[0];
  return <div className="tab-content">
    <div className="signal-grid">
      <article className="panel signal-card"><p className="eyebrow">Actionable themes</p><h3>{int.format(data.priority.length)}</h3><p className="muted">{int.format(data.coverage.tagged)} unique tagged reviews</p></article>
      <article className="panel signal-card"><p className="eyebrow">Most discussed</p><h3>{mostDiscussed?.aspect ?? "—"}</h3><p className="muted">Highest actionable mention volume</p></article>
      <article className="panel signal-card"><p className="eyebrow">Highest risk</p><h3>{data.priority[0]?.aspect ?? "—"}</h3><p className="muted">Highest customer pain index</p></article>
    </div>
    <div className="grid-charts">
      <ChartCard title="Monthly review trends" description="Latest three available reporting months through the selected month."><TrendChart rows={data.trends} /></ChartCard>
      <ChartCard title="Monthly rating composition" description="Months with complete counts for all five ratings."><TrendChart rows={data.trends} stars /></ChartCard>
    </div>
    <div className="grid-charts">
      <ChartCard title="Customer pain index" description="Combines normalized mention volume and negative rate."><ThemeChart rows={data.priority} /></ChartCard>
      <ChartCard title="Theme sentiment profile" description="Positive and negative shares by actionable theme."><ThemeChart rows={[...data.priority].sort((a, b) => b.mentions - a.mentions)} profile /></ChartCard>
    </div>
    {!!data.priority.length && <section className="panel table-panel"><h3>Theme priorities</h3><div className="table-scroll"><table>
      <thead><tr><th>Theme</th><th>Priority</th><th>Mentions</th><th>Negative</th><th>Negative rate</th><th>Pain index</th></tr></thead>
      <tbody>{data.priority.map((row) => <tr key={row.aspect}><td>{row.aspect}</td><td><span className={`pill ${row.priority.toLowerCase()}`}>{row.priority}</span></td>
        <td>{int.format(row.mentions)}</td><td>{int.format(row.negative)}</td><td>{show(row.negativeRate, "%")}</td><td>{row.score.toFixed(1)}</td></tr>)}</tbody>
    </table></div></section>}
    <ChartCard title="Issue movement" description={data.baseline ? `${data.label} compared with ${data.baselineLabel}.` : "Select a comparison month to measure changes in negative mentions."}>
      {data.baseline ? <ThemeChart rows={data.movement} movement /> : <Empty>Comparison is off or an earlier month is unavailable.</Empty>}
      {!!data.movement.length && <div className="table-scroll"><table><thead><tr><th>Theme</th><th>Current negative</th><th>Comparison negative</th><th>Change</th><th>Rate change</th></tr></thead>
        <tbody>{data.movement.map((row) => <tr key={row.aspect}><td>{row.aspect}</td><td>{row.negative}</td><td>{row.baselineNegative}</td><td>{row.change > 0 ? "+" : ""}{row.change}</td><td>{row.rateChange.toFixed(1)} pp</td></tr>)}</tbody>
      </table></div>}
    </ChartCard>
    <Summary key={`${data.month}-${data.baseline}`} kind="executive" month={data.month} baseline={data.baseline} />
  </div>;
}

function MultiFilter({ title, values, choices, update }) {
  return <details className="multi-filter">
    <summary>{title} <span>{values.length ? `${values.length} selected` : "All"}</span></summary>
    <div className="filter-options">{choices.length ? choices.map((item) => <label key={item}>
      <input type="checkbox" checked={values.includes(item)}
        onChange={(event) => update(event.target.checked ? [...values, item] : values.filter((value) => value !== item))} />
      {item}
    </label>) : <span className="muted">No options available</span>}</div>
  </details>;
}

function Reviews({ data, refresh }) {
  const [aspects, setAspects] = useState([]);
  const [sentiments, setSentiments] = useState([]);
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(5);
  const query = new URLSearchParams({ month: data.month, min, max, refresh });
  aspects.forEach((item) => query.append("aspect", item));
  sentiments.forEach((item) => query.append("sentiment", item));
  const { data: reviews, error, status } = useJson(`/api/reviews?${query}`);
  const [facets, setFacets] = useState(null);
  useEffect(() => {
    if (reviews) setFacets({ aspects: reviews.aspects, sentiments: reviews.sentiments });
  }, [reviews]);

  return <div className="tab-content">
    <section className="panel table-panel">
      <h3>Review explorer</h3><p className="muted">Read the Google Play reviews behind the dashboard signals.</p>
      <div className="review-filters">
        <MultiFilter title="Aspect" choices={facets?.aspects ?? []} values={aspects} update={setAspects} />
        <MultiFilter title="Sentiment" choices={facets?.sentiments ?? []} values={sentiments} update={setSentiments} />
        <label>Minimum rating<select value={min} onChange={(event) => setMin(Number(event.target.value))}>
          {[1, 2, 3, 4, 5].filter((value) => value <= max).map((value) => <option key={value}>{value}</option>)}
        </select></label>
        <label>Maximum rating<select value={max} onChange={(event) => setMax(Number(event.target.value))}>
          {[1, 2, 3, 4, 5].filter((value) => value >= min).map((value) => <option key={value}>{value}</option>)}
        </select></label>
      </div>
      {error ? <p className="notice" role="alert">{error}{status === 401 && <> <a href="/auth/login">Sign in</a></>}</p>
        : !reviews ? <Empty>Loading matching reviews…</Empty> : !reviews.total ? <Empty>No reviews match these filters.</Empty> : <>
          <p className="match-count">Showing {int.format(reviews.rows.length)} of {int.format(reviews.total)} matched review records</p>
          <div className="table-scroll review-table"><table>
            <thead><tr><th>Date</th><th>User</th><th>Rating</th><th>Sentiment</th><th>Aspect</th><th>Review</th></tr></thead>
            <tbody>{reviews.rows.map((row, index) => <tr key={index}>
              <td>{row.date ? dateFormat.format(new Date(row.date)) : "—"}</td><td>{row.name || "—"}</td>
              <td>{row.rating == null ? "—" : `${row.rating}★`}</td><td><span className={`pill ${row.sentiment.toLowerCase()}`}>{row.sentiment || "—"}</span></td>
              <td>{row.aspect || "—"}</td><td>{row.text}</td>
            </tr>)}</tbody>
          </table></div>
        </>}
    </section>
    {aspects.length === 1 && <Summary key={`${data.month}-${aspects[0]}`} kind="aspect" month={data.month} aspect={aspects[0]} />}
    <div className="signal-grid">
      <article className="panel signal-card"><p className="eyebrow">Tagged reviews</p><h3>{int.format(data.coverage.tagged)}</h3><p className="muted">Unique reviews carrying at least one detected theme.</p></article>
      <article className="panel signal-card"><p className="eyebrow">Untagged reviews</p><h3>{int.format(data.coverage.untagged)}</h3><p className="muted">Reviews that did not match the aspect dictionary.</p></article>
      <article className="panel signal-card"><p className="eyebrow">Detected-theme rate</p><h3>{show(data.coverage.detectedRate, "%")}</h3><p className="muted">Share of monthly reviews with a detected aspect.</p></article>
    </div>
  </div>;
}

export default function Dashboard() {
  const [tab, setTab] = useState("overview");
  const [month, setMonth] = useState("");
  const [mode, setMode] = useState("previous");
  const [baseline, setBaseline] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [months, setMonths] = useState([]);
  const [initialMonth, setInitialMonth] = useState("");
  const [initialLabel, setInitialLabel] = useState("");
  const query = new URLSearchParams({ compare: mode, refresh });
  if (month) query.set("month", month);
  if (baseline) query.set("baseline", baseline);
  const { data, error, status } = useJson(`/api/dashboard?${query}`);
  useEffect(() => {
    if (data) {
      setMonths(data.months);
      setInitialMonth(data.month);
      setInitialLabel(data.label);
    }
  }, [data]);
  const current = month || data?.month || initialMonth;
  const monthIndex = months.findIndex(({ key }) => key === current);
  const older = monthIndex >= 0 ? months.slice(monthIndex + 1) : [];
  function changeMonth(key) {
    setMonth(key);
    const earlier = months[months.findIndex((item) => item.key === key) + 1];
    setBaseline(mode === "custom" ? earlier?.key ?? "" : "");
  }

  return <div className="dashboard">
    <header className="topbar"><div className="topbar-inner">
      <div className="brand"><span className="brand-icon"><Activity size={21} /></span><div><strong>SIMOSA</strong><span>Consumer intelligence</span></div></div>
      <a className="button ghost" href="/auth/logout"><LogOut size={16} /> Sign out</a>
    </div></header>
    <main className="workspace">
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">Google Play review intelligence</p><h1>SIMOSA Product Intelligence</h1><p>Track sentiment, uncover recurring friction, and explore the reviews behind the numbers.</p></div>
        <div className="hero-period"><CalendarDays size={18} /><span>{data?.label || months.find((item) => item.key === current)?.label || initialLabel || "Reporting period"}</span></div>
      </section>
      <div className="control-bar">
        <label>Reporting month<select value={current} onChange={(event) => changeMonth(event.target.value)} disabled={!months.length}>
          {!months.length && <option value="">Loading months…</option>}
          {months.map(({ key, label }) => <option value={key} key={key}>{label}</option>)}
        </select></label>
        <label>Comparison<select value={mode} onChange={(event) => {
          const value = event.target.value;
          setMode(value);
          setBaseline(value === "custom" ? older[0]?.key ?? "" : "");
        }}>
          <option value="previous">Previous month</option><option value="custom">Choose a month</option><option value="none">No comparison</option>
        </select></label>
        {mode === "custom" && <label>Comparison month<select aria-label="Comparison month" value={baseline} disabled={!older.length}
          onChange={(event) => setBaseline(event.target.value)}>
          {!older.length && <option value="">No earlier months</option>}
          {older.map(({ key, label }) => <option value={key} key={key}>{label}</option>)}
        </select></label>}
        <button className="button secondary refresh" type="button" onClick={() => setRefresh(refresh + 1)}><RefreshCw size={16} /> Refresh</button>
      </div>
      <nav className="tabs" aria-label="Dashboard views">{tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id}
        aria-current={tab === id ? "page" : undefined} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}</nav>
      {error ? <p className="notice" role="alert">{error}{status === 401 && <> <a href="/auth/login">Sign in again</a></>}</p>
        : !data ? <div role="status" className="panel loading"><RefreshCw size={18} /> Loading review intelligence…</div>
          : tab === "overview" ? <Overview data={data} />
            : tab === "intelligence" ? <Intelligence data={data} />
              : <Reviews key={data.month} data={data} refresh={refresh} />}
      <footer>SIMOSA Consumer Intelligence <span>Google Play reviews</span></footer>
    </main>
  </div>;
}
