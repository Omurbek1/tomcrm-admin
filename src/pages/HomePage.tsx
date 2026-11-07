import { CheckCircleFilled, RightOutlined } from "@ant-design/icons";
import { Button, Col, Row, Skeleton, Tag } from "antd";
import type { ReactNode } from "react";

import { PageHeader, StatTile } from "../components/viz";
import { useAttention } from "../lib/attention";
import { useSupportTickets } from "../hooks";
import { SERIES } from "../lib/chartTheme";
import { navigate, type View } from "../lib/nav";

const money = (n: number | null | undefined): string =>
  `${Math.round(Number(n || 0)).toLocaleString("ru-RU")} сом`;
const num = (n: number) => n.toLocaleString("ru-RU");
const items = (n: number) => {
  const d = n % 10;
  const h = n % 100;
  const w =
    d === 1 && h !== 11
      ? "пункт"
      : d >= 2 && d <= 4 && (h < 12 || h > 14)
        ? "пункта"
        : "пунктов";
  return `${n} ${w}`;
};

type Tone = "critical" | "warning" | "info";
type Task = {
  key: string;
  count: number;
  title: string;
  why: string;
  tone: Tone;
  action: string;
  go: () => void;
};

const TONE_COLOR: Record<Tone, string> = {
  critical: "#e34948",
  warning: "#c98500",
  info: "#2a78d6",
};

const ago = (iso?: string | null) => {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `${Math.max(m, 1)} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.round(h / 24)} дн. назад`;
};

const Section = ({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}) => (
  <section className="panel">
    <div className="panel-head">
      <h2 className="panel-title">{title}</h2>
      {extra}
    </div>
    {children}
  </section>
);

/**
 * «Обзор» — стартовый экран: сначала то, что требует действия (каждая
 * строка ведёт в нужный отфильтрованный список), потом главные цифры и
 * свежие обращения. Данные — те же запросы, что в разделах (общий кэш).
 */
export const HomePage = () => {
  const a = useAttention();
  // Лента свежих обращений — список нужен только здесь (меню берёт числа).
  const tickets = useSupportTickets("open");
  const o = a.overview.data;
  const tenants = (filter: string) => () => navigate("tenants", { filter });
  const to = (v: View) => () => navigate(v);

  const all: Task[] = [
    {
      key: "sig",
      count: a.badSignatures,
      title: "Вебхуки оплаты с неверной подписью",
      why: "За последний час. Возможна подделка или сменился ключ платёжки",
      tone: "critical",
      action: "Биллинг",
      go: to("billing"),
    },
    {
      key: "unverified",
      count: a.unverifiedCount,
      title: "Оплаты ждут ручного подтверждения",
      why: "Деньги пришли, но подпись не проверена — подписка не продлена",
      tone: "critical",
      action: "Проверить",
      go: to("billing"),
    },
    {
      key: "overdue",
      count: a.overdue,
      title: "Оплата просрочена",
      why: "Компании скоро потеряют доступ — напомните или продлите",
      tone: "critical",
      action: "Открыть список",
      go: tenants("overdue"),
    },
    {
      key: "support",
      count: a.supportOpen,
      title: "Новые обращения в поддержку",
      why: a.supportUrgent
        ? `Срочных: ${a.supportUrgent} — ответьте первыми`
        : "Ещё никто не взял в работу",
      tone: a.supportUrgent ? "critical" : "info",
      action: "Ответить",
      go: to("support"),
    },
    {
      key: "stuck",
      count: a.stuckCount,
      title: "Счета зависли в ожидании",
      why: "Клиент начал оплату, ответа от платёжки нет",
      tone: "warning",
      action: "Биллинг",
      go: to("billing"),
    },
    {
      key: "trial-soon",
      count: a.trialsExpiringSoon,
      title: "Триал заканчивается в ближайшие 3 дня",
      why: "Лучший момент позвонить и помочь с оплатой",
      tone: "warning",
      action: "Открыть список",
      go: tenants("trial_expiring"),
    },
    {
      key: "overage",
      count: a.overageCount,
      title: "Используют больше, чем оплатили",
      why: "Сотрудники, номера или опции сверх тарифа",
      tone: "warning",
      action: "Биллинг",
      go: to("billing"),
    },
    {
      key: "trial-expired",
      count: a.trialsExpired,
      title: "Триал истёк, оплаты нет",
      why: "Ещё можно вернуть — предложите продление",
      tone: "info",
      action: "Открыть список",
      go: tenants("trial_expired"),
    },
  ];
  const tasks = all.filter((t) => t.count > 0);

  const loading = a.overview.isLoading;
  const recentTickets = (tickets.data ?? []).slice(0, 5);
  const sub = o?.subscription;

  return (
    <div className="page">
      <PageHeader
        title="Обзор"
        subtitle="Что требует действия сейчас и главные цифры платформы"
      />

      <Section
        title="Нужно сделать"
        extra={
          tasks.length ? <span className="muted">{items(tasks.length)}</span> : null
        }
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 3 }} title={false} />
        ) : tasks.length ? (
          <ul className="tasks">
            {tasks.map((t) => (
              <li key={t.key}>
                <button type="button" className="task" onClick={t.go}>
                  <span className="task-count" style={{ color: TONE_COLOR[t.tone] }}>
                    {num(t.count)}
                  </span>
                  <span className="task-body">
                    <span className="task-title">{t.title}</span>
                    <span className="task-why">{t.why}</span>
                  </span>
                  <span className="task-action">
                    {t.action} <RightOutlined />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="all-clear">
            <CheckCircleFilled style={{ color: "#1baf7a", fontSize: 20 }} />
            Срочных дел нет: оплаты сходятся, обращения разобраны.
          </div>
        )}
      </Section>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}>
          <StatTile
            label="Выручка в месяц (MRR)"
            value={money(o?.mrr ?? 0)}
            accent={SERIES.aqua}
            tip="Месячные цены активных компаний с действующей оплатой (годовой ÷ 12), без тестовых. Нажмите — аналитика."
            onClick={to("analytics")}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatTile
            label="Живых компаний"
            value={num(o?.total ?? 0)}
            accent={SERIES.blue}
            hint={
              sub
                ? `${num(sub.activeTenants)} платят · ${num(sub.trialTenants)} в триале`
                : "активные + триал"
            }
            tip="Нажмите — список компаний."
            onClick={to("tenants")}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatTile
            label="Новых за месяц"
            value={num(o?.newThisMonth ?? 0)}
            accent={SERIES.violet}
            hint="с 1-го числа, без тестовых"
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatTile
            label="Триал → оплата"
            value={o?.conversionRate == null ? "—" : o.conversionRate}
            suffix={o?.conversionRate == null ? "" : "%"}
            accent={SERIES.yellow}
            hint={o?.conversionRate == null ? "пока мало компаний" : "хоть раз оплатили"}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Section
            title="Свежие обращения"
            extra={
              <Button type="link" size="small" onClick={to("support")}>
                Все обращения
              </Button>
            }
          >
            {tickets.isLoading ? (
              <Skeleton active paragraph={{ rows: 3 }} title={false} />
            ) : recentTickets.length ? (
              <ul className="rows">
                {recentTickets.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="row"
                      onClick={() => navigate("support", { ticket: t.id })}
                    >
                      <span className="row-main">
                        <span className="row-title">
                          №{t.number} · {t.subject}
                        </span>
                        <span className="row-sub">
                          {[t.tenantName, t.authorName, ago(t.lastMessageAt ?? t.createdAt)]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {t.priority === "high" ? <Tag color="red">срочно</Tag> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted">Новых обращений нет.</div>
            )}
          </Section>
        </Col>
        <Col xs={24} lg={10}>
          <Section title="Ограничения подписки сегодня">
            {sub ? (
              <ul className="kv">
                <li>
                  <span>Просрочили оплату</span>
                  <b>{num(sub.pastDueTenants)}</b>
                </li>
                <li>
                  <span>В льготном периоде</span>
                  <b>{num(sub.graceTenants)}</b>
                </li>
                <li>
                  <span>Доступ приостановлен</span>
                  <b>{num(sub.suspendedTenants)}</b>
                </li>
                <li>
                  <span>Заблокировано запросов</span>
                  <b>{num(sub.today.blockedApiRequests)}</b>
                </li>
                <li>
                  <span>Не отправлено сообщений</span>
                  <b>{num(sub.today.blockedOutboundMessages)}</b>
                </li>
                <li>
                  <span>Вернулись после оплаты</span>
                  <b>{num(sub.today.paymentReactivations)}</b>
                </li>
              </ul>
            ) : (
              <div className="muted">
                {loading ? "Загрузка…" : "Система ограничений не включена."}
              </div>
            )}
          </Section>
        </Col>
      </Row>
    </div>
  );
};
