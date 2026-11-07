import { Spin } from "antd";
import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";

import { api, clearToken, getToken, setPermissions, UNAUTH_EVENT } from "./api/client";
import { AppShell } from "./components/AppShell";
import { identify, resetIdentity } from "./lib/monitoring";
import { NAV_EVENT, navigate, readView, sectionOf, type View } from "./lib/nav";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";

// Разделы — отдельными чанками: вход и «Обзор» не тянут таблицы, графики и
// формы всех остальных экранов. Частые разделы догружаются в простое.
const page = <K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
) => ({
  load,
  Component: lazy(() => load().then((m) => ({ default: m[name] }))),
});

const PAGES: Record<Exclude<View, "home">, ReturnType<typeof page>> = {
  tenants: page(() => import("./pages/TenantsPage"), "TenantsPage"),
  subscriptions: page(() => import("./pages/SubscriptionsPage"), "SubscriptionsPage"),
  analytics: page(() => import("./pages/AnalyticsPage"), "AnalyticsPage"),
  tariffs: page(() => import("./pages/TariffsPage"), "TariffsPage"),
  billing: page(() => import("./pages/BillingPage"), "BillingPage"),
  industries: page(() => import("./pages/IndustriesPage"), "IndustriesPage"),
  templates: page(() => import("./pages/TemplatesPage"), "TemplatesPage"),
  support: page(() => import("./pages/SupportPage"), "SupportPage"),
  integrations: page(() => import("./pages/IntegrationsPage"), "IntegrationsPage"),
  load: page(() => import("./pages/SystemLoadPage"), "SystemLoadPage"),
  audit: page(() => import("./pages/AuditPage"), "AuditPage"),
  admins: page(() => import("./pages/AdminsPage"), "AdminsPage"),
};

/** Вкладки пункта меню, объединяющего несколько разделов. */
const SectionTabs = ({ view }: { view: View }) => {
  const sec = sectionOf(view);
  if (!sec?.tabs) return null;
  return (
    <div className="section-head">
      <h1 className="section-title">{sec.label}</h1>
      <div className="section-tabs" role="tablist" aria-label={sec.label}>
        {sec.tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === view}
            className={`section-tab${t.key === view ? " is-on" : ""}`}
            onClick={() => navigate(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const Loading = () => (
  <div style={{ textAlign: "center", padding: 80 }}>
    <Spin />
  </div>
);

export const App = () => {
  const [authed, setAuthed] = useState<boolean>(!!getToken());
  const [view, setView] = useState<View>(readView);
  // Каждый переход (меню, «Назад», Ctrl+K) — новый ключ: экран заново читает
  // свои параметры из адреса (фильтр, ?id= открытой компании).
  const [navKey, setNavKey] = useState(0);

  useEffect(() => {
    const sync = () => {
      setView(readView());
      setNavKey((k) => k + 1);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener(NAV_EVENT, sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener(NAV_EVENT, sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  // Токен протух/невалиден (интерсептор axios) → возвращаемся на логин.
  useEffect(() => {
    const onUnauth = () => setAuthed(false);
    window.addEventListener(UNAUTH_EVENT, onUnauth);
    return () => window.removeEventListener(UNAUTH_EVENT, onUnauth);
  }, []);

  // При входе освежаем права (могли измениться с прошлой сессии) и привязываем
  // мониторинг к конкретному админу (distinct_id/Sentry user).
  useEffect(() => {
    if (!authed) return;
    void api
      .get<{ id?: string; login?: string; permissions: string[] }>(
        "/api/platform/me",
      )
      .then((r) => {
        setPermissions(r.data.permissions ?? []);
        if (r.data.id) identify(r.data.id, { login: r.data.login });
      })
      .catch(() => undefined);
  }, [authed]);

  // Прогрев: после входа в простое догружаем чанки частых разделов —
  // первый переход без задержки.
  useEffect(() => {
    if (!authed) return;
    const t = setTimeout(() => {
      for (const k of ["tenants", "billing", "support"] as const)
        void PAGES[k].load().catch(() => undefined);
    }, 2_000);
    return () => clearTimeout(t);
  }, [authed]);

  if (!authed) return <LoginPage onLoggedIn={() => setAuthed(true)} />;

  const logout = () => {
    resetIdentity();
    clearToken();
    setAuthed(false);
  };

  const Current = view === "home" ? HomePage : PAGES[view].Component;

  return (
    <AppShell view={view} onLogout={logout}>
      <SectionTabs view={view} />
      <div className={sectionOf(view)?.tabs ? "in-section" : undefined}>
        <Suspense fallback={<Loading />}>
          <Current key={`${view}:${navKey}`} />
        </Suspense>
      </div>
    </AppShell>
  );
};
