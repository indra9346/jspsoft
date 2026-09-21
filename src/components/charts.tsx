"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";

export const PALETTE = ["#3b82f6", "#f97316", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#eab308", "#f43f5e"];

const axis = { fontSize: 12, fill: "#6b6ea6" };
const tip = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid #e6e3f7",
    boxShadow: "0 10px 30px -10px rgba(124,58,237,.35)",
    color: "#403f86",
    fontSize: 12,
  },
};

export function BarsChart({
  data,
  xKey,
  series,
  height = 260,
  stacked,
  unit,
  max,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; label: string; color: string }[];
  height?: number;
  stacked?: boolean;
  unit?: string;
  max?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={4}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={1} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.55} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="#e6e3f7" vertical={false} />
          <XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} unit={unit} domain={max ? [0, max] : undefined} />
          <Tooltip {...tip} cursor={{ fill: "rgba(139,92,246,.08)" }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "#6b6ea6" }} />}
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={`url(#g-${s.key})`}
              radius={[8, 8, 0, 0]}
              stackId={stacked ? "a" : undefined}
              maxBarSize={38}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({
  data,
  xKey,
  yKey,
  label,
  color = "#8b5cf6",
  height = 240,
  unit,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  label: string;
  color?: string;
  height?: number;
  unit?: string;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="#e6e3f7" vertical={false} />
          <XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} unit={unit} domain={[0, 100]} />
          <Tooltip {...tip} />
          <Area type="monotone" dataKey={yKey} name={label} stroke={color} strokeWidth={3} fill="url(#trend)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({
  data,
  height = 240,
  centerLabel,
}: {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  centerLabel?: { value: string | number; caption: string };
}) {
  return (
    <div style={{ height }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%" paddingAngle={3} cornerRadius={6} stroke="none">
            {data.map((d, i) => (
              <Cell key={d.name} fill={d.color ?? PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip {...tip} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#6b6ea6" }} />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 -mt-4 flex flex-col items-center justify-center">
          <div className="text-2xl font-extrabold text-[color:var(--ink-strong)]">{centerLabel.value}</div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">
            {centerLabel.caption}
          </div>
        </div>
      )}
    </div>
  );
}
