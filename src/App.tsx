import { MenuOutlined } from "@ant-design/icons";
import { Button, Drawer, Grid, Layout, Menu, Typography } from "antd";
import { useEffect, useState } from "react";

import { api, clearToken, getToken, setPermissions, UNAUTH_EVENT } from "./api/client";
import { identify, resetIdentity } from "./lib/monitoring";
import { AdminsPage } from "./pages/AdminsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AuditPage } from "./pages/AuditPage";
import { BillingPage } from "./pages/BillingPage";
import { LoginPage } from "./pages/LoginPage";
import { TariffsPage } from "./pages/TariffsPage";
import { IndustriesPage } from "./pages/IndustriesPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { TenantsPage } from "./pages/TenantsPage";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

type View =
  | "tenants"
  | "analytics"
  | "tariffs"
  | "billing"
  | "industries"
  | "templates"
  | "audit"
  | "admins";

const NAV: { key: View; label: string }[] = [
  { key: "tenants", label: "Компании" },
  { key: "analytics", label: "Аналитика" },
  { key: "tariffs", label: "Тарифы" },
  { key: "billing", label: "Биллинг" },
  { key: "industries", label: "Отрасли" },
  { key: "templates", label: "Уведомления" },
  { key: "audit", label: "Журнал" },
  { key: "admins", label: "Администраторы" },
];

export const App = () => {
  const [authed, setAuthed] = useState<boolean>(!!getToken());
  const [view, setView] = useState<View>("tenants");
  const [navOpen, setNavOpen] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px

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

  if (!authed) return <LoginPage onLoggedIn={() => setAuthed(true)} />;

  const logout = () => {
    resetIdentity();
    clearToken();
    setAuthed(false);
  };

  const currentLabel = NAV.find((n) => n.key === view)?.label ?? "";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#0f172a",
          paddingInline: 16,
        }}
      >
        {isMobile ? (
          <>
            <Button
              type="text"
              icon={<MenuOutlined style={{ color: "#fff", fontSize: 18 }} />}
              onClick={() => setNavOpen(true)}
              style={{ flexShrink: 0 }}
              aria-label="Меню"
            />
            <Title
              level={5}
              style={{
                color: "#fff",
                margin: 0,
                flex: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentLabel}
            </Title>
            <Button ghost size="small" onClick={logout} style={{ flexShrink: 0 }}>
              Выйти
            </Button>
          </>
        ) : (
          <>
            <Title
              level={4}
              style={{
                color: "#fff",
                margin: 0,
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              TomStore
            </Title>
            <Menu
              theme="dark"
              mode="horizontal"
              selectedKeys={[view]}
              onClick={(e) => setView(e.key as View)}
              style={{ flex: 1, background: "transparent", minWidth: 0 }}
              items={NAV}
            />
            <Button ghost onClick={logout}>
              Выйти
            </Button>
          </>
        )}
      </Header>

      <Drawer
        title="TomStore · Платформа"
        placement="left"
        open={navOpen}
        onClose={() => setNavOpen(false)}
        styles={{ body: { padding: 0 } }}
        size={260}
      >
        <Menu
          mode="inline"
          selectedKeys={[view]}
          onClick={(e) => {
            setView(e.key as View);
            setNavOpen(false);
          }}
          items={NAV}
        />
      </Drawer>

      <Content style={{ background: "#f1f5f9" }}>
        {view === "tenants" && <TenantsPage />}
        {view === "analytics" && <AnalyticsPage />}
        {view === "tariffs" && <TariffsPage />}
        {view === "billing" && <BillingPage />}
        {view === "industries" && <IndustriesPage />}
        {view === "templates" && <TemplatesPage />}
        {view === "audit" && <AuditPage />}
        {view === "admins" && <AdminsPage />}
      </Content>
    </Layout>
  );
};
