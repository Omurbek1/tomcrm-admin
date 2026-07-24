import { Button, Layout, Typography } from "antd";
import { useEffect, useState } from "react";

import { clearToken, getToken, UNAUTH_EVENT } from "./api/client";
import { LoginPage } from "./pages/LoginPage";
import { TenantsPage } from "./pages/TenantsPage";

const { Header, Content } = Layout;
const { Title } = Typography;

export const App = () => {
  const [authed, setAuthed] = useState<boolean>(!!getToken());

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
          justifyContent: "space-between",
          background: "#0f172a",
        }}
      >
        <Title level={4} style={{ color: "#fff", margin: 0 }}>
          TomStore · Панель платформы
        </Title>
        <Button ghost onClick={logout}>
          Выйти
        </Button>
      </Header>
      <Content style={{ background: "#f1f5f9" }}>
        <TenantsPage />
      </Content>
    </Layout>
  );
};
