import { Tag, Tooltip } from "antd";
import { usePlatformRecordingsStorage } from "../hooks";
import { count } from "../lib/format";
import { formatBytes } from "../types";

/** Сколько места занимают записи звонков на всей платформе (+ топ компаний). */
export function PlatformRecordingsBadge() {
  const q = usePlatformRecordingsStorage();
  if (!q.data) return null;
  const top = q.data.tenants.slice(0, 10);
  return (
    <Tooltip
      trigger={["hover", "focus", "click"]}
      title={
        top.length ? (
          <div>
            {top.map((t) => (
              <div key={t.tenantId}>
                {t.name}: {formatBytes(t.bytes)} ({count(t.count)} шт.)
              </div>
            ))}
          </div>
        ) : (
          "Записей нет"
        )
      }
    >
      {/* tabIndex — подсказку можно открыть с клавиатуры, на телефоне — касанием. */}
      <Tag
        color="purple"
        tabIndex={0}
        role="note"
        style={{ cursor: "help" }}
        aria-label={`Записи звонков: ${formatBytes(q.data.bytes)}, ${count(q.data.count)} шт. Подробнее — в подсказке`}
      >
        Записи звонков: {formatBytes(q.data.bytes)} · {count(q.data.count)} шт.
      </Tag>
    </Tooltip>
  );
}
