"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line,
  Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const colors = { purple: "#7052c5", pink: "#c46e93", green: "#357e6d", red: "#ba596b", neutral: "#a4aabd", amber: "#ae854f", grid: "#eceaf1", ink: "#656374" };

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
const tooltip = { contentStyle: { borderRadius: 9, borderColor: colors.grid }, cursor: { fill: "#f3f0fa" } };
const chartMargins = { top: 16, right: 18, bottom: 0, left: 0 };
const dateTick = (date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(date));
const shortMonth = (month) => month.split(" ").map((part, i) => i === 0 ? part.slice(0, 3) : part).join(" ");
const ellipsis = (label) => label.length > 26 ? label.slice(0, 24) + "…" : label;

export function RatingChart({ rows }) {
  if (!rows.some((row) => row.rating !== null)) return <Empty />;
  return <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
    <AreaChart data={rows} margin={chartMargins}>
      <defs><linearGradient id="rating-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#a991ef" stopOpacity=".38" /><stop offset="100%" stopColor="#a991ef" stopOpacity=".04" /></linearGradient></defs>
      <CartesianGrid vertical={false} stroke={colors.grid} />
      <XAxis dataKey="date" tickFormatter={dateTick} minTickGap={25} {...axis} />
      <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} width={33} {...axis} />
      <Tooltip labelFormatter={dateTick} {...tooltip} />
      <Area type="monotone" dataKey="rating" name="Average rating" stroke={colors.purple} strokeWidth={3} fill="url(#rating-fill)" dot={{ r: 3, fill: colors.purple }} />
    </AreaChart>
  </ResponsiveContainer></div>;
}

export function SentimentChart({ metrics }) {
  const rows = [
    { name: "Positive", value: metrics.positive, fill: colors.green },
    { name: "Neutral", value: metrics.neutral, fill: colors.neutral },
    { name: "Negative", value: metrics.negative, fill: colors.red },
  ];
  if (!rows.some((row) => row.value > 0)) return <Empty />;
  return <>
    <div className="chart-box donut"><ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius="61%" outerRadius="83%" paddingAngle={2} stroke="none">
          {rows.map((row) => <Cell key={row.name} fill={row.fill} />)}
        </Pie>
        <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} {...tooltip} />
      </PieChart>
    </ResponsiveContainer></div>
    <ul className="sentiment-key">{rows.map((row) => <li key={row.name}><i style={{ background: row.fill }} />{row.name}<strong>{row.value == null ? "—" : `${row.value.toFixed(1)}%`}</strong></li>)}</ul>
  </>;
}

export function WeeklyChart({ rows }) {
  if (!rows.length) return <Empty />;
  return <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
    <ComposedChart data={rows} margin={chartMargins}>
      <CartesianGrid vertical={false} stroke={colors.grid} />
      <XAxis dataKey="week" {...axis} />
      <YAxis yAxisId="volume" allowDecimals={false} {...axis} />
      <YAxis yAxisId="sentiment" orientation="right" domain={[-1, 1]} ticks={[-1, -.5, 0, .5, 1]} width={35} {...axis} />
      <Tooltip {...tooltip} /><Legend />
      <Bar yAxisId="volume" dataKey="reviews" name="Reviews" fill={colors.purple} radius={[5, 5, 0, 0]} maxBarSize={48} />
      <Line yAxisId="sentiment" type="monotone" dataKey="sentiment" name="Average sentiment" stroke={colors.pink} strokeWidth={2} />
    </ComposedChart>
  </ResponsiveContainer></div>;
}

export function VolumeChart({ rows, name = "Reviews" }) {
  if (!rows.some((row) => row.value !== null)) return <Empty />;
  return <div className="chart-box chart-short"><ResponsiveContainer width="100%" height="100%">
    <BarChart data={rows} margin={chartMargins}>
      <CartesianGrid vertical={false} stroke={colors.grid} />
      <XAxis dataKey="label" {...axis} /><YAxis allowDecimals={false} width={44} {...axis} />
      <Tooltip {...tooltip} />
      <Bar dataKey="value" name={name} fill={colors.purple} radius={[5, 5, 0, 0]} maxBarSize={52} />
    </BarChart>
  </ResponsiveContainer></div>;
}

export function TrendChart({ rows, stars = false }) {
  const palette = [colors.red, "#b77d69", colors.amber, colors.purple, colors.green];
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
        <Line type="monotone" dataKey="total" name="Total reviews" stroke={colors.purple} strokeWidth={3} />
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
  if (!rows.length) return <Empty />;
  return <div className="chart-box theme-chart" style={{ height: Math.max(236, rows.length * 37 + 42) }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart layout="vertical" data={rows} margin={{ top: 10, right: 20, bottom: 4, left: 2 }}>
        <CartesianGrid horizontal={false} stroke={colors.grid} />
        <XAxis type="number" domain={movement ? ["auto", "auto"] : [0, 100]} tickFormatter={profile ? (value) => `${value}%` : undefined} {...axis} />
        <YAxis type="category" dataKey="aspect" width={170} tickFormatter={ellipsis} {...axis} />
        <Tooltip {...tooltip} />
        {movement && <ReferenceLine x={0} stroke={colors.neutral} />}
        {movement ? <Bar dataKey="change" name="Change in negative mentions" maxBarSize={17}>
          {rows.map((row) => <Cell key={row.aspect} fill={row.change > 0 ? colors.red : colors.green} />)}
        </Bar> : profile ? <>
          <Legend />
          <Bar dataKey="negativePct" name="Negative share (%)" fill={colors.red} maxBarSize={12} />
          <Bar dataKey="positivePct" name="Positive share (%)" fill={colors.green} maxBarSize={12} />
        </> : <Bar dataKey="score" name="Pain index" fill={colors.purple} maxBarSize={17} radius={[0, 4, 4, 0]} />}
      </BarChart>
    </ResponsiveContainer>
  </div>;
}
