import { Tag, Tooltip } from "antd";
import { usePlatformRecordingsStorage } from "../hooks";
import { formatBytes } from "../types";

/** Сколько места занимают записи звонков на всей платформе (+ топ компаний). */
export function PlatformRecordingsBadge() {
  const q = usePlatformRecordingsStorage();
  if (!q.data) return null;
  const top = q.data.tenants.slice(0, 10);
  return (
    <Tooltip
      title={
        top.length ? (
          <div>
            {top.map((t) => (
              <div key={t.tenantId}>
                {t.name}: {formatBytes(t.bytes)} ({t.count} шт.)
              </div>
            ))}
          </div>
        ) : (
          "Записей нет"
        )
      }
    >
      <Tag color="purple" style={{ cursor: "default" }}>
        Записи звонков: {formatBytes(q.data.bytes)} · {q.data.count} шт.
      </Tag>
    </Tooltip>
  );
}
