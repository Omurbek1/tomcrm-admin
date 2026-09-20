import { Col, Empty, Row, Typography } from "antd";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAnalytics, useOverview } from "../hooks";
import {
  AXIS_INK,
  CATEGORICAL,
  monthLabel,
  num,
  SERIES,
  STATUS_COLOR,
  STATUS_LABEL,
} from "../lib/chartTheme";
import { ChartCard, StatTile, VizTooltip } from "../components/viz";

const { Title, Text } = Typography;

const axisProps = {
  stroke: "transparent",
  tick: { fill: AXIS_INK, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export const AnalyticsPage = () => {
  const { data: overview } = useOverview();
  const { data } = useAnalytics();

  // byStatus → данные для доната (только ненулевые, известный порядок).
  const statusData = Object.entries(overview?.byStatus ?? {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      key: k,
      name: STATUS_LABEL[k] ?? k,
      value: v,
      color: STATUS_COLOR[k] ?? "#94a3b8",
    }));
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
    mrrLabel: num(r.mrr),
  }));

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          Аналитика
        </Title>
        <Text type="secondary">Ключевые метрики платформы за последние 12 месяцев</Text>
      </div>

      {/* KPI-плитки */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} lg={4}>
          <StatTile
            label="MRR"
            value={num(overview?.mrr ?? 0)}
            suffix={overview?.mrrCurrency ?? "KGS"}
            accent={SERIES.aqua}
            hint="мес. регулярная выручка"
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatTile
            label="Активные + триал"
            value={num(overview?.total ?? 0)}
            accent={SERIES.blue}
            hint="живые компании"
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatTile
            label="Новые за месяц"
            value={num(overview?.newThisMonth ?? 0)}
            accent={SERIES.violet}
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatTile
            label="Конверсия"
            value={overview?.conversionRate == null ? "—" : overview.conversionRate}
            suffix={overview?.conversionRate == null ? "" : "%"}
            accent={SERIES.yellow}
            hint="триал → оплата"
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatTile
            label="Просрочка"
            value={num(overview?.overdue ?? 0)}
            accent={SERIES.orange}
            hint="оплата истекла"
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatTile
            label="Отток"
            value={num(overview?.churned ?? 0)}
            accent={SERIES.red}
            hint="блок / удалено"
          />
        </Col>
      </Row>

      {/* Подписки: состояния компаний и блокировки за сегодня */}
      {overview?.subscription ? (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} lg={4}>
            <StatTile
              label="PAST_DUE"
              value={num(overview.subscription.pastDueTenants)}
              accent={SERIES.orange}
              hint="просрочка, полный доступ"
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatTile
              label="SUSPENDED"
              value={num(
                overview.subscription.suspendedTenants +
                  overview.subscription.graceTenants,
              )}
              accent={SERIES.red}
              hint="CRM заблокирована / только чтение"
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatTile
              label="Реактивации"
              value={num(overview.subscription.today.paymentReactivations)}
              accent={SERIES.green}
              hint="оплата → доступ, сегодня"
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatTile
              label="402 запросов"
              value={num(overview.subscription.today.blockedApiRequests)}
              accent={SERIES.violet}
              hint="отказов API сегодня"
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatTile
              label="Исходящих заблок."
              value={num(overview.subscription.today.blockedOutboundMessages)}
              accent={SERIES.yellow}
              hint="сообщений/автоматизаций"
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatTile
              label="Входящих удержано"
              value={num(overview.subscription.today.heldInboundMessages)}
              accent={SERIES.blue}
              hint="сохранены, без AI/автоответа"
            />
          </Col>
        </Row>
      ) : null}

      {/* Графики */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <ChartCard
            title="Новые компании по месяцам"
            subtitle="динамика регистраций"
          >
            {growth.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={SERIES.blue} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={SERIES.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis {...axisProps} width={36} allowDecimals={false} />
                  <Tooltip
                    cursor={{ stroke: "#cbd5e1", strokeDasharray: 4 }}
                    content={<VizTooltip />}
                  />
                  <Area
                    type="monotone"
                    dataKey="Новые компании"
                    stroke={SERIES.blue}
                    strokeWidth={2}
                    fill="url(#gNew)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Нет данных" />
            )}
          </ChartCard>
        </Col>

        <Col xs={24} lg={10}>
          <ChartCard
            title="Компании по статусам"
            subtitle={`всего ${num(totalLive)}`}
            height={300}
          >
            {statusData.length ? (
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={86}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {statusData.map((s) => (
                      <Cell key={s.key} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<VizTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Нет данных" />
            )}
            {/* Легенда — статус нельзя кодировать только цветом */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px 16px",
                marginTop: 4,
                justifyContent: "center",
              }}
            >
              {statusData.map((s) => (
                <span
                  key={s.key}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                >
                  <span
                    style={{ width: 9, height: 9, borderRadius: 3, background: s.color }}
                  />
                  {s.name}: <b>{num(s.value)}</b>
                </span>
              ))}
            </div>
          </ChartCard>
        </Col>

        <Col xs={24} lg={14}>
          <ChartCard title="Собранная выручка по месяцам" subtitle="фактические оплаты">
            {revenue.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis {...axisProps} width={52} tickFormatter={(v) => num(v)} />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    content={<VizTooltip fmt={num} />}
                  />
                  <Bar dataKey="Выручка" fill={SERIES.orange} radius={[4, 4, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Нет данных" />
            )}
          </ChartCard>
        </Col>

        <Col xs={24} lg={10}>
          <ChartCard title="MRR по тарифам" subtitle="вклад тарифов в выручку">
            {byTariff.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={byTariff}
                  margin={{ top: 4, right: 44, left: 8, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    {...axisProps}
                    width={96}
                  />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    content={<VizTooltip fmt={num} />}
                  />
                  <Bar dataKey="MRR" radius={[0, 4, 4, 0]} maxBarSize={26}>
                    {byTariff.map((_, i) => (
                      <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
                    ))}
                    <LabelList
                      dataKey="mrrLabel"
                      position="right"
                      style={{ fill: AXIS_INK, fontSize: 11 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Нет данных" />
            )}
          </ChartCard>
        </Col>
      </Row>
    </div>
  );
};
