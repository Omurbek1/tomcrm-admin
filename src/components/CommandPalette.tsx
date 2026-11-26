import { SearchOutlined } from "@ant-design/icons";
import { Input, Modal, Tag } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

import { can } from "../api/client";
import { useTenants } from "../hooks";
import { openAddSubscription } from "./AddSubscriptionModal";
import { NAV_ITEMS, navigate, type View } from "../lib/nav";

type Hit =
  | { kind: "view"; key: string; title: string; sub: string; view: View }
  | {
      kind: "action";
      key: string;
      title: string;
      sub: string;
      tenantId: string | null;
    }
  | {
      kind: "tenant";
      key: string;
      title: string;
      sub: string;
      slug: string;
      status: string;
    };

const STATUS_TAG: Record<string, { label: string; color: string }> = {
  active: { label: "Активна", color: "green" },
  trial: { label: "Триал", color: "blue" },
  blocked: { label: "Заморожена", color: "default" },
  deleted: { label: "Удалена", color: "default" },
};

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").trim();

/** Недавно открытые компании (только в этом браузере) — для пустого запроса. */
const RECENT_KEY = "platform-recent-tenants";
const readRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const pushRecent = (slug: string) => {
  try {
    const next = [slug, ...readRecent().filter((x) => x !== slug)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* приватный режим — просто без «недавних» */
  }
};
const digits = (s: string) => s.replace(/\D/g, "");

/**
 * Быстрый переход (Ctrl/⌘+K): компания по названию, адресу, владельцу или
 * телефону и любой раздел. Список компаний — из кэша экрана «Компании»
 * (один запрос), фильтр — мгновенно на клиенте. ↑/↓ — выбор, Enter — открыть.
 */
export const CommandPalette = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const { data: tenants, isLoading } = useTenants({});

  const hits = useMemo<Hit[]>(() => {
    const t = norm(q);
    const d = digits(q);
    const views: Hit[] = NAV_ITEMS.filter(
      (i) => !t || norm(i.label).includes(t) || norm(i.hint).includes(t),
    ).map((i) => ({
      kind: "view",
      key: `v:${i.key}`,
      title: i.label,
      sub: i.hint,
      view: i.key,
    }));
    // Действие «Добавить подписку» — по словам «подписка/оплата/продлить».
    const canPay = can("billing.edit");
    const wantsPay = !t || /подпис|оплат|продл|платеж|платёж/.test(t);
    const addAction: Hit[] =
      canPay && wantsPay
        ? [
            {
              kind: "action",
              key: "a:add-subscription",
              title: "Добавить подписку",
              sub: "Ручная оплата: компания, срок, сумма",
              tenantId: null,
            },
          ]
        : [];
    if (!t) {
      const bySlug = new Map((tenants ?? []).map((r) => [r.slug, r]));
      const recent: Hit[] = readRecent()
        .map((slug) => bySlug.get(slug))
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map((r) => ({
          kind: "tenant",
          key: `r:${r.id}`,
          title: r.name,
          sub: ["недавно", `/${r.slug}`, r.tariffName].filter(Boolean).join(" · "),
          slug: r.slug,
          status: r.status,
        }));
      return [...recent, ...addAction, ...views];
    }
    const matched = (tenants ?? []).filter(
      (r) =>
        r.status !== "deleted" &&
        (norm(r.name).includes(t) || norm(r.slug).includes(t)),
    );
    // Одна найденная компания — сразу предложить продлить именно её.
    const payFor: Hit[] =
      canPay && matched.length === 1
        ? [
            {
              kind: "action",
              key: `a:pay:${matched[0].id}`,
              title: `Добавить подписку: ${matched[0].name}`,
              sub: matched[0].paidUntil
                ? `Сейчас оплачено до ${new Date(matched[0].paidUntil).toLocaleDateString("ru-RU")}`
                : "Ручная оплата",
              tenantId: matched[0].id,
            },
          ]
        : [];
    const companies: Hit[] = (tenants ?? [])
      .filter(
        (r) =>
          norm(r.name).includes(t) ||
          norm(r.slug).includes(t) ||
          norm(r.ownerName ?? "").includes(t) ||
          (d.length >= 3 &&
            (digits(r.ownerPhone ?? "").includes(d) ||
              digits(r.contactPhone ?? "").includes(d))),
      )
      .slice(0, 8)
      .map((r) => ({
        kind: "tenant",
        key: `t:${r.id}`,
        title: r.name,
        sub: [`/${r.slug}`, r.tariffName, r.ownerName]
          .filter(Boolean)
          .join(" · "),
        slug: r.slug,
        status: r.status,
      }));
    return [...companies, ...payFor, ...addAction, ...views];
    // open — «недавние» перечитываем при каждом открытии.
  }, [q, tenants, open]);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    if (h.kind === "view") navigate(h.view);
    else if (h.kind === "action") openAddSubscription(h.tenantId);
    else {
      pushRecent(h.slug);
      navigate("tenants", { id: h.slug });
    }
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(hits[active]);
    }
  };

  // Выбранная строка всегда видна при листании стрелками.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={560}
      styles={{ body: { padding: 0 } }}
      afterOpenChange={(o) => {
        if (!o) {
          setQ("");
          setActive(0);
        }
      }}
      destroyOnHidden
    >
      <div className="cmdk">
        <Input
          autoFocus
          size="large"
          variant="borderless"
          prefix={<SearchOutlined style={{ color: "var(--text-3)" }} />}
          placeholder="Компания, телефон владельца или раздел…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded
          aria-controls="cmdk-list"
          aria-activedescendant={hits[active] ? `cmdk-opt-${active}` : undefined}
          aria-label="Быстрый переход"
        />
        <ul className="cmdk-list" ref={listRef} role="listbox" id="cmdk-list">
          {hits.map((h, i) => (
            <li
              key={h.key}
              id={`cmdk-opt-${i}`}
              data-idx={i}
              role="option"
              aria-selected={i === active}
              className={`cmdk-item${i === active ? " is-active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(h)}
            >
              <div className="cmdk-main">
                <span className="cmdk-title">{h.title}</span>
                <span className="cmdk-sub">{h.sub}</span>
              </div>
              {h.kind === "tenant" ? (
                <Tag
                  color={STATUS_TAG[h.status]?.color}
                  style={{ marginInlineEnd: 0 }}
                >
                  {STATUS_TAG[h.status]?.label ?? h.status}
                </Tag>
              ) : (
                <span className="cmdk-kind">
                  {h.kind === "action" ? "действие" : "раздел"}
                </span>
              )}
            </li>
          ))}
          {!hits.length ? (
            <li className="cmdk-empty">
              {isLoading ? "Загружаем компании…" : "Ничего не нашлось"}
            </li>
          ) : null}
        </ul>
        <div className="cmdk-foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> выбрать
          </span>
          <span>
            <kbd>Enter</kbd> открыть
          </span>
          <span>
            <kbd>Esc</kbd> закрыть
          </span>
        </div>
      </div>
    </Modal>
  );
};
