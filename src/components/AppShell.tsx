import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  CreditCardOutlined,
  CustomerServiceOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuOutlined,
  ApiOutlined,
  SafetyOutlined,
  SearchOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import { Badge, Button, Drawer, Grid, Tooltip } from "antd";
import { useEffect, useState, type ReactNode } from "react";

import { useAttention } from "../lib/attention";
import { setMode, useTheme, type ThemeMode } from "../lib/theme";
import { NAV_GROUPS, navigate, viewLabel, type View } from "../lib/nav";
import { CommandPalette } from "./CommandPalette";

const ICON: Record<View, ReactNode> = {
  home: <HomeOutlined />,
  tenants: <AppstoreOutlined />,
  support: <CustomerServiceOutlined />,
  billing: <CreditCardOutlined />,
  tariffs: <TagsOutlined />,
  analytics: <BarChartOutlined />,
  industries: <ApartmentOutlined />,
  templates: <BellOutlined />,
  integrations: <ApiOutlined />,
  audit: <AuditOutlined />,
  admins: <SafetyOutlined />,
};

const THEMES: Array<{ key: ThemeMode; label: string; title: string }> = [
  { key: "light", label: "Светлая", title: "Светлая тема" },
  { key: "dark", label: "Тёмная", title: "Тёмная тема (графит)" },
  { key: "black", label: "Чёрная", title: "Чёрная тема — бережёт заряд на OLED-экранах" },
  { key: "system", label: "Авто", title: "Как в системе телефона или компьютера" },
];

/** Переключатель темы — внизу меню (и на телефоне в выезжающем меню). */
const ThemeSwitch = () => {
  const { mode } = useTheme();
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Тема">
      {THEMES.map((t) => (
        <button
          key={t.key}
          type="button"
          role="radio"
          aria-checked={mode === t.key}
          title={t.title}
          className={`theme-opt${mode === t.key ? " is-on" : ""}`}
          onClick={() => setMode(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
};

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Каркас панели: слева меню по группам (что делать → деньги → настройки →
 * безопасность) со счётчиками дел, сверху — поиск Ctrl/⌘+K. На телефоне
 * меню выезжает слева.
 */
export const AppShell = ({
  view,
  onLogout,
  children,
}: {
  view: View;
  onLogout: () => void;
  children: ReactNode;
}) => {
  const isMobile = !Grid.useBreakpoint().md;
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { badges } = useAttention();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav = (
    <nav className="shell-nav" aria-label="Разделы">
      {NAV_GROUPS.map((g) => (
        <div key={g.title} className="shell-group">
          <div className="shell-group-title">{g.title}</div>
          {g.items.map((i) => {
            const count = badges[i.key] ?? 0;
            const current = i.key === view;
            return (
              <button
                key={i.key}
                type="button"
                className={`shell-link${current ? " is-current" : ""}`}
                aria-current={current ? "page" : undefined}
                onClick={() => {
                  navigate(i.key);
                  setNavOpen(false);
                }}
              >
                <span className="shell-icon" aria-hidden>
                  {ICON[i.key]}
                </span>
                <span className="shell-label">{i.label}</span>
                {count > 0 ? (
                  <Badge
                    count={count}
                    overflowCount={99}
                    size="small"
                    color={i.key === "support" ? "#2a78d6" : "#e34948"}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
      <div className="shell-group">
        <div className="shell-group-title">Тема</div>
        <ThemeSwitch />
      </div>
    </nav>
  );

  const search = (
    <button
      type="button"
      className="shell-search"
      onClick={() => setPaletteOpen(true)}
      aria-label="Быстрый переход"
    >
      <SearchOutlined />
      <span className="shell-search-text">Найти компанию или раздел</span>
      {!isMobile ? <kbd>{isMac ? "⌘K" : "Ctrl K"}</kbd> : null}
    </button>
  );

  return (
    <div className="shell">
      {isMobile ? (
        <Drawer
          placement="left"
          open={navOpen}
          onClose={() => setNavOpen(false)}
          size={272}
          title="TomStore · Платформа"
          styles={{ body: { padding: 8 } }}
        >
          {nav}
        </Drawer>
      ) : (
        <aside className="shell-side">
          <div className="shell-brand">
            <span className="shell-logo" aria-hidden>
              T
            </span>
            <span>
              <span className="shell-brand-name">TomStore</span>
              <span className="shell-brand-sub">Панель платформы</span>
            </span>
          </div>
          {nav}
          <button type="button" className="shell-link shell-logout" onClick={onLogout}>
            <span className="shell-icon" aria-hidden>
              <LogoutOutlined />
            </span>
            <span className="shell-label">Выйти</span>
          </button>
        </aside>
      )}

      <div className="shell-main">
        <header className="shell-top">
          {isMobile ? (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setNavOpen(true)}
              aria-label="Меню"
            />
          ) : null}
          {isMobile ? <span className="shell-top-title">{viewLabel(view)}</span> : null}
          {search}
          {isMobile ? (
            <Tooltip title="Выйти">
              <Button
                type="text"
                icon={<LogoutOutlined />}
                onClick={onLogout}
                aria-label="Выйти"
              />
            </Tooltip>
          ) : null}
        </header>
        <main className="shell-content">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
};
