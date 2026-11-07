import { Button, Checkbox, Empty, Grid, Skeleton, Table } from "antd";
import type { TableProps } from "antd";
import { useEffect, useState, type ReactNode } from "react";

/** Телефон: < 768 px — таблицы показываем карточками. */
export const useIsMobile = (): boolean => !Grid.useBreakpoint().md;

/**
 * Высота области прокрутки для виртуальной таблицы: от верха таблицы до
 * низа окна (bottomGap — отступ снизу), не меньше 360. Меряем по месту,
 * поэтому таблица под карточками/фильтрами не даёт двойной прокрутки.
 * Виртуальная таблица рисует только видимые строки — тысячи компаний
 * листаются без тормозов и без постраничной навигации.
 */
export const useListHeight = (
  bottomGap = 52,
): [(el: HTMLElement | null) => void, number] => {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [h, setH] = useState(480);
  useEffect(() => {
    if (!el) return;
    const measure = () => {
      // Высота задаётся телу таблицы — меряем от него (под заголовком).
      const body =
        el.querySelector<HTMLElement>(".ant-table-tbody-virtual-holder, .ant-table-body") ?? el;
      const top = body.getBoundingClientRect().top + window.scrollY;
      const next = Math.max(360, Math.round(window.innerHeight - top - bottomGap));
      setH((prev) => (Math.abs(prev - next) > 4 ? next : prev));
    };
    measure();
    // Высота шапки над таблицей меняется (загрузились карточки, фильтры
    // перенеслись) — пересчитываем, когда меняется размер страницы.
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [el, bottomGap]);
  return [setEl, h];
};

/**
 * Список карточек вместо таблицы на телефоне: каждая строка — карточка,
 * вся карточка нажимается (если есть onOpen). Без горизонтальной прокрутки;
 * длинный список — «Показать ещё» по 50 (карточки вне экрана браузер не
 * отрисовывает — content-visibility в index.css).
 */
export function MobileCards<T>({
  rows,
  rowKey,
  render,
  onOpen,
  loading,
  emptyText = "Ничего нет",
  pageSize = 50,
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
export function ResponsiveTable<T extends object>({
  virtualList,
  ...props
}: TableProps<T> & {
  mobileEmptyText?: string;
  /**
   * Длинный список на компьютере: виртуальная прокрутка вместо страниц.
   * x — общая ширина столбцов (виртуальной таблице нужна точная).
   */
  virtualList?: { x: number };
}) {
  const isMobile = useIsMobile();
  const [listRef, listHeight] = useListHeight();
  if (!isMobile) {
    const { mobileEmptyText: _m, ...tableProps } = props;
    void _m;
    if (!virtualList) return <Table<T> {...tableProps} />;
    return (
      <div ref={listRef}>
        <Table<T>
          {...tableProps}
          virtual
          pagination={false}
          scroll={{ x: virtualList.x, y: listHeight }}
        />
      </div>
    );
  }
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
