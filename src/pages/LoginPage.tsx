import { App, Button, Card, Form, Input, Typography } from "antd";
import { useState } from "react";

import { api, setToken } from "../api/client";

const { Title, Text } = Typography;

interface Props {
  onLoggedIn: () => void;
}

export const LoginPage = ({ onLoggedIn }: Props) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const submit = async (values: { login: string; password: string }) => {
    setLoading(true);
    try {
      const { data } = await api.post<{ token: string }>(
        "/api/platform/login",
        values,
      );
      setToken(data.token);
      onLoggedIn();
    } catch {
      message.error("Неверный логин или пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0f172a",
      }}
    >
      <Card style={{ width: 380 }}>
        <Title level={3} style={{ marginBottom: 0 }}>
          TomStore
        </Title>
        <Text type="secondary">Панель платформы</Text>
        <Form layout="vertical" onFinish={submit} style={{ marginTop: 20 }}>
          <Form.Item
            name="login"
            label="Логин"
            rules={[{ required: true, message: "Введите логин" }]}
          >
            <Input autoComplete="username" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: "Введите пароль" }]}
          >
            <Input.Password autoComplete="current-password" size="large" />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={loading}
          >
            Войти
          </Button>
        </Form>
      </Card>
    </div>
  );
};
