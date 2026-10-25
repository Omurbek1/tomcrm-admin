import { CopyOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import { useEffect } from "react";

import { can } from "../api/client";
import { PageHeader } from "../components/viz";
import {
  useInstagramAppConfig,
  useSetInstagramAppConfig,
  type InstagramAppConfigInput,
  type InstagramAppSource,
} from "../hooks";

const { Text } = Typography;

const errText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || fallback;

/** Значение берётся из env сервера — в админке его можно переопределить. */
const SourceTag = ({ source }: { source: InstagramAppSource }) =>
  source === "env" ? <Tag style={{ marginInlineStart: 6 }}>из env</Tag> : null;

/** Строка «что вставить в Meta»: подпись, значение моноширинным, копировать. */
const CopyRow = ({
  label,
  value,
  hint,
  extra,
}: {
  label: string;
  value: string | null;
  hint?: string;
  extra?: React.ReactNode;
}) => {
  const { message } = App.useApp();
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>
        {label}
      </div>
      <Space.Compact style={{ width: "100%", maxWidth: 640 }}>
        <Input
          readOnly
          value={value ?? ""}
          placeholder="—"
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        />
        <Button
          icon={<CopyOutlined />}
          disabled={!value}
          onClick={() =>
            void navigator.clipboard
              .writeText(value ?? "")
              .then(() => message.success("Скопировано"))
          }
        >
          Копировать
        </Button>
        {extra}
      </Space.Compact>
      {hint ? (
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
};

type FormValues = {
  appId: string;
  appSecret: string;
  redirectUri: string;
  apiVersion: string;
};

/**
 * Интеграции платформы: ключи Meta-приложения Instagram — одни на весь SaaS
 * (компании подключают свои аккаунты через это приложение). Пустое поле —
 * значение из env сервера. Ключ шифрования токенов здесь намеренно не
 * хранится: в одной базе с шифротекстом он ничего бы не защищал.
 */
export const IntegrationsPage = () => {
  const { message, modal } = App.useApp();
  const editable = can("integrations.edit");
  const { data: cfg, isLoading, isError, refetch } = useInstagramAppConfig();
  const save = useSetInstagramAppConfig();
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (!cfg) return;
    form.setFieldsValue({
      appId: cfg.appId ?? "",
      appSecret: "",
      redirectUri: cfg.redirectUri ?? cfg.suggestedRedirectUri ?? "",
      apiVersion: cfg.apiVersionSource ? cfg.apiVersion : "",
    });
  }, [cfg, form]);

  const submit = (v: FormValues) => {
    const input: InstagramAppConfigInput = {
      appId: v.appId.trim(),
      redirectUri: v.redirectUri.trim(),
      apiVersion: v.apiVersion.trim(),
      ...(v.appSecret.trim() ? { appSecret: v.appSecret.trim() } : {}),
    };
    save.mutate(input, {
      onSuccess: (d) =>
        message.success(
          d.missing.length
            ? `Сохранено. Не хватает: ${d.missing.join(", ")}`
            : "Сохранено — компании могут подключать Instagram",
        ),
      onError: (e) => message.error(errText(e, "Не удалось сохранить")),
    });
  };

  const generate = () =>
    save.mutateAsync({ regenerateVerifyToken: true }).then(
      () => message.success("Verify token готов — скопируйте его в Meta App"),
      (e) => message.error(errText(e, "Не удалось сгенерировать")),
    );

  // Первый токен — сразу; замена рабочего — с предупреждением.
  const regenerate = () =>
    cfg?.verifyToken
      ? modal.confirm({
          title: "Сгенерировать новый verify token?",
          content:
            "Старый перестанет работать. Вставьте новый в Meta App → Webhooks → Verify token и подтвердите подписку.",
          okText: "Сгенерировать",
          cancelText: "Отмена",
          autoFocusButton: "cancel",
          onOk: generate,
        })
      : void generate();

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <PageHeader
        title="Интеграции"
        subtitle="Ключи внешних сервисов — общие для всех компаний"
      />

      {isError ? (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить настройки"
          action={
            <Button size="small" onClick={() => void refetch()}>
              Повторить
            </Button>
          }
        />
      ) : isLoading || !cfg ? (
        <Card>
          <Skeleton active />
        </Card>
      ) : (
        <Card
          title="Instagram (Meta)"
          extra={
            cfg.missing.length ? (
              <Tag color="orange">Не хватает: {cfg.missing.join(", ")}</Tag>
            ) : (
              <Tag color="green">Готово</Tag>
            )
          }
        >
          <p style={{ color: "#64748b", marginTop: 0 }}>
            Одно приложение Meta на всю платформу: через него компании
            подключают свои аккаунты в «Интеграциях» CRM. Подключено аккаунтов:{" "}
            <b>{cfg.accounts.total}</b>
            {cfg.accounts.total ? `, работают ${cfg.accounts.active}` : ""}.
          </p>

          <div style={{ fontWeight: 600, margin: "16px 0 10px" }}>
            1. Вставьте в Meta App
          </div>
          <CopyRow
            label="Webhooks → Callback URL"
            value={cfg.webhookUrl}
            hint="Поля подписки: messages, messaging_postbacks, message_reactions, comments, live_comments, mentions"
          />
          <CopyRow
            label="Webhooks → Verify token"
            value={cfg.verifyToken}
            hint={
              cfg.verifyTokenSource === "env"
                ? "Сейчас из env сервера. Новый токен из админки заменит его."
                : undefined
            }
            extra={
              <Button
                icon={<ReloadOutlined />}
                disabled={!editable}
                loading={save.isPending}
                onClick={regenerate}
              >
                {cfg.verifyToken ? "Новый" : "Сгенерировать"}
              </Button>
            }
          />
          <CopyRow
            label="Instagram Login → Valid OAuth Redirect URIs"
            value={cfg.redirectUri ?? cfg.suggestedRedirectUri}
            hint={
              cfg.redirectUri
                ? undefined
                : "Адрес этого сервера — сохраните его в форме ниже."
            }
          />

          <div style={{ fontWeight: 600, margin: "20px 0 10px" }}>
            2. Ключи приложения
          </div>
          <Form<FormValues>
            form={form}
            layout="vertical"
            onFinish={submit}
            disabled={!editable}
            style={{ maxWidth: 640 }}
          >
            <Form.Item
              name="appId"
              label={
                <span>
                  Instagram App ID <SourceTag source={cfg.appIdSource} />
                </span>
              }
            >
              <Input placeholder="Meta App → Instagram → настройка API" />
            </Form.Item>
            <Form.Item
              name="appSecret"
              label={
                <span>
                  Instagram App Secret{" "}
                  <SourceTag source={cfg.appSecretSource} />
                </span>
              }
              extra="Хранится зашифрованным; показываем только последние 4 символа."
            >
              <Input.Password
                autoComplete="new-password"
                placeholder={
                  cfg.appSecretSet
                    ? `Сохранён ${cfg.appSecretMask} — оставьте пустым, чтобы не менять`
                    : "Секрет приложения"
                }
              />
            </Form.Item>
            <Form.Item
              name="redirectUri"
              label={
                <span>
                  Redirect URI <SourceTag source={cfg.redirectUriSource} />
                </span>
              }
              extra="Должен совпадать с адресом в Meta App (шаг 1)."
            >
              <Input placeholder={cfg.suggestedRedirectUri ?? "https://…"} />
            </Form.Item>
            <Form.Item
              name="apiVersion"
              label={
                <span>
                  Версия Graph API <SourceTag source={cfg.apiVersionSource} />
                </span>
              }
            >
              <Input placeholder={`${cfg.apiVersion} (по умолчанию)`} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={save.isPending}>
              Сохранить
            </Button>
          </Form>

          <Text
            type="secondary"
            style={{ display: "block", marginTop: 20, fontSize: 12 }}
          >
            Токены компаний шифруются ключом сервера (
            {cfg.tokenKey === "token_enc_key"
              ? "TOKEN_ENC_KEY"
              : cfg.tokenKey === "server_secret"
                ? "секрет сервера — можно задать отдельный TOKEN_ENC_KEY в env"
                : "ключ не найден — задайте TOKEN_ENC_KEY в env"}
            ). Сам ключ в админке не хранится: в одной базе с токенами он бы их
            не защищал.
          </Text>
        </Card>
      )}
    </div>
  );
};
