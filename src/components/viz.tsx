import type { ReactNode } from "react";

import { TEXT_MUTED } from "../lib/chartTheme";

const CARD: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #eef1f5",
  borderRadius: 12,
  padding: "16px 18px",
};

/** Минималистичная KPI-плитка: цветная точка-акцент + число + подпись. */
export const StatTile = ({
  label,
  value,
  suffix,
  accent = "#2a78d6",
  hint,
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  accent?: string;
  hint?: string;
}) => (
  <div style={CARD}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{ width: 8, height: 8, borderRadius: 8, background: accent }}
      />
      <span style={{ fontSize: 12, color: TEXT_MUTED }}>{label}</span>
    </div>
    <div
      style={{ fontSize: 26, fontWeight: 600, marginTop: 6, lineHeight: 1.1 }}
    >
      {value}
      {suffix && (
        <span style={{ fontSize: 14, color: TEXT_MUTED, marginLeft: 4 }}>
          {suffix}
        </span>
      )}
    </div>
    {hint && (
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{hint}</div>
    )}
  </div>
);

/** Карточка графика: заголовок + подзаголовок + фиксированная высота под чарт. */
export const ChartCard = ({
  title,
  subtitle,
  extra,
  height = 260,
  children,
}: {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  height?: number;
  children: ReactNode;
}) => (
  <div style={{ ...CARD, height: "100%" }}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{subtitle}</div>
        )}
      </div>
      {extra}
    </div>
    <div style={{ height }}>{children}</div>
  </div>
);

/** Тёмный минималистичный тултип (recharts content). */
export const VizTooltip = ({
  active,
  payload,
  label,
  fmt,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  fmt?: (v: number) => string;
}) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: "#0b0b0b",
        color: "#fff",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12,
        boxShadow: "0 6px 20px rgba(0,0,0,.20)",
      }}
    >
      {label != null && (
        <div style={{ opacity: 0.65, marginBottom: 4 }}>{label}</div>
      )}
      {payload.map((p, i) => (
        <div
          key={i}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 8,
              background: p.color,
            }}
          />
          <span>
            {p.name}:{" "}
            <b>{fmt ? fmt(Number(p.value)) : p.value}</b>
          </span>
        </div>
      ))}
    </div>
  );
};
