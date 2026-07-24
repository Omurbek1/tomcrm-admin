import {
  App,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Typography,
} from "antd";
import { useRef, useState } from "react";

import { checkSlug, useCreateTenant, useTariffs } from "../hooks";
import type { CreateTenantResult } from "../hooks";

const { Text, Paragraph } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
}

type SlugState = "" | "checking" | "ok" | "taken";

export const CreateTenantModal = ({ open, onClose }: Props) => {
  const { message } = App.useApp();
  const { data: tariffs } = useTariffs();
  const createTenant = useCreateTenant();
  const [form] = Form.useForm();
  const [slugState, setSlugState] = useState<SlugState>("");
  const [result, setResult] = useState<CreateTenantResult | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSlugChange = (raw: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!raw.trim()) {
      setSlugState("");
      return;
    }
    setSlugState("checking");
    debounce.current = setTimeout(() => {
      void checkSlug(raw)
        .then((r) => setSlugState(r.available ? "ok" : "taken"))
        .catch(() => setSlugState(""));
    }, 400);
  };

  const submit = (v: {
    companyName: string;
    slug?: string;
    tariffId?: string;
    ownerName: string;
    ownerPhone: string;
    ownerEmail: string;
    trialDays?: number;
    isTest?: boolean;
  }) => {
    if (v.slug && slugState === "taken") {
      message.error("Slug занят — выберите другой");
      return;
    }
    createTenant.mutate(v, {
      onSuccess: (r) => {
        setResult(r);
        message.success("Компания создана");
      },
      onError: (e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Не удалось создать компанию";
        message.error(msg);
      },
    });
  };

  const close = () => {
    form.resetFields();
    setSlugState("");
    setResult(null);
    onClose();
  };

  const slugHelp =
    slugState === "checking"
      ? "Проверяем…"
      : slugState === "ok"
        ? "Свободен ✓"
        : slugState === "taken"
          ? "Занят ✗"
          : "Оставьте пустым — сгенерируем из названия";

  return (
    <Modal
      open={open}
      title={result ? "Компания создана" : "Новая компания"}
      onCancel={close}
      onOk={result ? close : () => form.submit()}
      okText={result ? "Готово" : "Создать"}
      cancelButtonProps={result ? { style: { display: "none" } } : undefined}
      confirmLoading={createTenant.isPending}
      width={560}
    >
      {result ? (
        <div>
          <Paragraph>
            Передайте владельцу данные для входа (это единственный показ пароля):
          </Paragraph>
          <Paragraph>
            <Text strong>Компания:</Text> {result.tenant.name} (/
            {result.tenant.slug})
            <br />
            <Text strong>Логин:</Text> <Text code>{result.login}</Text>
            <br />
            <Text strong>Временный пароль:</Text>{" "}
            <Text code copyable>
              {result.tempPassword}
            </Text>
            <br />
            <Text strong>Триал до:</Text>{" "}
            {new Date(result.trialEndsAt).toLocaleDateString("ru-RU")}
          </Paragraph>
          <Text type="secondary">
            Попросите владельца сменить пароль после первого входа.
          </Text>
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          initialValues={{ trialDays: 14 }}
        >
          <Form.Item
            name="companyName"
            label="Название компании"
            rules={[{ required: true, min: 2, message: "Минимум 2 символа" }]}
          >
            <Input placeholder="ОсОО «Ромашка»" />
          </Form.Item>
          <Form.Item name="slug" label="Slug (адрес)" help={slugHelp}>
            <Input
              placeholder="romashka"
              onChange={(e) => onSlugChange(e.target.value)}
              status={slugState === "taken" ? "error" : undefined}
            />
          </Form.Item>
          <Form.Item name="tariffId" label="Тариф">
            <Select
              allowClear
              placeholder="Триальный по умолчанию"
              options={(tariffs ?? [])
                .filter((tf) => !tf.archived)
                .map((tf) => ({
                  value: tf.id,
                  label: `${tf.name} (${tf.code})`,
                }))}
            />
          </Form.Item>

          <div style={{ fontWeight: 600, margin: "4px 0 8px" }}>Владелец</div>
          <Form.Item
            name="ownerName"
            label="Имя"
            rules={[{ required: true, message: "Укажите имя владельца" }]}
          >
            <Input />
          </Form.Item>
          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item
              name="ownerPhone"
              label="Телефон"
              style={{ flex: 1 }}
              rules={[{ required: true, message: "Укажите телефон" }]}
            >
              <Input placeholder="+996 ..." />
            </Form.Item>
            <Form.Item
              name="ownerEmail"
              label="Email"
              style={{ flex: 1 }}
              rules={[
                { required: true, type: "email", message: "Корректный email" },
              ]}
            >
              <Input placeholder="owner@company.kg" />
            </Form.Item>
          </div>
          <Form.Item name="trialDays" label="Длина триала (дней)">
            <InputNumber min={0} max={3650} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="isTest" valuePropName="checked">
            <Checkbox>Тестовая компания (не в MRR/конверсии/аналитике)</Checkbox>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};
