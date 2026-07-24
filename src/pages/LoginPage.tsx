import {
  App,
  Button,
  Form,
  Input,
  QRCode,
  Steps,
  Typography,
} from "antd";
import { useState } from "react";

import { api, setPermissions, setToken } from "../api/client";

const { Title, Text, Paragraph } = Typography;

interface Props {
  onLoggedIn: () => void;
}

interface LoginOk {
  token: string;
  permissions: string[];
}
interface SetupRequired {
  setupRequired: true;
  setupToken: string;
  secret: string;
  otpauthUrl: string;
}

export const LoginPage = ({ onLoggedIn }: Props) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [needCode, setNeedCode] = useState(false);
  const [setup, setSetup] = useState<SetupRequired | null>(null);
  const [setupCode, setSetupCode] = useState("");

  const finish = (data: LoginOk) => {
    setToken(data.token);
    setPermissions(data.permissions ?? []);
    onLoggedIn();
  };

  const submit = async (values: {
    login: string;
    password: string;
    totpCode?: string;
  }) => {
    setLoading(true);
    try {
      const { data } = await api.post<LoginOk | SetupRequired>(
        "/api/platform/login",
        values,
      );
      if ("setupRequired" in data) {
        setSetup(data);
        message.info("Настройте двухфакторную защиту, чтобы войти");
      } else {
        finish(data);
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "";
      if (msg === "TOTP_REQUIRED") {
        setNeedCode(true);
        message.info("Введите код из приложения-аутентификатора");
      } else if (msg.includes("2FA")) {
        message.error("Неверный код 2FA");
      } else {
        message.error("Неверный логин или пароль");
      }
    } finally {
      setLoading(false);
    }
  };

  const completeSetup = async () => {
    if (!setup) return;
    setLoading(true);
    try {
      const { data } = await api.post<LoginOk>(
        "/api/platform/2fa/setup-login",
        { setupToken: setup.setupToken, code: setupCode },
      );
      finish(data);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "";
      if (msg.includes("истекл")) {
        message.error("Сессия настройки истекла — войдите заново");
        setSetup(null);
        setSetupCode("");
      } else {
        message.error("Неверный код");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">T</div>
          <div>
            <Title level={4} style={{ margin: 0, lineHeight: 1.1 }}>
              TomStore
            </Title>
            <Text type="secondary">Панель платформы</Text>
          </div>
        </div>

        {setup ? (
          <div className="login-2fa">
            <Title level={5} style={{ marginTop: 0 }}>
              Настройка двухфакторной защиты
            </Title>
            <Text type="secondary">
              Для входа в панель у каждого администратора должна быть своя 2FA.
            </Text>
            <Steps
              orientation="vertical"
              size="small"
              current={1}
              style={{ marginTop: 16 }}
              items={[
                {
                  title: "Отсканируйте QR",
                  content: (
                    <div style={{ padding: "8px 0" }}>
                      <QRCode value={setup.otpauthUrl} size={168} />
                      <Paragraph
                        copyable={{ text: setup.secret }}
                        type="secondary"
                        style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}
                      >
                        или ключ вручную: <Text code>{setup.secret}</Text>
                      </Paragraph>
                    </div>
                  ),
                },
                {
                  title: "Введите код из приложения",
                  description: (
                    <div style={{ paddingTop: 6 }}>
                      <Input
                        size="large"
                        inputMode="numeric"
                        maxLength={6}
                        autoFocus
                        value={setupCode}
                        onChange={(e) =>
                          setSetupCode(e.target.value.replace(/\D/g, ""))
                        }
                        onPressEnter={completeSetup}
                        placeholder="123 456"
                        style={{ letterSpacing: 6, textAlign: "center" }}
                      />
                    </div>
                  ),
                },
              ]}
            />
            <Button
              type="primary"
              block
              size="large"
              loading={loading}
              disabled={setupCode.length !== 6}
              onClick={completeSetup}
            >
              Включить и войти
            </Button>
            <Button
              type="link"
              block
              style={{ marginTop: 8 }}
              onClick={() => {
                setSetup(null);
                setSetupCode("");
              }}
            >
              ← Назад
            </Button>
          </div>
        ) : (
          <Form
            layout="vertical"
            onFinish={submit}
            requiredMark={false}
            size="large"
          >
            <Form.Item
              name="login"
              label="Логин"
              rules={[{ required: true, message: "Введите логин" }]}
            >
              <Input autoComplete="username" placeholder="admin" />
            </Form.Item>
            <Form.Item
              name="password"
              label="Пароль"
              rules={[{ required: true, message: "Введите пароль" }]}
              style={{ marginBottom: needCode ? 12 : 24 }}
            >
              <Input.Password
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </Form.Item>

            {needCode && (
              <div className="login-2fa">
                <Form.Item
                  name="totpCode"
                  label="Код двухфакторной защиты"
                  rules={[
                    { required: true, message: "Введите 6-значный код" },
                    { len: 6, message: "Код из 6 цифр" },
                  ]}
                >
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    placeholder="123 456"
                    style={{ letterSpacing: 6, textAlign: "center" }}
                  />
                </Form.Item>
              </div>
            )}

            <Button type="primary" htmlType="submit" block loading={loading}>
              {needCode ? "Подтвердить вход" : "Войти"}
            </Button>

            {needCode && (
              <Button
                type="link"
                block
                style={{ marginTop: 8 }}
                onClick={() => setNeedCode(false)}
              >
                ← Назад
              </Button>
            )}
          </Form>
        )}

        <Text
          type="secondary"
          style={{
            display: "block",
            marginTop: 18,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Доступ только для операторов платформы TomStore
        </Text>
      </div>
    </div>
  );
};
