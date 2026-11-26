import { useState } from "react";
import { App, Button, Card, Input, Modal, Progress, Space, Typography } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";

import { can } from "../api/client";
import {
  purgeTenantRecordings,
  useTenantRecordingsStorage,
  type RecordingsPurgeScope,
} from "../hooks";
import { count } from "../lib/format";
import { formatBytes } from "../types";

const { Text } = Typography;
const WORD = "удалить";

/**
 * Записи звонков компании в карточке: сколько места занимают и удаление
 * (старше 90/180 дней или всё). Перед удалением — «Будет удалено K записей,
 * X МБ»; «всё» — только после ввода слова «удалить». История звонков остаётся.
 */
export function TenantRecordingsCard({ tenantId }: { tenantId: string }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const q = useTenantRecordingsStorage(tenantId);
  const s = q.data;
  const allowed = can("recordings.purge");
  const [pending, setPending] = useState<{
    scope: RecordingsPurgeScope;
    count: number;
    bytes: number;
  } | null>(null);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  // Какая кнопка считает объём — крутится только она, а не все три.
  const [asking, setAsking] = useState<string | null>(null);

  const ask = async (scope: RecordingsPurgeScope) => {
    setAsking("all" in scope ? "all" : "olderThanDays" in scope ? String(scope.olderThanDays) : "other");
    setBusy(true);
    try {
      const r = await purgeTenantRecordings(tenantId, scope, true);
      if (!r.count) {
        message.info("Подходящих записей нет");
        return;
      }
      setWord("");
      setPending({ scope, count: r.count, bytes: r.bytes });
    } catch {
      message.error("Не удалось посчитать записи");
    } finally {
      setBusy(false);
      setAsking(null);
    }
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const r = await purgeTenantRecordings(tenantId, pending.scope, false);
      message.success(
        r.background
          ? "Удаление идёт в фоне"
          : `Удалено записей: ${r.deleted ?? r.count}, освобождено ${formatBytes(r.bytes)}`,
      );
      setPending(null);
      void qc.invalidateQueries({ queryKey: ["tenant-recordings", tenantId] });
      void qc.invalidateQueries({ queryKey: ["tenants"] });
      void qc.invalidateQueries({ queryKey: ["platform-recordings"] });
    } catch {
      message.error("Не удалось удалить записи");
    } finally {
      setBusy(false);
    }
  };

  const needWord = !!pending && "all" in pending.scope;
  return (
    <Card size="small" title="Записи звонков">
      {q.isLoading ? (
        <Text type="secondary">Загрузка…</Text>
      ) : q.isError || !s ? (
        <Text type="secondary">Нет данных</Text>
      ) : (
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Text>
            <b>{formatBytes(s.bytes)}</b> · {count(s.count)} шт.
            {s.oldestAt
              ? ` · самая старая ${new Date(s.oldestAt).toLocaleDateString("ru-RU")}`
              : ""}
          </Text>
          {s.purge?.running ? (
            <Progress
              size="small"
              percent={
                s.purge.total ? Math.round((s.purge.done / s.purge.total) * 100) : 0
              }
            />
          ) : null}
          {allowed && s.count ? (
            <Space wrap>
              {[90, 180].map((d) => (
                <Button
                  key={d}
                  size="small"
                  loading={asking === String(d)}
                  disabled={busy && asking !== String(d)}
                  onClick={() => void ask({ olderThanDays: d })}
                >
                  Удалить старше {d} дней
                </Button>
              ))}
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={asking === "all"}
                disabled={busy && asking !== "all"}
                onClick={() => void ask({ all: true, confirm: WORD })}
              >
                Удалить всё
              </Button>
            </Space>
          ) : null}
        </Space>
      )}
      <Modal
        open={!!pending}
        title={needWord ? "Удалить все записи компании?" : "Удалить записи?"}
        okText="Удалить"
        cancelText="Отмена"
        okButtonProps={{
          danger: true,
          loading: busy,
          disabled: needWord && word.trim().toLowerCase() !== WORD,
        }}
        onOk={() => void confirm()}
        onCancel={() => setPending(null)}
        destroyOnHidden
      >
        {pending ? (
          <Space orientation="vertical" style={{ width: "100%" }}>
            <Text strong>
              Будет удалено записей: {count(pending.count)}, {formatBytes(pending.bytes)}
            </Text>
            <Text type="secondary">
              Удаление необратимо. История звонков останется.
            </Text>
            {needWord ? (
              <>
                <Text>
                  Введите слово <b>{WORD}</b>, чтобы подтвердить
                </Text>
                <Input
                  autoFocus
                  autoComplete="off"
                  value={word}
                  status={word && word.trim().toLowerCase() !== WORD ? "error" : undefined}
                  onChange={(e) => setWord(e.target.value)}
                />
              </>
            ) : null}
          </Space>
        ) : null}
      </Modal>
    </Card>
  );
}
