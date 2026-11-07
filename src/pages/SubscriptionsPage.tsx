import { DownOutlined } from "@ant-design/icons";
import { App, Button, Col, Dropdown, Row, Segmented, Space, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import { can } from "../api/client";
import { ResponsiveTable } from "../components/MobileCards";
import { PageHeader, StatTile } from "../components/viz";
import { useBulkExtend, useBulkTariff, useTariffs, useTenants } from "../hooks";
import { SERIES } from "../lib/chartTheme";
import { openTenant } from "../lib/nav";
import type { TenantRow } from "../types";

const DAY = 86_400_000;
const companies = (n: number) => {
  const d = n % 10;
  const h = n % 100;
  const w =
    d === 1 && h !== 11
      ? "компания"
      : d >= 2 && d <= 4 && (h < 12 || h > 14)
        ? "компании"
        : "компаний";
  return `${n} ${w}`;
};
const som = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} сом`;
const ruDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("ru-RU") : "—";

type Group =
  | "overdue"
  | "soon"
  | "trial_soon"
  | "trial_over"
  | "active"
  | "trial"
  | "blocked";

const GROUP_LABEL: Record<Group, string> = {
  overdue: "Просрочены",
  soon: "Истекают ≤7 дн.",
  trial_soon: "Триал ≤3 дн.",
  trial_over: "Триал истёк",
  active: "Оплачены",
  trial: "Триал",
  blocked: "Заморожены",
};

/** Порядок групп: сначала то, что требует действия. */
const ORDER: Group[] = [
  "overdue",
  "soon",
  "trial_soon",
  "trial_over",
  "active",
  "trial",
  "blocked",
];

const GROUP_COLOR: Record<Group, string> = {
  overdue: "red",
  trial_over: "red",
  soon: "orange",
  trial_soon: "orange",
  blocked: "default",
  trial: "blue",
  active: "green",
};

const groupOf = (t: TenantRow, now: number): Group => {
  if (t.status === "blocked") return "blocked";
  if (t.status === "trial") {
    if (t.trialDaysLeft <= 0) return "trial_over";
    if (t.trialDaysLeft <= 3) return "trial_soon";
    return "trial";
  }
  if (!t.paidUntil) return "active";
  const left = new Date(t.paidUntil).getTime() - now;
  if (left < 0) return "overdue";
  if (left <= 7 * DAY) return "soon";
  return "active";
};

const daysText = (iso: string | null, now: number) => {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso).getTime() - now) / DAY);
  if (d < 0) return { text: `просрочено ${-d} дн.`, bad: true };
  if (d === 0) return { text: "сегодня", bad: true };
  return { text: `через ${d} дн.`, bad: d <= 7 };
};

/**
 * «Подписки» — все подписки компаний по срокам: что просрочено, что скоро
 * истекает, у кого заканчивается триал. В строке — отметить оплату на
 * 1/3/6/12 мес. и сменить тариф, не заходя в карточку.
 */
export const SubscriptionsPage = () => {
  const { message, modal } = App.useApp();
  const { data: tenants, isLoading } = useTenants({});
  const { data: tariffs } = useTariffs();
  const extend = useBulkExtend();
  const setTariff = useBulkTariff();
  const [group, setGroup] = useState<Group | "all">("all");
  const [now] = useState(() => Date.now());
  const canPay = can("billing.edit");
  const canTariff = can("tenants.tariff");

  const live = useMemo(
    () => (tenants ?? []).filter((t) => t.status !== "deleted" && !t.isTest),
    [tenants],
  );
  const groups = useMemo(() => {
    const m = new Map<Group, TenantRow[]>();
    for (const t of live) {
      const g = groupOf(t, now);
      m.set(g, [...(m.get(g) ?? []), t]);
    }
    return m;
  }, [live, now]);
  const rows = useMemo(
    () =>
      group === "all"
        ? ORDER.flatMap((g) => groups.get(g) ?? [])
        : (groups.get(group) ?? []),
    [groups, group],
  );

  const count = (g: Group) => groups.get(g)?.length ?? 0;
  const sumMrr = (list: TenantRow[]) =>
    list.reduce((a, t) => a + Number(t.mrr ?? 0), 0);
  const paying = live.filter((t) => t.status === "active");
  const due30 = paying.filter((t) => {
    if (!t.paidUntil) return false;
    const left = new Date(t.paidUntil).getTime() - now;
    return left >= 0 && left <= 30 * DAY;
  });
  const overdue = groups.get("overdue") ?? [];

  const doExtend = (t: TenantRow, months: number) =>
    modal.confirm({
      title: `Отметить оплату «${t.name}» за ${months} мес.?`,
      content:
        "Запишется оплата по тарифу компании (со скидкой за период), «оплачено до» продлится, статус станет «Активна». Отменить платёж можно в карточке компании → Биллинг.",
      okText: "Отметить оплату",
      cancelText: "Отмена",
      onOk: () =>
        extend.mutateAsync({ ids: [t.id], periodMonths: months }).then(
          (r) =>
            r.extended
              ? void message.success(`Продлено на ${months} мес.`)
              : void message.error("Не удалось продлить"),
          () => void message.error("Не удалось продлить"),
        ),
    });

  const doTariff = (t: TenantRow, tariffId: string, name: string) =>
    modal.confirm({
      title: `Сменить тариф «${t.name}» на «${name}»?`,
      content: "Модули и лимиты компании сразу станут как у нового тарифа.",
      okText: "Сменить тариф",
      cancelText: "Отмена",
      onOk: () =>
        setTariff.mutateAsync({ ids: [t.id], tariffId }).then(
          () => void message.success("Тариф изменён"),
          () => void message.error("Не удалось сменить тариф"),
        ),
    });

  const columns: ColumnsType<TenantRow> = [
    {
      title: "Компания",
      width: 240,
      dataIndex: "name",
      render: (_v, t) => {
        const g = groupOf(t, now);
        return (
          <span>
            <a
              onClick={(e) => {
                e.stopPropagation();
                openTenant(t.id);
              }}
              style={{ fontWeight: 600 }}
            >
              {t.name}
            </a>
            <Tag style={{ marginLeft: 8 }} color={GROUP_COLOR[g]}>
              {GROUP_LABEL[g]}
            </Tag>
          </span>
        );
      },
    },
    {
      title: "Тариф",
      dataIndex: "tariffName",
      width: 120,
      render: (v: string | null) => v ?? "—",
    },
    {
      title: "В месяц",
      dataIndex: "mrr",
      width: 120,
      align: "right",
      render: (v: number | null, t) =>
        t.status === "active" && Number(v) > 0 ? som(Number(v)) : "—",
    },
    {
      title: "Действует до",
      key: "until",
      width: 240,
      render: (_v, t) => {
        const iso = t.status === "trial" ? t.trialEndsAt : t.paidUntil;
        const d = daysText(iso, now);
        return (
          <span>
            {ruDate(iso)}
            {d ? (
              <span
                style={{
                  marginLeft: 6,
                  whiteSpace: "nowrap",
                  fontSize: 12,
                  color: d.bad ? "var(--danger-text)" : "var(--text-3)",
                }}
              >
                {d.text}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 270,
      render: (_v, t) => (
        <Space size={6} wrap onClick={(e) => e.stopPropagation()}>
          <Dropdown
            trigger={["click"]}
            disabled={!canPay}
            menu={{
              items: [1, 3, 6, 12].map((m) => ({
                key: String(m),
                label: `на ${m} мес.`,
                onClick: () => doExtend(t, m),
              })),
            }}
          >
            <Button size="small" type="primary" ghost disabled={!canPay}>
              Отметить оплату <DownOutlined />
            </Button>
          </Dropdown>
          <Dropdown
            trigger={["click"]}
            disabled={!canTariff}
            menu={{
              items: (tariffs ?? [])
                .filter((tf) => !tf.archived && tf.id !== t.tariffId)
                .map((tf) => ({
                  key: tf.id,
                  label: `${tf.name} · ${Number(tf.price).toLocaleString("ru-RU")} сом`,
                  onClick: () => doTariff(t, tf.id, tf.name),
                })),
            }}
          >
            <Button size="small" disabled={!canTariff}>
              Тариф <DownOutlined />
            </Button>
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Подписки"
        subtitle="Все подписки по срокам: отметить оплату и сменить тариф прямо в списке"
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}>
          <StatTile
            label="Выручка в месяц"
            value={som(sumMrr(paying))}
            accent={SERIES.aqua}
            hint={`${paying.length} платящих`}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatTile
            label="К продлению за 30 дней"
            value={som(sumMrr(due30))}
            accent={SERIES.blue}
            hint={companies(due30.length)}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatTile
            label="Просрочено"
            value={som(sumMrr(overdue))}
            accent={SERIES.red}
            hint={companies(overdue.length)}
            tip="Нажмите — показать только просроченные"
            onClick={() => setGroup("overdue")}
            active={group === "overdue"}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatTile
            label="Триал заканчивается"
            value={count("trial_soon") + count("trial_over")}
            accent={SERIES.orange}
            hint="≤3 дн. или уже истёк"
            tip="Нажмите — показать"
            onClick={() => setGroup("trial_soon")}
            active={group === "trial_soon"}
          />
        </Col>
      </Row>

      <div style={{ marginBottom: 12 }}>
        <Segmented
          value={group}
          onChange={(v) => setGroup(v as Group | "all")}
          options={[
            { value: "all", label: `Все · ${live.length}` },
            ...ORDER.filter((g) => count(g) > 0).map((g) => ({
              value: g,
              label: `${GROUP_LABEL[g]} · ${count(g)}`,
            })),
          ]}
        />
      </div>

      <ResponsiveTable<TenantRow>
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        columns={columns}
        virtualList={{ x: 990 }}
        onRow={(t) => ({
          onClick: () => openTenant(t.id),
          style: { cursor: "pointer" },
        })}
        mobileEmptyText="В этой группе пусто"
      />
    </div>
  );
};
