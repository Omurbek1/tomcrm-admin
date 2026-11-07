import { Col, Empty, Row } from "antd";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAnalytics, useOverview } from "../hooks";
import {
  AXIS_INK,
  monthLabel,
  num,
  SERIES,
  STATUS_COLOR,
  STATUS_LABEL,
} from "../lib/chartTheme";
import { navigate } from "../lib/nav";
import { ChartCard, PageHeader, StatTile, VizTooltip } from "../components/viz";

const axisProps = {
  stroke: "transparent",
  tick: { fill: AXIS_INK, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;
const GRID = { vertical: false, stroke: "#eef1f5" } as const;

/** Полоса с подписью: читается без наведения и на телефоне. */
const Bars = ({
  rows,
}: {
  rows: Array<{
    key: string;
    name: string;
    value: number;
    max: number;
    text: string;
    note?: string;
    color: string;
    onClick?: () => void;
  }>;
}) => (
  <ul className="bars">
    {rows.map((r) => (
      <li key={r.key}>
        <button
          type="button"
          className="bars-row"
          onClick={r.onClick}
          disabled={!r.onClick}
        >
          <span className="bars-head">
            <span className="bars-name">{r.name}</span>
            <span className="bars-value">
              {r.text}
              {r.note ? <span className="bars-note">{r.note}</span> : null}
            </span>
          </span>
          <span className="bars-track">
            <span
              className="bars-fill"
              style={{
                width: `${Math.max((r.value / r.max) * 100, r.value > 0 ? 1.5 : 0)}%`,
                background: r.color,
              }}
            />
          </span>
        </button>
      </li>
    ))}
  </ul>
);

export const AnalyticsPage = () => {
  const { data: overview } = useOverview();
  const { data } = useAnalytics();

  // Статусы — полосами (только ненулевые), самая большая сверху.
  const statusData = Object.entries(overview?.byStatus ?? {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      key: k,
      name: STATUS_LABEL[k] ?? k,
      value: v,
      color: STATUS_COLOR[k] ?? "#94a3b8",
    }))
    .sort((a, b) => b.value - a.value);
  const statusMax = Math.max(1, ...statusData.map((s) => s.value));
  const statusSum = statusData.reduce((a, s) => a + s.value, 0) || 1;
  const totalLive = overview?.total ?? 0;

  const growth = (data?.monthlyNew ?? []).map((r) => ({
    month: monthLabel(r.month),
    "Новые компании": r.count,
  }));
  const revenue = (data?.monthlyRevenue ?? []).map((r) => ({
    month: monthLabel(r.month),
    Выручка: r.revenue,
  }));
  const byTariff = (data?.mrrByTariff ?? []).map((r) => ({
    name: r.name,
    MRR: r.mrr,
    count: r.count,
  }));
  const tariffMax = Math.max(1, ...byTariff.map((r) => r.MRR));
  const som = (v: number) => `${num(v)} сом`;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <PageHeader
        title="Аналитика"
        subtitle="Рост, деньги и отток платформы за 12 месяцев"
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} lg={4}>
          <StatTile
            label="Выручка в месяц (MRR)"
            value={num(overview?.mrr ?? 0)}
            suffix="сом"
            accent={SERIES.aqua}
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatTile
            label="Живых компаний"
            value={num(overview?.total ?? 0)}
            accent={SERIES.blue}
            hint="платят + триал"
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatTile
            label="Новых за месяц"
            value={num(overview?.newThisMonth ?? 0)}
            accent={SERIES.violet}
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatTile
            label="Триал → оплата"
            value={overview?.conversionRate == null ? "—" : overview.conversionRate}
            suffix={overview?.conversionRate == null ? "" : "%"}
            accent={SERIES.yellow}
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatTile
            label="Просрочили оплату"
            value={num(overview?.overdue ?? 0)}
            accent={SERIES.orange}
            onClick={() => navigate("tenants", { filter: "overdue" })}
            tip="Нажмите — список"
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatTile
            label="Ушли"
            value={num(overview?.churned ?? 0)}
            accent={SERIES.red}
            hint="заморожены или удалены"
          />
        </Col>
      </Row>

      {overview?.subscription ? (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} lg={4}>
            <StatTile
              label="Должники с доступом"
              value={num(overview.subscription.pastDueTenants)}
              accent={SERIES.orange}
              hint="льготный период"
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatTile
              label="Доступ ограничен"
              value={num(
                overview.subscription.suspendedTenants +
                  overview.subscription.graceTenants,
              )}
              accent={SERIES.red}
              hint="только чтение или блок"
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatTile
              label="Вернулись после оплаты"
              value={num(overview.subscription.today.paymentReactivations)}
              accent={SERIES.green}
              hint="сегодня"
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatTile
              label="Отказано в действиях"
              value={num(overview.subscription.today.blockedApiRequests)}
              accent={SERIES.violet}
              hint="из-за неоплаты, сегодня"
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatTile
              label="Не отправлено"
              value={num(overview.subscription.today.blockedOutboundMessages)}
              accent={SERIES.yellow}
              hint="сообщений и автоматизаций, сегодня"
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatTile
              label="Входящие сохранены"
              value={num(overview.subscription.today.heldInboundMessages)}
              accent={SERIES.blue}
              hint="без AI и автоответа, сегодня"
            />
          </Col>
        </Row>
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <ChartCard
            title="Новые компании по месяцам"
            subtitle="сколько зарегистрировалось за каждый месяц"
          >
            {growth.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={growth} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis {...axisProps} width={36} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} content={<VizTooltip />} />
                  <Bar
                    dataKey="Новые компании"
                    fill={SERIES.blue}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Нет данных" />
            )}
          </ChartCard>
        </Col>

        <Col xs={24} lg={10}>
          <ChartCard
            title="Компании по статусам"
            subtitle={`всего ${num(totalLive)} живых · нажмите — список`}
          >
            {statusData.length ? (
              <Bars
                rows={statusData.map((s) => ({
                  key: s.key,
                  name: s.name,
                  value: s.value,
                  max: statusMax,
                  text: num(s.value),
                  note: `${Math.round((s.value / statusSum) * 100)} %`,
                  color: s.color,
                  onClick: () =>
                    navigate(
                      "tenants",
                      s.key === "deleted"
                        ? { deleted: "1", status: "deleted" }
                        : { status: s.key },
                    ),
                }))}
              />
            ) : (
              <Empty description="Нет данных" />
            )}
          </ChartCard>
        </Col>

        <Col xs={24} lg={14}>
          <ChartCard
            title="Собранная выручка по месяцам"
            subtitle="фактически поступившие оплаты, сом"
          >
            {revenue.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis
                    {...axisProps}
                    width={64}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `${num(Math.round(v / 1000))} тыс` : num(v)
                    }
                  />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} content={<VizTooltip fmt={som} />} />
                  <Bar
                    dataKey="Выручка"
                    fill={SERIES.aqua}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={34}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Нет данных" />
            )}
          </ChartCard>
        </Col>

        <Col xs={24} lg={10}>
          <ChartCard
            title="Выручка в месяц по тарифам"
            subtitle="какой тариф приносит больше денег"
          >
            {byTariff.length ? (
              <Bars
                rows={[...byTariff]
                  .sort((a, b) => b.MRR - a.MRR)
                  .map((r) => ({
                    key: r.name,
                    name: r.name,
                    value: r.MRR,
                    max: tariffMax,
                    text: som(r.MRR),
                    note: `${num(r.count)} комп.`,
                    color: SERIES.blue,
                  }))}
              />
            ) : (
              <Empty description="Нет данных" />
            )}
          </ChartCard>
        </Col>
      </Row>
    </div>
  );
};
