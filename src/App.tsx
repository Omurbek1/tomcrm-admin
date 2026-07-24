import { Button, Layout, Menu, Typography } from "antd";
import { useEffect, useState } from "react";

import { clearToken, getToken, UNAUTH_EVENT } from "./api/client";
import { AdminsPage } from "./pages/AdminsPage";
import { LoginPage } from "./pages/LoginPage";
import { TenantsPage } from "./pages/TenantsPage";

const { Header, Content } = Layout;
const { Title } = Typography;

type View = "tenants" | "admins";

export const App = () => {
  const [authed, setAuthed] = useState<boolean>(!!getToken());
  const [view, setView] = useState<View>("tenants");

  // Токен протух/невалиден (интерсептор axios) → возвращаемся на логин.
  useEffect(() => {
    const onUnauth = () => setAuthed(false);
    window.addEventListener(UNAUTH_EVENT, onUnauth);
    return () => window.removeEventListener(UNAUTH_EVENT, onUnauth);
  }, []);

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
            { key: "admins", label: "Администраторы" },
          ]}
        />
        <Button ghost onClick={logout}>
          Выйти
        </Button>
      </Header>
      <Content style={{ background: "#f1f5f9" }}>
        {view === "tenants" ? <TenantsPage /> : <AdminsPage />}
      </Content>
    </Layout>
  );
};
