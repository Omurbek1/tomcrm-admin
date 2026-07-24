import { Button, Layout, Menu, Typography } from "antd";
import { useEffect, useState } from "react";

import { api, clearToken, getToken, setPermissions, UNAUTH_EVENT } from "./api/client";
import { AdminsPage } from "./pages/AdminsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AuditPage } from "./pages/AuditPage";
import { LoginPage } from "./pages/LoginPage";
import { TariffsPage } from "./pages/TariffsPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { TenantsPage } from "./pages/TenantsPage";

const { Header, Content } = Layout;
const { Title } = Typography;

type View =
  | "tenants"
  | "analytics"
  | "tariffs"
  | "templates"
  | "audit"
  | "admins";

export const App = () => {
  const [authed, setAuthed] = useState<boolean>(!!getToken());
  const [view, setView] = useState<View>("tenants");

  // Токен протух/невалиден (интерсептор axios) → возвращаемся на логин.
  useEffect(() => {
    const onUnauth = () => setAuthed(false);
    window.addEventListener(UNAUTH_EVENT, onUnauth);
    return () => window.removeEventListener(UNAUTH_EVENT, onUnauth);
  }, []);

  // При входе освежаем права (могли измениться с прошлой сессии).
  useEffect(() => {
    if (!authed) return;
    void api
      .get<{ permissions: string[] }>("/api/platform/me")
      .then((r) => setPermissions(r.data.permissions ?? []))
      .catch(() => undefined);
  }, [authed]);

  if (!authed) return <LoginPage onLoggedIn={() => setAuthed(true)} />;

  const logout = () => {
    clearToken();
    setAuthed(false);
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          background: "#0f172a",
        }}
      >
        <Title level={4} style={{ color: "#fff", margin: 0, flexShrink: 0 }}>
          TomStore · Платформа
        </Title>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[view]}
          onClick={(e) => setView(e.key as View)}
          style={{ flex: 1, background: "transparent", minWidth: 0 }}
          items={[
            { key: "tenants", label: "Компании" },
            { key: "analytics", label: "Аналитика" },
            { key: "tariffs", label: "Тарифы" },
            { key: "templates", label: "Уведомления" },
            { key: "audit", label: "Журнал" },
            { key: "admins", label: "Администраторы" },
          ]}
        />
        <Button ghost onClick={logout}>
          Выйти
        </Button>
      </Header>
      <Content style={{ background: "#f1f5f9" }}>
        {view === "tenants" && <TenantsPage />}
        {view === "analytics" && <AnalyticsPage />}
        {view === "tariffs" && <TariffsPage />}
        {view === "templates" && <TemplatesPage />}
        {view === "audit" && <AuditPage />}
        {view === "admins" && <AdminsPage />}
      </Content>
    </Layout>
  );
};
