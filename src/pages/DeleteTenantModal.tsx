import { App, Alert, Button, Input, Modal, Space, Typography } from "antd";
import { useState } from "react";

import {
  useTenantImpact,
  useSoftDeleteTenant,
  usePurgeTestTenant,
} from "../hooks";

const { Text, Paragraph } = Typography;

/**
 * Удаление компании: soft delete (90 дней до физического удаления) с обязательной
 * причиной + ручным вводом slug. Для тестовых — «Удалить немедленно и безвозвратно»
 * с двойным подтверждением. Показывает, сколько данных затронуто.
 */
export const DeleteTenantModal = ({
  open,
  onClose,
  tenantId,
  slug,
  name,
  isTest,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  slug: string;
  name: string;
  isTest: boolean;
}) => {
  const { message, modal } = App.useApp();
  const { data: impact } = useTenantImpact(tenantId, open);
  const softDelete = useSoftDeleteTenant();
  const purgeTest = usePurgeTestTenant();
  const [reason, setReason] = useState("");
  const [confirmSlug, setConfirmSlug] = useState("");

  const reset = () => {
    setReason("");
    setConfirmSlug("");
  };

  const doSoftDelete = () => {
    softDelete.mutate(
      { id: tenantId, reason, confirmSlug },
      {
        onSuccess: () => {
          message.success("Компания удалена (soft). Восстановима 90 дней.");
          reset();
          onClose();
        },
        onError: (e: unknown) =>
          message.error(
            (e as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? "Не удалось удалить",
          ),
      },
    );
  };

  const doPurgeTest = () => {
    modal.confirm({
      title: "Удалить НЕМЕДЛЕННО и безвозвратно?",
      content:
        "Данные тестовой компании будут стёрты из БД без возможности восстановления.",
      okText: "Стереть навсегда",
      okButtonProps: { danger: true },
      cancelText: "Отмена",
      onOk: () =>
        purgeTest.mutateAsync({ id: tenantId, confirmSlug }).then(
          (r) => {
            message.success(`Стёрто безвозвратно (${r.totalRows} строк)`);
            reset();
            onClose();
          },
          (e: unknown) =>
            message.error(
              (e as { response?: { data?: { message?: string } } })?.response
                ?.data?.message ?? "Не удалось стереть",
            ),
        ),
    });
  };

  const slugOk = confirmSlug.trim() === slug;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`Удалить компанию «${name}»`}
      footer={null}
      destroyOnHidden
    >
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        <Alert
          type="warning"
          showIcon
          message="Последствия"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Вход в компанию сразу закрыт, сессии отозваны.</li>
              <li>Исчезает из списка и метрик.</li>
              <li>
                Через 90 дней данные удаляются физически (финансовый след
                хранится отдельно).
              </li>
            </ul>
          }
        />

        {impact && (
          <Text type="secondary">
            Затронуто: {impact.deals} сделок · {impact.clients} клиентов ·{" "}
            {impact.products} товаров · {impact.employees} сотрудников ·{" "}
            {impact.files} файлов.
          </Text>
        )}

        <div>
          <Text>Причина удаления (обязательно)</Text>
          <Input.TextArea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Например: закрыли бизнес / дубль / по запросу владельца"
          />
        </div>

        <div>
          <Text>
            Для подтверждения введите slug: <b>{slug}</b>
          </Text>
          <Input
            value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value)}
            placeholder={slug}
          />
        </div>

        <Space style={{ justifyContent: "flex-end", width: "100%" }}>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            danger
            type="primary"
            loading={softDelete.isPending}
            disabled={!slugOk || reason.trim().length < 3}
            onClick={doSoftDelete}
          >
            Удалить (soft, 90 дней)
          </Button>
        </Space>

        {isTest && (
          <>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              Компания помечена «тестовая» — можно стереть сразу, минуя 90 дней.
            </Paragraph>
            <Button
              danger
              block
              loading={purgeTest.isPending}
              disabled={!slugOk}
              onClick={doPurgeTest}
            >
              Удалить немедленно и безвозвратно
            </Button>
          </>
        )}
      </Space>
    </Modal>
  );
};
