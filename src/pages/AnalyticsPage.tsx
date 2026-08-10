import { Card, Col, Empty, Row, Statistic } from "antd";

import { useAnalytics, useOverview } from "../hooks";

const money = (n: number) => n.toLocaleString("ru-RU");

/** Простой горизонтальный бар без внешних chart-библиотек. */
const Bars = ({
  data,
  color = "#4f46e5",
  fmt = (v: number) => String(v),
}: {
  data: Array<{ label: string; value: number }>;
  color?: string;
  fmt?: (v: number) => string;
}) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <Empty description="Нет данных" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 90, fontSize: 12, color: "#64748b" }}>
            {d.label}
          </div>
          <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 6 }}>
            <div
              style={{
                width: `${(d.value / max) * 100}%`,
                minWidth: d.value > 0 ? 4 : 0,
                height: 18,
                background: color,
                borderRadius: 6,
              }}
            />
          </div>
          <div style={{ width: 80, textAlign: "right", fontSize: 12 }}>
            {fmt(d.value)}
          </div>
        </div>
      ))}
    </div>
  );
};

export const AnalyticsPage = () => {
  const { data: overview } = useOverview();
  const { data } = useAnalytics();

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="MRR (мес. выручка)"
              value={overview?.mrr ?? 0}
              formatter={(v) => money(Number(v))}
              suffix={overview?.mrrCurrency ?? "KGS"}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Конверсия триал→оплата"
              value={
                overview?.conversionRate == null
                  ? "—"
                  : overview.conversionRate
              }
              suffix={overview?.conversionRate == null ? "" : "%"}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Отток (блок/удал.)"
              value={overview?.churned ?? 0}
              styles={{ content: { color: "#ef4444" } }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="MRR по тарифам">
            <Bars
              data={(data?.mrrByTariff ?? []).map((r) => ({
                label: `${r.name} (${r.count})`,
                value: r.mrr,
              }))}
              fmt={money}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Новые компании по месяцам">
            <Bars
              color="#0ea5e9"
              data={(data?.monthlyNew ?? []).map((r) => ({
                label: r.month,
                value: r.count,
              }))}
            />
          </Card>
        </Col>
        <Col span={24}>
          <Card title="Оплаты по месяцам (собранная выручка)">
            <Bars
              color="#22c55e"
              data={(data?.monthlyRevenue ?? []).map((r) => ({
                label: r.month,
                value: r.revenue,
              }))}
              fmt={money}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
