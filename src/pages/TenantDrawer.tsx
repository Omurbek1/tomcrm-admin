import {
  App,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from "antd";

import {
  useExtendTrial,
  useSetStatus,
  useSetTariff,
  useTariffs,
  useTenant,
} from "../hooks";
import type { TenantStatus } from "../types";
import { STATUS_COLOR, STATUS_LABEL } from "../types";

const { Text } = Typography;

const USAGE_LABEL: Record<string, string> = {
  users: "Сотрудники",
  whatsappNumbers: "WhatsApp-номера",
  dealsPerMonth: "Сделок за месяц",
  products: "Товары",
  branches: "Филиалы",
};

interface Props {
  tenantId: string | null;
  onClose: () => void;
}

export const TenantDrawer = ({ tenantId, onClose }: Props) => {
  const { message } = App.useApp();
  const { data, isLoading } = useTenant(tenantId);
  const { data: tariffs } = useTariffs();
  const setStatus = useSetStatus();
  const extendTrial = useExtendTrial();
  const setTariff = useSetTariff();

  const t = data?.tenant;

  const changeStatus = (status: string) => {
    if (!t) return;
    setStatus.mutate(
      { id: t.id, status },
      {
        onSuccess: () => message.success("Статус обновлён"),
        onError: () => message.error("Не удалось сменить статус"),
      },
    );
  };

  const addDays = (days: number) => {
    if (!t) return;
    extendTrial.mutate(
      { id: t.id, days },
      {
        onSuccess: () => message.success(`Триал продлён на ${days} дн.`),
        onError: () => message.error("Не удалось продлить триал"),
      },
    );
  };

  const changeTariff = (tariffId: string) => {
    if (!t) return;
    setTariff.mutate(
      { id: t.id, tariffId },
      {
        onSuccess: () => message.success("Тариф изменён"),
        onError: () => message.error("Не удалось сменить тариф"),
      },
    );
  };

  return (
    <Drawer
      open={!!tenantId}
      onClose={onClose}
      width={520}
      title={t ? t.name : "Компания"}
    >
      {isLoading || !t ? (
        <Spin />
      ) : (
        <>
          <Space size="middle" wrap style={{ marginBottom: 8 }}>
            <Tag color={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Tag>
            <Text type="secondary">/{t.slug}</Text>
            {t.status === "trial" && (
              <Text type={t.trialDaysLeft <= 0 ? "danger" : "secondary"}>
                Триал: {t.trialDaysLeft} дн.
              </Text>
            )}
          </Space>

          <Descriptions column={1} size="small" style={{ marginTop: 8 }}>
            <Descriptions.Item label="Телефон">
              {t.contactPhone ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {t.contactEmail ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Тариф">
              {t.tariffName ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Создана">
              {new Date(t.createdAt).toLocaleDateString("ru-RU")}
            </Descriptions.Item>
          </Descriptions>

          <Divider titlePlacement="start">Расход</Divider>
          <Space size="large" wrap>
            {Object.entries(data.usage)
              .filter(([k]) => USAGE_LABEL[k])
              .map(([k, v]) => (
                <Statistic key={k} title={USAGE_LABEL[k]} value={v} />
              ))}
          </Space>

          <Divider titlePlacement="start">Действия</Divider>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div>
              <Text strong>Статус</Text>
              <br />
              <Select
                value={t.status}
                style={{ width: "100%", marginTop: 4 }}
                onChange={changeStatus}
                loading={setStatus.isPending}
                options={(
                  ["trial", "active", "blocked", "deleted"] as TenantStatus[]
                ).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              />
            </div>

            <div>
              <Text strong>Продлить триал</Text>
              <br />
              <Space style={{ marginTop: 4 }}>
                {[7, 14, 30].map((d) => (
                  <Button
                    key={d}
                    onClick={() => addDays(d)}
                    loading={extendTrial.isPending}
                  >
                    +{d} дн.
                  </Button>
                ))}
              </Space>
            </div>

            <div>
              <Text strong>Тариф</Text>
              <br />
              <Select
                value={t.tariffId ?? undefined}
                placeholder="Выбрать тариф"
                style={{ width: "100%", marginTop: 4 }}
                onChange={changeTariff}
                loading={setTariff.isPending}
                options={(tariffs ?? []).map((tf) => ({
                  value: tf.id,
                  label: `${tf.name} (${tf.code})`,
                }))}
              />
            </div>
          </Space>
        </>
      )}
    </Drawer>
  );
};
