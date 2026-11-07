import { SearchOutlined } from "@ant-design/icons";
import { Input, Modal, Tag } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

import { useTenants } from "../hooks";
import { NAV_ITEMS, navigate, type View } from "../lib/nav";

type Hit =
  | { kind: "view"; key: string; title: string; sub: string; view: View }
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
    if (!t) return views;
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
    return [...companies, ...views];
  }, [q, tenants]);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    if (h.kind === "view") navigate(h.view);
    else navigate("tenants", { id: h.slug });
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
          prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
          placeholder="Компания, телефон владельца или раздел…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          aria-label="Быстрый переход"
        />
        <ul className="cmdk-list" ref={listRef} role="listbox">
          {hits.map((h, i) => (
            <li
              key={h.key}
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
                <span className="cmdk-kind">раздел</span>
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
