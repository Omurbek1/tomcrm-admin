import { Button, Checkbox, Empty, Grid, Skeleton, Table } from "antd";
import type { TableProps } from "antd";
import { useState, type ReactNode } from "react";

/** Телефон: < 768 px — таблицы показываем карточками. */
export const useIsMobile = (): boolean => !Grid.useBreakpoint().md;

/**
 * Список карточек вместо таблицы на телефоне: каждая строка — карточка,
 * вся карточка нажимается (если есть onOpen). Без горизонтальной прокрутки;
 * длинный список — «Показать ещё» по 20.
 */
export function MobileCards<T>({
  rows,
  rowKey,
  render,
  onOpen,
  loading,
  emptyText = "Ничего нет",
  pageSize = 20,
}: {
  rows: T[];
  rowKey: (r: T) => string;
  render: (r: T) => ReactNode;
  onOpen?: (r: T) => void;
  loading?: boolean;
  emptyText?: string;
  pageSize?: number;
}) {
  const [limit, setLimit] = useState(pageSize);
  if (loading && !rows.length)
    return <Skeleton active paragraph={{ rows: 4 }} title={false} />;
  if (!rows.length)
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  return (
    <>
      <ul className="m-cards">
        {rows.slice(0, limit).map((r) => (
          <li key={rowKey(r)}>
            {onOpen ? (
              <div
                role="button"
                tabIndex={0}
                className="m-card is-tap"
                onClick={() => onOpen(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(r);
                  }
                }}
              >
                {render(r)}
              </div>
            ) : (
              <div className="m-card">{render(r)}</div>
            )}
          </li>
        ))}
      </ul>
      {rows.length > limit ? (
        <Button block style={{ marginTop: 8 }} onClick={() => setLimit((l) => l + pageSize)}>
          Показать ещё ({rows.length - limit})
        </Button>
      ) : null}
    </>
  );
}

/** Строка карточки: слева главное, справа значение/метка. */
export const MRow = ({
  main,
  side,
  sub,
}: {
  main: ReactNode;
  side?: ReactNode;
  sub?: ReactNode;
}) => (
  <div className="m-row">
    <div className="m-row-main">
      <div className="m-row-title">{main}</div>
      {sub ? <div className="m-row-sub">{sub}</div> : null}
    </div>
    {side ? <div className="m-row-side">{side}</div> : null}
  </div>
);

// ── Таблица, которая на телефоне становится карточками ───────────────────

type AnyCol<T> = {
  key?: React.Key;
  title?: ReactNode;
  dataIndex?: string | number | readonly (string | number)[];
  render?: (value: unknown, record: T, index: number) => ReactNode;
  hidden?: boolean;
};

const cellValue = <T,>(row: T, di: AnyCol<T>["dataIndex"]): unknown => {
  if (di == null) return undefined;
  const path = Array.isArray(di) ? di : [di];
  let v: unknown = row;
  for (const k of path) v = (v as Record<string | number, unknown> | null)?.[k as string];
  return v;
};

const isEmptyNode = (n: ReactNode) =>
  n === null || n === undefined || n === false || n === "" || n === "—";

/**
 * antd Table на компьютере; на телефоне — карточки: первый столбец —
 * заголовок карточки, остальные — «подпись: значение», столбцы без
 * заголовка (кнопки действий) — внизу карточки. onRow.onClick — нажатие
 * на карточку, rowSelection — галочка. Пустые значения не показываем.
 */
export function ResponsiveTable<T extends object>(
  props: TableProps<T> & { mobileEmptyText?: string },
) {
  const isMobile = useIsMobile();
  if (!isMobile) return <Table<T> {...props} />;
  const cols = ((props.columns ?? []) as AnyCol<T>[]).filter((c) => !c.hidden);
  const rows = [...((props.dataSource ?? []) as readonly T[])];
  const keyOf = (r: T, i: number): string => {
    const rk = props.rowKey;
    if (typeof rk === "function") return String(rk(r, i));
    return String((r as Record<string, unknown>)[(rk as string) ?? "key"] ?? i);
  };
  const sel = props.rowSelection;
  const selected = new Set((sel?.selectedRowKeys ?? []).map(String));
  const [head, ...rest] = cols;
  const fields = rest.filter((c) => !isEmptyNode(c.title as ReactNode));
  const actions = rest.filter((c) => isEmptyNode(c.title as ReactNode));
  const renderCell = (c: AnyCol<T>, r: T, i: number): ReactNode => {
    const v = cellValue(r, c.dataIndex);
    return c.render ? c.render(v, r, i) : (v as ReactNode);
  };
  return (
    <MobileCards<T>
      rows={rows}
      rowKey={(r) => keyOf(r, rows.indexOf(r))}
      loading={Boolean(props.loading)}
      emptyText={props.mobileEmptyText}
      onOpen={
        props.onRow
          ? (r) => {
              const h = props.onRow?.(r, rows.indexOf(r));
              h?.onClick?.({} as React.MouseEvent<HTMLElement>);
            }
          : undefined
      }
      render={(r) => {
        const i = rows.indexOf(r);
        const k = keyOf(r, i);
        const actionNodes = actions
          .map((c) => renderCell(c, r, i))
          .filter((n) => !isEmptyNode(n));
        return (
          <div className="rt-card">
            <div className="rt-head">
              {sel ? (
                <Checkbox
                  checked={selected.has(k)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selected, k]
                      : [...selected].filter((x) => x !== k);
                    sel.onChange?.(next, rows.filter((x, j) => next.includes(keyOf(x, j))), {
                      type: e.target.checked ? "single" : "single",
                    } as never);
                  }}
                />
              ) : null}
              <div className="rt-title">{head ? renderCell(head, r, i) : null}</div>
            </div>
            {fields.length ? (
              <dl className="rt-fields">
                {fields.map((c, j) => {
                  const node = renderCell(c, r, i);
                  if (isEmptyNode(node)) return null;
                  return (
                    <div key={String(c.key ?? c.dataIndex ?? j)}>
                      <dt>{c.title as ReactNode}</dt>
                      <dd>{node}</dd>
                    </div>
                  );
                })}
              </dl>
            ) : null}
            {actionNodes.length ? (
              <div className="rt-actions" onClick={(e) => e.stopPropagation()}>
                {actionNodes}
              </div>
            ) : null}
          </div>
        );
      }}
    />
  );
}
