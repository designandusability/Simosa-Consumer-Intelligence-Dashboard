"use client";

import { useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const colors = { berry: "#ab174b", pink: "#9a5a14", green: "#357e6d", red: "#ba596b", neutral: "#9a9993", amber: "#ae854f", grid: "#e8e4dd", ink: "#605d58" };

export function ChartCard({ title, description, children, className = "" }) {
  return <section className={`panel chart-card ${className}`}>
    <h3>{title}</h3>{description && <p className="muted">{description}</p>}
    {children}
  </section>;
}

export function Empty({ children = "No data is available for this period." }) {
  return <div className="empty-state">{children}</div>;
}

const axis = { axisLine: false, tickLine: false, tick: { fill: colors.ink, fontSize: 12 } };
const tooltip = { contentStyle: { borderRadius: 9, borderColor: colors.grid }, cursor: { fill: "#faf1e9" } };
const chartMargins = { top: 16, right: 18, bottom: 0, left: 0 };
const dateTick = (date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(date));
const shortMonth = (month) => month.split(" ").map((part, i) => i === 0 ? part.slice(0, 3) : part).join(" ");
function ChartOptions({ label, values, selected, onChange }) {
  return <div className="chart-options" role="group" aria-label={label}>
    {values.map(([key, text]) => <button key={key} type="button" aria-pressed={selected === key}
      onClick={() => onChange(key)}>{text}</button>)}
  </div>;
}

export function RatingChart({ rows }) {
  const [days, setDays] = useState(0);
  const latest = Date.parse(rows.at(-1)?.date);
  const visible = days ? rows.filter(row => Date.parse(row.date) > latest - days * 86400000) : rows;
  return <>
    <ChartOptions label="Daily rating window ending on the latest observation" values={[[0, "Full month"], [14, "Last 14 days"], [7, "Last 7 days"]]} selected={days} onChange={setDays} />
    {!visible.some(row => row.rating != null) ? <Empty /> : <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
    <AreaChart data={visible} margin={chartMargins}>
      <defs><linearGradient id="rating-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f16b62" stopOpacity=".38" /><stop offset="100%" stopColor="#f16b62" stopOpacity=".04" /></linearGradient></defs>
      <CartesianGrid vertical={false} stroke={colors.grid} />
      <XAxis dataKey="date" tickFormatter={dateTick} minTickGap={25} {...axis} />
      <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} width={33} {...axis} />
      <Tooltip labelFormatter={dateTick} {...tooltip} />
      <Area type="monotone" dataKey="rating" name="Average rating" stroke={colors.berry} strokeWidth={2} fill="url(#rating-fill)" dot={{ r: 2, fill: colors.berry }} />
    </AreaChart>
  </ResponsiveContainer></div>}</>;
}

export function SentimentChart({ metrics }) {
  const rows = [
    { name: "Positive", value: metrics.positive, fill: colors.green },
    { name: "Neutral", value: metrics.neutral, fill: colors.neutral },
    { name: "Negative", value: metrics.negative, fill: colors.red },
  ];
  if (!rows.some((row) => row.value > 0)) return <Empty />;
  return <ul className="rank-list sentiment-list">{rows.map(({ name, value, fill }) => <li key={name}>
    <div className="rank-label"><span>{name}</span><strong>{value == null ? "—" : value.toFixed(1) + "%"}</strong></div>
    <div className="bar-track" aria-hidden="true"><i style={{ width: (value ?? 0) + "%", background: fill }} /></div>
  </li>)}</ul>;
}

export function WeeklyChart({ rows }) {
  const [metric, setMetric] = useState("reviews");
  const volume = metric === "reviews";
  return <>
    <ChartOptions label="Weekly measure" values={[["reviews", "Review count"], ["sentiment", "Sentiment score"]]} selected={metric} onChange={setMetric} />
    {!rows.some(row => row[metric] != null) ? <Empty /> : <div className="chart-box chart-short">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={chartMargins}>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis dataKey="week" minTickGap={14} {...axis} />
          <YAxis key={metric} allowDecimals={!volume} domain={volume ? [0, "auto"] : [-1, 1]} width={40} {...axis} />
          <Tooltip {...tooltip} />
          {volume ? <Bar dataKey="reviews" name="Reviews" fill={colors.berry} radius={[4, 4, 0, 0]} maxBarSize={40} />
            : <Line dataKey="sentiment" name="Average sentiment" stroke={colors.green} strokeWidth={2} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>}
  </>;
}

export function VolumeChart({ rows, name = "Reviews" }) {
  if (!rows.some((row) => row.value !== null)) return <Empty />;
  return <div className="chart-box chart-short"><ResponsiveContainer width="100%" height="100%">
    <BarChart data={rows} margin={chartMargins}>
      <CartesianGrid vertical={false} stroke={colors.grid} />
      <XAxis dataKey="label" {...axis} /><YAxis allowDecimals={false} width={44} {...axis} />
      <Tooltip {...tooltip} />
      <Bar dataKey="value" name={name} fill={colors.berry} radius={[5, 5, 0, 0]} maxBarSize={52} />
    </BarChart>
  </ResponsiveContainer></div>;
}

export function TrendChart({ rows, stars = false }) {
  const palette = [colors.red, "#b77d69", colors.amber, colors.berry, colors.green];
  const data = stars
    ? rows.filter((row) => row.stars.every((value) => value != null))
      .map((row) => ({ ...row, ...Object.fromEntries(row.stars.map((value, i) => [`star${i + 1}`, value])) }))
    : rows;
  if (!data.length || (!stars && data.length < 2)) {
    return <Empty>{stars ? "No complete monthly star distributions are available." : "At least two reporting months are needed to show a trend."}</Empty>;
  }
  return <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
    <ComposedChart data={data} margin={chartMargins}>
      <CartesianGrid vertical={false} stroke={colors.grid} />
      <XAxis dataKey="month" tickFormatter={shortMonth} {...axis} /><YAxis allowDecimals={false} {...axis} />
      {stars ? <Tooltip content={<StarTrendTooltip />} /> : <Tooltip {...tooltip} />}<Legend />
      {stars ? palette.map((fill, i) => <Bar key={i} dataKey={`star${i + 1}`} name={`${i + 1} stars`} fill={fill} radius={[3, 3, 0, 0]} maxBarSize={28} />) : <>
        <Bar dataKey="positives" name="Positive" fill={colors.green} radius={[4, 4, 0, 0]} maxBarSize={43} />
        <Bar dataKey="negatives" name="Negative" fill={colors.red} radius={[4, 4, 0, 0]} maxBarSize={43} />
        <Line type="monotone" dataKey="total" name="Total reviews" stroke={colors.berry} strokeWidth={3} />
      </>}
    </ComposedChart>
  </ResponsiveContainer></div>;
}

function StarTrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const { previous } = payload[0].payload;
  return <div className="chart-tooltip"><strong>{label}</strong><ul>
    {payload.map(({ name, value, dataKey, color }) => {
      const prior = previous?.stars[Number(dataKey.slice(-1)) - 1];
      const change = prior == null ? "Previous count unavailable"
        : prior === 0 && value !== 0 ? "Previous count was zero"
          : `${prior === 0 ? "0.0" : (((value - prior) / prior) * 100).toFixed(1)}% vs ${previous.month}`;
      return <li key={dataKey}><span style={{ color }}>{name}</span> · {Number(value).toLocaleString("en")} <small>{change}</small></li>;
    })}
  </ul></div>;
}

export function ThemeChart({ rows, movement = false, profile = false }) {
  const [scope, setScope] = useState("top");
  const [share, setShare] = useState("negativePct");
  const [direction, setDirection] = useState("all");
  const metric = movement ? "change" : profile ? share : "score";
  let ranked = [...rows];
  if (movement && direction !== "all") {
    ranked = ranked.filter(row => direction === "up" ? row.change > 0 : row.change < 0);
  }
  const magnitude = row => Math.abs(row[metric] ?? 0);
  ranked.sort((a, b) => magnitude(b) - magnitude(a));
  const scale = movement ? Math.max(1, ...ranked.map(magnitude)) : 100;
  const visible = scope === "top" ? ranked.slice(0, 5) : ranked;
  return <>
    <div className="chart-tools">
      {profile && <ChartOptions label="Theme sentiment share" values={[["negativePct", "Negative"], ["positivePct", "Positive"]]} selected={share} onChange={setShare} />}
      {movement && <ChartOptions label="Complaint direction" values={[["all", "All"], ["up", "Rising"], ["down", "Falling"]]} selected={direction} onChange={setDirection} />}
      {ranked.length > 5 && <ChartOptions label="Number of themes" values={[["top", "Top 5"], ["all", "All themes"]]} selected={scope} onChange={setScope} />}
    </div>
    {visible.length ? <ol className="rank-list">{visible.map(row => {
      const value = row[metric];
      const color = movement ? (value > 0 ? colors.red : colors.green) : profile ? (share === "negativePct" ? colors.red : colors.green) : colors.berry;
      const signed = movement && value > 0 ? "+" : "";
      return <li key={row.aspect}>
        <div className="rank-label"><span>{row.aspect}</span><strong>{value == null ? "—" : signed + value.toLocaleString("en", { maximumFractionDigits: 1 }) + (profile ? "%" : "")}</strong></div>
        <div className="bar-track" aria-hidden="true"><i style={{ width: Math.min(100, magnitude(row) / scale * 100) + "%", background: color }} /></div>
      </li>;
    })}</ol> : <Empty>No themes match this view.</Empty>}
  </>;
}
