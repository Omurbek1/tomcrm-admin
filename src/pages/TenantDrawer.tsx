import {
  App,
  Alert,
  Drawer,
  Grid,
  Button,
  Card,
  Checkbox,
  Divider,
  Dropdown,
  Form,
  Tooltip,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Tree,
  Typography,
} from "antd";
import { MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { useState, type ReactNode } from "react";

import { can, CRM_URL } from "../api/client";
import { openAddSubscription } from "../components/AddSubscriptionModal";
import { tableLabel } from "../lib/dataTables";
import { actionLabel, auditDetails } from "../lib/auditText";
import { TenantRecordingsCard } from "./TenantRecordingsCard";
import {
  useAudit,
  useCancelPayment,
  useModuleCatalog,
  useExtendTrial,
  useImpersonate,
  useNotifications,
  usePayments,
  useApplyIndustryPreset,
  useIndustries,
  useResetOwnerPassword,
  useSendReminder,
  useSetContacts,
  useSetPriceOverride,
  useSetTenantIndustry,
  useSetStatus,
  useRestoreTenant,
  useSetTariff,
  useSetTenantAddons,
  useSetTenantModules,
  useSetTest,
  useTariffs,
  useTenant,
  useBillingJournal,
  useTenantDataVolume,
  useSetTenantCallLines,
  useTenantCallLines,
} from "../hooks";
import type { PaymentRow, TenantStatus } from "../types";
import {
  ADDON_META,
  SINGLE_ADDON_KEYS,
  AUDIT_FILTERS,
  LIMIT_META,
  MODULE_GROUPS_FALLBACK,
  NOTIF_STATUS_COLOR,
  PAYMENT_COLOR,
  PAYMENT_LABEL,
  REMINDER_TYPES,
  STATUS_DATA_POLICY,
  STATUS_LABEL,
} from "../types";
import { DeleteTenantModal } from "./DeleteTenantModal";

const { Text } = Typography;

const ruDate = (v: string | null | undefined): string =>
  v ? new Date(v).toLocaleDateString("ru-RU") : "—";

const METHOD_LABEL: Record<string, string> = {
  cash: "Наличные",
  transfer: "Перевод",
  card: "Карта",
  free: "Бесплатно",
};
const NOTIF_STATUS_LABEL: Record<string, string> = {
  sent: "Отправлено",
  failed: "Ошибка",
  skipped: "Пропущено",
  pending: "В очереди",
  duplicate: "Повтор",
};
const KIND_LABEL: Record<string, string> = {
  addon: "Докупка",
  order: "Заказ",
  plan_change: "Смена тарифа",
  topup: "Пополнение",
};

/** Откуда оплата: онлайн (Finik) / ручная со способом / старая ручная запись. */
const paymentOrigin = (p: PaymentRow): string => {
  const kind = p.kind && KIND_LABEL[p.kind] ? ` · ${KIND_LABEL[p.kind]}` : "";
  if (p.source === "online") return `Онлайн · Finik${kind}`;
  if (p.source === "manual")
    return `Вручную · ${METHOD_LABEL[p.method ?? ""] ?? "перевод"}`;
  return "Вручную";
};

interface Props {
  tenantId: string | null;
  onClose: () => void;
}


/** Линии звонков компании: сколько звонков одновременно (часть подписки). */
const CallLinesBlock = ({ tenantId }: { tenantId: string }) => {
  const { message } = App.useApp();
  const q = useTenantCallLines(tenantId);
  const save = useSetTenantCallLines();
  const [draft, setDraft] = useState<number | null | undefined>(undefined);
  if (q.isError || !q.data) return null;
  const d = q.data;
  const value = draft === undefined ? d.limit : draft;
  const editable = can("calls.manage");
  const submit = (limit: number | null) =>
    save.mutate(
      { id: tenantId, limit },
      {
        onSuccess: () => {
          setDraft(undefined);
          message.success("Линии звонков сохранены");
        },
        onError: (e: unknown) =>
          message.error(
            (e as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? "Не удалось сохранить",
          ),
      },
    );
  return (
    <div>
      <Text strong>Линии звонков</Text>
      <div style={{ fontSize: 12, color: "var(--text-3)", margin: "2px 0 6px" }}>
        Сколько звонков компания может вести одновременно. Сейчас:{" "}
        <b>{d.effective}</b>
        {d.limit == null ? " (по умолчанию платформы)" : ""}
        {d.used != null ? ` · занято ${d.used}` : ""} · максимум платформы{" "}
        {d.platformCap}.
      </div>
      <Space.Compact style={{ maxWidth: 360, width: "100%" }}>
        <InputNumber<number>
          min={1}
          max={100}
          style={{ width: "100%" }}
          placeholder={`по умолчанию: ${d.defaultLimit}`}
          disabled={!editable}
          value={value ?? undefined}
          onChange={(v) => setDraft(v ?? null)}
        />
        <Button
          type="primary"
          disabled={!editable || draft === undefined}
          loading={save.isPending}
          onClick={() => submit(draft ?? null)}
        >
          Сохранить
        </Button>
        {d.limit != null ? (
          <Button
            disabled={!editable}
            onClick={() => submit(null)}
            loading={save.isPending}
          >
            По умолчанию
          </Button>
        ) : null}
      </Space.Compact>
    </div>
  );
};

export const TenantDrawer = ({ tenantId, onClose }: Props) => {
  const { message, modal } = App.useApp();
  const isMobile = !Grid.useBreakpoint().md;
  const { data, isLoading, isError, refetch } = useTenant(tenantId);
  const { data: billingJournal } = useBillingJournal(tenantId);
  const { data: dataVolume } = useTenantDataVolume(tenantId, !!tenantId);
  // п.6: активная вкладка синхронизируется с URL (?tab=…).
  const [activeTab, setActiveTab] = useState<string>(() => {
    const t0 = new URLSearchParams(window.location.search).get("tab") ?? "";
    // Старые ссылки (?tab=tariff/billing/journal) ведут на новые вкладки.
    const legacy: Record<string, string> = {
      tariff: "subscription",
      billing: "subscription",
      journal: "history",
    };
    const k = legacy[t0] ?? t0;
    return ["overview", "subscription", "modules", "history"].includes(k)
      ? k
      : "overview";
  });
  const onTabChange = (k: string) => {
    setActiveTab(k);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", k);
    window.history.replaceState(null, "", url.toString());
  };
  const { data: tariffs } = useTariffs();
  const [auditFilter, setAuditFilter] = useState(0);
  const [auditLimit, setAuditLimit] = useState(20);
  const { data: audit } = useAudit(tenantId ?? undefined, {
    actions: AUDIT_FILTERS[auditFilter].actions,
    limit: auditLimit,
  });
  const [payPage, setPayPage] = useState(1);
  const { data: paymentsResp } = usePayments(tenantId, payPage, 10);
  const { data: notifications } = useNotifications(tenantId);
  const sendReminder = useSendReminder();
  const setStatus = useSetStatus();
  const extendTrial = useExtendTrial();
  const setTariff = useSetTariff();
  const setContacts = useSetContacts();
  const cancelPayment = useCancelPayment();
  const setPrice = useSetPriceOverride();
  const setAddons = useSetTenantAddons();
  const setModules = useSetTenantModules();
  const setTest = useSetTest();
  const industriesQ = useIndustries();
  const setIndustry = useSetTenantIndustry();
  const applyPreset = useApplyIndustryPreset();
  const resetOwnerPw = useResetOwnerPassword();
  // Единый источник — группы/разделы/аддоны с бэка; хардкод только фолбэк.
  const { data: moduleCatalog } = useModuleCatalog();
  const groups = moduleCatalog?.groups ?? MODULE_GROUPS_FALLBACK;
  const addonMeta = moduleCatalog?.addons ?? ADDON_META;
  const allSectionKeys = groups.flatMap((g) => g.sections.map((s) => s.key));
  // Сколько модулей включено у компании (эффективный набор) — для бейджа вкладки.
  const moduleOnCount = allSectionKeys.filter(
    (k) => data?.modules?.[k] !== false,
  ).length;
  // Override = эффективный набор компании ОТЛИЧАЕТСЯ от тарифа (сравниваем
  // effective vs plan, а не только явный override-словарь — он может быть пуст,
  // а отличие всё равно есть). Помечаем такие модули в дереве.
  const isOverride = (k: string) =>
    (data?.modules?.[k] !== false) !== (data?.tariffModules?.[k] !== false);
  const overrideKeys = new Set(allSectionKeys.filter(isOverride));
  const overrideCount = overrideKeys.size;
  // п.17: поиск по модулям + управление раскрытием групп.
  const [moduleSearch, setModuleSearch] = useState("");
  const [moduleExpanded, setModuleExpanded] = useState<string[] | null>(null);
  const q = moduleSearch.trim().toLowerCase();
  const matchesSearch = (label: string) =>
    !q || label.toLowerCase().includes(q);
  // Подпись листа: название (+ «всегда» для always-on) + бейдж override.
  const leafTitle = (s: { key: string; label: string; alwaysOn?: boolean }) => (
    <span>
      {s.alwaysOn ? `${s.label} · всегда` : s.label}
      {overrideKeys.has(s.key) && (
        <Tooltip title="Отличается от тарифа — включено или выключено вручную для этой компании">
          <Tag
            color="gold"
            style={{ marginLeft: 6, fontSize: 12, lineHeight: "18px", padding: "0 6px" }}
          >
            изменено
          </Tag>
        </Tooltip>
      )}
    </span>
  );
  type TreeNode = {
    key: string;
    title: ReactNode;
    disabled?: boolean;
    children?: TreeNode[];
  };
  const moduleTreeData: TreeNode[] = groups.flatMap((g): TreeNode[] => {
    // п.15: группа из одного раздела («Аналитика → Аналитика») — одной строкой.
    if (g.sections.length === 1) {
      const s = g.sections[0];
      return matchesSearch(s.label)
        ? [{ key: s.key, title: leafTitle(s), disabled: s.alwaysOn }]
        : [];
    }
    // п.17: фильтр по поиску; группа без совпадений — скрыта.
    const secs = g.sections.filter((s) => matchesSearch(s.label));
    if (!secs.length) return [];
    // п.16: у группы — «N из M» включённых (по эффективному набору компании).
    const enabled = g.sections.filter(
      (s) => data?.modules?.[s.key] !== false,
    ).length;
    return [
      {
        key: `grp:${g.key}`,
        title: (
          <span>
            {g.label}{" "}
            <Text type="secondary" style={{ fontSize: 12 }}>
              · {enabled} из {g.sections.length}
            </Text>
          </span>
        ),
        children: secs.map((s) => ({
          key: s.key,
          title: leafTitle(s),
          disabled: s.alwaysOn,
        })),
      },
    ];
  });
  // Ключи групп (только многосекционные — одиночные свёрнуты в лист).
  const groupTreeKeys = groups
    .filter((g) => g.sections.length > 1)
    .map((g) => `grp:${g.key}`);
  // По умолчанию свёрнуто, кроме групп с override; при поиске — раскрыты все.
  const overrideGroupKeys = groups
    .filter(
      (g) =>
        g.sections.length > 1 && g.sections.some((s) => overrideKeys.has(s.key)),
    )
    .map((g) => `grp:${g.key}`);
  const moduleExpandedKeys = q
    ? groupTreeKeys
    : (moduleExpanded ?? overrideGroupKeys);
  const impersonate = useImpersonate();
  const [addonDraft, setAddonDraft] = useState<Record<string, number> | null>(
    null,
  );
  // Включённые разделы (листья). null = не редактировали (показываем эффективные).
  const [moduleChecked, setModuleChecked] = useState<string[] | null>(null);
  const [contactForm] = Form.useForm();
  const contactPhone = Form.useWatch("contactPhone", contactForm);
  const contactEmail = Form.useWatch("contactEmail", contactForm);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const restoreTenant = useRestoreTenant();
  const [priceDraft, setPriceDraft] = useState<string>("");
  const [industryDraft, setIndustryDraft] = useState<string | null>(null);

  const savePrice = (price: number | null) => {
    if (!t) return;
    setPrice.mutate(
      { id: t.id, price },
      {
        onSuccess: () =>
          message.success(price === null ? "Сброшено" : "Цена сохранена"),
        onError: () => message.error("Не удалось сохранить цену"),
      },
    );
  };

  const t = data?.tenant;
  const tariff = tariffs?.find((tf) => tf.id === t?.tariffId);

  // п.5: сохранения полей извлечены в функции — их вызывает единая панель
  // «Сохранить» в футере (и подтверждение п.19 при отключении разделов с данными).
  const saveModules = (): void => {
    if (!t || !data || !moduleChecked) return;
    const desired = moduleChecked;
    const override: Record<string, boolean> = {};
    for (const k of allSectionKeys) {
      const want = desired.includes(k);
      const byTariff = data.tariffModules?.[k] !== false;
      if (want !== byTariff) override[k] = want;
    }
    const doSave = () =>
      setModules.mutate(
        { id: t.id, modules: override },
        {
          onSuccess: () => {
            message.success("Модули компании сохранены");
            setModuleChecked(null);
          },
          onError: () => message.error("Не удалось сохранить"),
        },
      );
    const dataMod: Record<string, string> = {
      "3": "products",
      "18": "products",
      "4": "users",
      "8": "branches",
    };
    const labelOf = (k: string) =>
      groups.flatMap((g) => g.sections).find((s) => s.key === k)?.label ?? k;
    const offWithData = allSectionKeys.filter((k) => {
      const want = desired.includes(k);
      const nowOn = data.modules[k] !== false;
      const uk = dataMod[k];
      return nowOn && !want && uk && (data.usage?.[uk] ?? 0) > 0;
    });
    if (offWithData.length) {
      modal.confirm({
        title: "Отключить разделы с данными?",
        content: `Данные сохранятся, разделы скроются: ${offWithData
          .map(labelOf)
          .join(", ")}.`,
        okText: "Отключить",
        okButtonProps: { danger: true },
        cancelText: "Отмена",
        onOk: doSave,
      });
    } else {
      doSave();
    }
  };

  const saveAddons = (): void => {
    if (!t || !addonDraft) return;
    setAddons.mutate(
      { id: t.id, addons: addonDraft },
      {
        onSuccess: () => {
          message.success("Аддоны сохранены");
          setAddonDraft(null);
        },
        onError: () => message.error("Не удалось сохранить"),
      },
    );
  };

  // Единый dirty-подсчёт: цена / модули / аддоны.
  const savedOverride = t?.priceOverride ? Number(t.priceOverride) : null;
  const draftPrice = priceDraft === "" ? null : Number(priceDraft);
  const priceDirty = priceDraft !== "" && draftPrice !== savedOverride;
  const modulesDirty = moduleChecked !== null;
  const addonsDirty = addonDraft !== null;
  // Контакты тоже черновик: правку не теряем молча при закрытии карточки.
  const contactsDirty =
    !!t &&
    contactPhone !== undefined &&
    ((contactPhone ?? "") !== (t.contactPhone ?? "") ||
      (contactEmail ?? "") !== (t.contactEmail ?? ""));
  const dirtyLabels = [
    priceDirty && "цена",
    modulesDirty && "модули",
    addonsDirty && "опции",
    contactsDirty && "контакты",
  ].filter(Boolean) as string[];
  const dirtyCount = dirtyLabels.length;
  const saveAll = () => {
    if (priceDirty) savePrice(draftPrice);
    if (modulesDirty) saveModules();
    if (addonsDirty) saveAddons();
    if (contactsDirty) contactForm.submit();
  };
  const cancelAll = () => {
    setPriceDraft("");
    setModuleChecked(null);
    setAddonDraft(null);
    contactForm.setFieldsValue({
      contactPhone: t?.contactPhone ?? "",
      contactEmail: t?.contactEmail ?? "",
    });
  };
  // п.21: закрытие (Esc / клик по подложке / крестик) при грязном — с подтверждением.
  const requestClose = () => {
    if (dirtyCount > 0) {
      modal.confirm({
        title: "Несохранённые изменения",
        content: `Изменено: ${dirtyCount} (${dirtyLabels.join(
          " · ",
        )}). Закрыть без сохранения?`,
        okText: "Закрыть",
        okButtonProps: { danger: true },
        cancelText: "Остаться",
        onOk: () => {
          cancelAll();
          onClose();
        },
      });
    } else {
      onClose();
    }
  };

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("ru-RU") : "—";
  // Деньги в интерфейсе — локализованно «5 000 сом» (неразрывные пробелы);
  // код валюты (KGS) оставляем для CSV/API.
  const fmtMoney = (n: number | string | null | undefined) => {
    const v = Number(n ?? 0);
    return `${v.toLocaleString("ru-RU").replace(/\s/g, " ")} сом`;
  };

  // Сообщение уходит клиенту — всегда спрашиваем и показываем получателя.
  const confirmReminder = (type: string, label: string) => {
    if (!t) return;
    modal.confirm({
      title: "Отправить уведомление?",
      content: `«${label}» получателю: ${
        t.contactPhone || t.contactEmail || "контакт не указан"
      }`,
      okText: "Отправить",
      cancelText: "Отмена",
      onOk: () => doSendReminder(type),
    });
  };

  const doSendReminder = (type: string) => {
    if (!t) return;
    sendReminder.mutate(
      { id: t.id, type },
      {
        onSuccess: (r) => {
          if (r.status === "sent") message.success("Отправлено");
          else if (r.status === "skipped")
            message.warning(`Пропущено: ${r.detail ?? "нет условий"}`);
          else message.error(`Не отправлено: ${r.detail ?? r.status}`);
        },
        onError: () => message.error("Ошибка отправки"),
      },
    );
  };

  const applyStatus = (status: string, onDone?: () => void) => {
    if (!t) return;
    setStatus.mutate(
      { id: t.id, status },
      {
        onSuccess: () => {
          message.success("Статус обновлён");
          onDone?.();
        },
        onError: () => message.error("Не удалось сменить статус"),
      },
    );
  };

  const changeStatus = (status: string) => {
    if (!t) return;
    // Заморозка/удаление — с подтверждением и пояснением о судьбе данных.
    if (status === "deleted" || status === "blocked") {
      modal.confirm({
        title: status === "deleted" ? "Удалить компанию?" : "Заморозить компанию?",
        content:
          STATUS_DATA_POLICY[status as TenantStatus] ??
          "Сменить статус компании?",
        okText: status === "deleted" ? "Удалить" : "Заморозить",
        okButtonProps: { danger: true },
        cancelText: "Отмена",
        onOk: () => applyStatus(status),
      });
      return;
    }
    applyStatus(status);
  };

  const doImpersonate = () => {
    if (!t) return;
    impersonate.mutate(t.id, {
      onSuccess: (r) => {
        // Открываем CRM с токеном владельца в hash — CRM подхватит и войдёт.
        window.open(
          `${CRM_URL}/#impersonate=${encodeURIComponent(r.token)}`,
          "_blank",
          "noopener",
        );
      },
      onError: (e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Не удалось войти под владельцем";
        message.error(msg);
      },
    });
  };

  const doResetOwnerPassword = () => {
    if (!t) return;
    modal.confirm({
      title: "Сбросить пароль владельца?",
      content:
        "Сгенерируем новый временный пароль и завершим активные сессии владельца. Пароль покажем один раз — передайте его клиенту.",
      okText: "Сбросить",
      okButtonProps: { danger: true },
      cancelText: "Отмена",
      onOk: () =>
        resetOwnerPw.mutate(
          { id: t.id },
          {
            onSuccess: (r) =>
              modal.info({
                title: "Новый пароль владельца",
                content: (
                  <div>
                    <div>
                      Владелец: <b>{r.email ?? r.name}</b>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      Пароль:{" "}
                      <Text copyable strong code>
                        {r.password}
                      </Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Скопируйте — больше он не будет показан.
                    </Text>
                  </div>
                ),
              }),
            onError: () => message.error("Не удалось сбросить пароль"),
          },
        ),
    });
  };

  const addDays = (days: number) => {
    if (!t) return;
    extendTrial.mutate(
      { id: t.id, days },
      {
        // Сервер не даёт уйти дальше 3 дней от сегодня — показываем итог.
        onSuccess: (r) =>
          message.success(
            `Триал до ${r.trialEndsAt ? new Date(r.trialEndsAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}`,
          ),
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? "Не удалось продлить триал";
          message.error(msg);
        },
      },
    );
  };

  const changeTariff = (tariffId: string) => {
    if (!t) return;
    const apply = () =>
      setTariff.mutate(
        { id: t.id, tariffId },
        {
          onSuccess: () => message.success("Тариф изменён"),
          onError: () => message.error("Не удалось сменить тариф"),
        },
      );
    // п.13: показываем, как изменится набор модулей + предупреждаем про override.
    const newMods = tariffs?.find((tf) => tf.id === tariffId)?.modules ?? {};
    const labelOf = (k: string) =>
      groups.flatMap((g) => g.sections).find((s) => s.key === k)?.label ?? k;
    const willDisable = allSectionKeys.filter(
      (k) =>
        data?.modules?.[k] !== false &&
        newMods[k] === false &&
        !overrideKeys.has(k),
    );
    const newCount = allSectionKeys.filter((k) => newMods[k] !== false).length;
    const curCount = allSectionKeys.filter(
      (k) => data?.modules?.[k] !== false,
    ).length;
    // Тариф меняется сразу (не черновик) и влияет на цену — спрашиваем всегда
    // и показываем, что изменится: цену, модули, индивидуальные правки.
    const next = tariffs?.find((tf) => tf.id === tariffId);
    const priceOf = (p?: string | number | null) =>
      p == null ? "—" : fmtMoney(p);
    const curPrice = t.priceOverride ?? tariff?.price;
    modal.confirm({
      title: `Сменить тариф на «${next?.name ?? "новый"}»?`,
      content: (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          <li>
            Цена в месяц: {priceOf(curPrice)} → <b>{priceOf(next?.price)}</b>
            {t.priceOverride != null && t.priceOverride !== ""
              ? " (сейчас индивидуальная — останется, проверьте её)"
              : ""}
          </li>
          <li>
            Модулей: {curCount} → <b>{newCount}</b>
            {willDisable.length
              ? `, отключатся: ${willDisable.map(labelOf).join(", ")}`
              : ""}
          </li>
          {overrideCount > 0 ? (
            <li>
              У компании есть индивидуальные правки модулей — проверьте их
              после смены.
            </li>
          ) : null}
          <li>Применится сразу, без кнопки «Сохранить».</li>
        </ul>
      ),
      okText: "Сменить тариф",
      cancelText: "Отмена",
      onOk: apply,
    });
  };

  const saveContacts = (v: { contactPhone?: string; contactEmail?: string }) => {
    if (!t) return;
    setContacts.mutate(
      {
        id: t.id,
        contactPhone: v.contactPhone ?? "",
        contactEmail: v.contactEmail ?? "",
      },
      {
        onSuccess: () => message.success("Контакты сохранены"),
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? "Не удалось сохранить";
          message.error(msg);
        },
      },
    );
  };

  const noContacts = t && !t.contactPhone && !t.contactEmail;

  // Статус — ВЫЧИСЛЯЕМЫЙ (оплачено/триал/истёк/просрочено/заморожена/удалена),
  // руками не меняется (только заморозка/разморозка/продление триала).
  const statusBadge = t
    ? t.deletedAt || t.status === "deleted"
      ? { label: "Удалена", color: "default" as const }
      : t.status === "blocked"
        ? { label: "Заморожена", color: "red" as const }
        : t.paymentStatus === "overdue"
          ? { label: "Просрочено", color: "volcano" as const }
          : t.status === "active"
            ? { label: "Оплачено", color: "green" as const }
            : t.status === "trial"
              ? t.trialDaysLeft <= 0
                ? { label: "Триал истёк", color: "orange" as const }
                : { label: `Триал · ${t.trialDaysLeft} дн.`, color: "blue" as const }
              : { label: STATUS_LABEL[t.status], color: "default" as const }
    : { label: "", color: "default" as const };

  // «Добавить подписку» — общее окно панели (то же, что в «Подписках»/Ctrl+K).
  const openPay = () => {
    if (t) openAddSubscription(t.id);
  };
  const isTrial = !!t && t.status === "trial";
  // Общий триал — не больше 3 дней от сегодня (запас в час, как на сервере).
  const trialAtMax =
    !!t?.trialEndsAt &&
    new Date(t.trialEndsAt).getTime() >= Date.now() + 3 * 86_400_000 - 3_600_000;

  // Деструктив (заморозка/удаление) — подтверждение с вводом slug вручную.
  const [danger, setDanger] = useState<null | "freeze" | "delete">(null);
  const [confirmSlug, setConfirmSlug] = useState("");
  const openDanger = (kind: "freeze" | "delete") => {
    setConfirmSlug("");
    setDanger(kind);
  };
  // Ввод адреса — уже подтверждение: второй вопрос не задаём, окно ждёт
  // ответа сервера (крутилка на кнопке) и закрывается только при успехе.
  const runDanger = () => {
    if (!t) return;
    applyStatus(danger === "delete" ? "deleted" : "blocked", () =>
      setDanger(null),
    );
  };

  return (
    <Drawer
      open={!!tenantId}
      onClose={requestClose}
      placement="right"
      size={isMobile ? "100%" : 960}
      destroyOnHidden
      title={
        t ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                flex: "none",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 18,
                background: "linear-gradient(135deg,#2a78d6,#4a3aa7)",
              }}
            >
              {t.name?.trim()?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.15 }}>
                {t.name}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginTop: 3,
                }}
              >
                {statusBadge.label && (
                  <Tag color={statusBadge.color} style={{ margin: 0 }}>
                    {statusBadge.label}
                  </Tag>
                )}
                <Text
                  type="secondary"
                  copyable={{ text: t.slug, tooltips: ["Скопировать адрес", "Скопировано"] }}
                  style={{ fontSize: 12, fontFamily: "monospace" }}
                >
                  /{t.slug}
                </Text>
                {t.isTest ? (
                  <Tag color="purple" style={{ margin: 0 }}>
                    тест
                  </Tag>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          "Компания"
        )
      }
      footer={
        dirtyCount > 0 ? (
          <div
            style={{ display: "flex", alignItems: "center", gap: 12 }}
            role="region"
            aria-label="Несохранённые изменения"
          >
            <Text strong>Изменено: {dirtyCount}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dirtyLabels.join(" · ")}
            </Text>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <Button onClick={cancelAll}>Отменить</Button>
              <Button
                type="primary"
                loading={
                  setPrice.isPending ||
                  setModules.isPending ||
                  setAddons.isPending
                }
                onClick={saveAll}
              >
                Сохранить
              </Button>
            </div>
          </div>
        ) : null
      }
      styles={{
        header: { paddingBlock: 12 },
        body: { padding: "12px 20px 20px" },
      }}
    >
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} style={{ padding: 8 }} />
      ) : isError || !t || !data ? (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Text type="secondary">Не удалось загрузить компанию.</Text>
          <br />
          <Button
            style={{ marginTop: 8 }}
            loading={isLoading}
            onClick={() => refetch()}
          >
            Повторить
          </Button>
        </div>
      ) : (
        <>
          {/* Действия: частые — кнопками, опасные — в «⋯». */}
          <div className="card-actions">
            <Button
              type="primary"
              disabled={t.status === "deleted" || !can("impersonate")}
              onClick={doImpersonate}
            >
              Войти под владельцем ↗
            </Button>
            <Button
              disabled={!can("billing.edit") || t.status === "deleted"}
              onClick={openPay}
            >
              {isTrial ? "Оформить подписку" : "Продлить подписку"}
            </Button>
            {isTrial ? (
              <Tooltip
                title={
                  trialAtMax
                    ? "Триал уже максимальный — 3 дня от сегодня"
                    : "Не дальше чем на 3 дня от сегодня"
                }
              >
                <Button
                  loading={extendTrial.isPending}
                  disabled={trialAtMax}
                  onClick={() => addDays(3)}
                >
                  +3 дн. триала
                </Button>
              </Tooltip>
            ) : null}
            <Dropdown
              trigger={["click"]}
              disabled={!can("tenants.notify") || t.status === "deleted"}
              menu={{
                items: REMINDER_TYPES.map((rt) => ({
                  key: rt.value,
                  label: rt.label,
                  onClick: () => confirmReminder(rt.value, rt.label),
                })),
              }}
            >
              <Button loading={sendReminder.isPending}>Напомнить ▾</Button>
            </Dropdown>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  {
                    key: "reset-pw",
                    label: "Сбросить пароль владельца",
                    disabled: !can("impersonate") || !data?.owner,
                    onClick: doResetOwnerPassword,
                  },
                  { type: "divider" },
                  {
                    key: "freeze",
                    danger: true,
                    disabled: t.status === "deleted" || !can("tenants.block"),
                    label:
                      t.status === "blocked"
                        ? "Разморозить компанию"
                        : "Заморозить компанию",
                    onClick: () =>
                      t.status === "blocked"
                        ? modal.confirm({
                            title: "Разморозить компанию?",
                            content: "Доступ восстановится сразу.",
                            okText: "Разморозить",
                            onOk: () => changeStatus("active"),
                          })
                        : openDanger("freeze"),
                  },
                  ...(t.status === "deleted"
                    ? [
                        {
                          key: "restore",
                          disabled: !can("tenants.delete"),
                          label: "Восстановить компанию",
                          onClick: () =>
                            modal.confirm({
                              title: "Восстановить компанию?",
                              content: "Доступ и данные вернутся, статус станет «активна».",
                              okText: "Восстановить",
                              onOk: () =>
                                restoreTenant.mutateAsync({ id: t.id }).then(
                                  () => message.success("Компания восстановлена"),
                                  () => message.error("Не удалось восстановить"),
                                ),
                            }),
                        },
                      ]
                    : [
                        {
                          key: "delete",
                          danger: true,
                          disabled: !can("tenants.delete"),
                          label: "Удалить компанию",
                          onClick: () => setDeleteOpen(true),
                        },
                      ]),
                ],
              }}
            >
              <Tooltip title="Ещё: пароль, заморозка, удаление">
                <Button icon={<MoreOutlined />} aria-label="Ещё действия" />
              </Tooltip>
            </Dropdown>
          </div>

          {noContacts && (
            <Alert
              type="warning"
              showIcon
              style={{ margin: "8px 0" }}
              title="Нет контактов — некому написать при истечении триала. Заполните телефон/email ниже."
            />
          )}

          <Tabs
            activeKey={activeTab}
            onChange={onTabChange}
            className="tenant-card-tabs"
            items={[
              {
                label: "Обзор",
                key: "overview",
                children: (
                  <>
          {/* Главное о компании — одной таблицей, без повторов. */}
          <dl className="facts">
            <div>
              <dt>Тариф</dt>
              <dd>
                {t.tariffName || "—"}
                <span className="facts-sub">
                  {fmtMoney(data.monthlyPrice)} в месяц
                  {t.priceOverride != null ? " · индивидуальная цена" : ""}
                </span>
              </dd>
            </div>
            {isTrial ? (
              <div>
                <dt>Триал</dt>
                <dd className={t.trialDaysLeft <= 0 ? "is-bad" : undefined}>
                  {t.trialDaysLeft > 0
                    ? `ещё ${t.trialDaysLeft} дн.`
                    : "истёк"}
                  <span className="facts-sub">до {ruDate(t.trialEndsAt)}</span>
                </dd>
              </div>
            ) : (
              <div>
                <dt>Оплачено до</dt>
                <dd className={t.paymentStatus === "overdue" ? "is-bad" : undefined}>
                  {ruDate(t.paidUntil)}
                  <span className="facts-sub">
                    следующее списание {ruDate(t.nextChargeAt)}
                  </span>
                </dd>
              </div>
            )}
            <div>
              <dt>Владелец</dt>
              <dd>
                {data.owner?.name ?? "—"}
                <span className="facts-sub">
                  {[
                    data.owner?.email,
                    data.owner?.lastLoginAt
                      ? `входил ${ruDate(data.owner.lastLoginAt)}`
                      : "ни разу не входил",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </dd>
            </div>
            <div>
              <dt>Отрасль</dt>
              <dd>{data.industry?.name ?? "—"}</dd>
            </div>
            <div>
              <dt>Размер</dt>
              <dd>
                {(t.employees ?? 0).toLocaleString("ru-RU")} сотр.
                <span className="facts-sub">
                  {(t.deals ?? 0).toLocaleString("ru-RU")} сделок
                </span>
              </dd>
            </div>
            <div>
              <dt>Создана</dt>
              <dd>
                {ruDate(t.createdAt)}
                <span className="facts-sub">
                  <Tooltip title="Не учитывается в MRR, конверсии и аналитике">
                    <Checkbox
                      checked={t.isTest}
                      style={{ fontSize: 12 }}
                      onChange={(e) =>
                        setTest.mutate(
                          { id: t.id, isTest: e.target.checked },
                          { onError: () => message.error("Не удалось") },
                        )
                      }
                    >
                      тестовая
                    </Checkbox>
                  </Tooltip>
                </span>
              </dd>
            </div>
          </dl>

          <div
            style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}
          >
            {/* Записи звонков: объём и очистка */}
            <TenantRecordingsCard tenantId={t.id} />

            {/* Контакты (редактируемые) */}
            <Card size="small" title="Контакты">
              <Form
                form={contactForm}
                layout="vertical"
                onFinish={saveContacts}
                initialValues={{
                  contactPhone: t.contactPhone ?? "",
                  contactEmail: t.contactEmail ?? "",
                }}
              >
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Form.Item
                    name="contactPhone"
                    label="Телефон"
                    style={{ flex: 1, minWidth: 180 }}
                  >
                    <Input placeholder="+996 ..." />
                  </Form.Item>
                  <Form.Item
                    name="contactEmail"
                    label="Email"
                    style={{ flex: 1, minWidth: 180 }}
                  >
                    <Input placeholder="mail@company.kg" />
                  </Form.Item>
                </div>
                <Button
                  htmlType="submit"
                  loading={setContacts.isPending}
                  disabled={!contactsDirty}
                  size="small"
                >
                  Сохранить контакты
                </Button>
              </Form>
            </Card>

            {/* Объём данных (мониторинг: кто занимает место) */}
            <Card
              size="small"
              title="Сколько данных у компании"
              extra={
                dataVolume ? (
                  <Text type="secondary">
                    всего {dataVolume.totalRows.toLocaleString("ru-RU")} записей
                  </Text>
                ) : null
              }
            >
              {dataVolume ? (
                <>
                  <ul className="vol-list">
                    {dataVolume.top.slice(0, 8).map((r) => {
                      const l = tableLabel(r.table);
                      const max = dataVolume.top[0]?.rows || 1;
                      return (
                        <li key={r.table} className={l.service ? "is-service" : undefined}>
                          <Tooltip title={l.service ? `Служебное · ${l.raw}` : l.raw}>
                            <span className="vol-name">{l.label}</span>
                          </Tooltip>
                          <span className="vol-num">{r.rows.toLocaleString("ru-RU")}</span>
                          <span className="vol-bar">
                            <i style={{ width: `${Math.max(2, (r.rows / max) * 100)}%` }} />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="form-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                    Самые большие разделы. Серым — служебные записи системы
                    (ключи, журналы), компания их не вводит.
                  </div>
                </>
              ) : (
                <Text type="secondary">Считаем…</Text>
              )}
            </Card>
          </div>

                  </>
                ),
              },
              {
                label: "Подписка",
                key: "subscription",
                children: (
                  <>
          {/* Секция 1: Тариф и цена */}
          <Divider titlePlacement="start" style={{ marginTop: 0 }}>
            Тариф и цена
          </Divider>
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <div>
              <Text strong>Тариф</Text>
              <br />
              <Select
                value={t.tariffId ?? undefined}
                placeholder="Выбрать тариф"
                style={{ width: "100%", marginTop: 4 }}
                onChange={changeTariff}
                disabled={!can("tenants.tariff")}
                loading={setTariff.isPending}
                options={(tariffs ?? [])
                  .filter((tf) => !tf.archived || tf.id === t.tariffId)
                  .map((tf) => ({
                    value: tf.id,
                    label: `${tf.name} (${tf.code})${tf.archived ? " · архив" : ""}`,
                  }))}
              />
            </div>

            <div>
              <Text strong>Индивидуальная цена, сом/мес</Text>
              <br />
              <Space.Compact style={{ width: "100%", marginTop: 4 }}>
                <InputNumber
                  min={0}
                  max={100_000_000}
                  style={{ width: "100%" }}
                  placeholder={
                    tariff ? String(Number(tariff.price)) : "по тарифу"
                  }
                  value={
                    priceDraft !== ""
                      ? Number(priceDraft)
                      : t.priceOverride
                        ? Number(t.priceOverride)
                        : undefined
                  }
                  onChange={(v) => setPriceDraft(v == null ? "" : String(v))}
                />
                {(t.priceOverride || priceDraft !== "") && (
                  <Button
                    onClick={() => {
                      setPriceDraft("");
                      savePrice(null);
                    }}
                  >
                    Сброс
                  </Button>
                )}
              </Space.Compact>
              <div style={{ fontSize: 12, marginTop: 2 }}>
                <Text type="secondary">
                  Эффективно (MRR): <b>{fmtMoney(data.monthlyPrice)}</b> · база
                  тарифа {fmtMoney(data.tariffPrice)}
                </Text>
                {t.priceOverride &&
                  Number(t.priceOverride) !== data.tariffPrice && (
                    <Text type="secondary">
                      {" "}
                      · на{" "}
                      {fmtMoney(
                        Math.abs(Number(t.priceOverride) - data.tariffPrice),
                      )}{" "}
                      {Number(t.priceOverride) > data.tariffPrice
                        ? "больше"
                        : "меньше"}{" "}
                      тарифа
                    </Text>
                  )}
              </div>
            </div>

            {/* Расход против лимитов — сразу под тарифом: главное для контроля. */}
            <div>
              <Text strong>Использование лимитов</Text>
              <ul className="usage">
                {LIMIT_META.map((l) => {
                  const used = data.usage[l.key] ?? 0;
                  const limit = data.limits[l.key];
                  const unlimited = limit === null || limit === undefined;
                  const over = !unlimited && used > (limit as number);
                  const pct = unlimited
                    ? 0
                    : Math.min(100, (used / Math.max(Number(limit), 1)) * 100);
                  return (
                    <li key={l.key}>
                      <span className="usage-head">
                        <span>{l.label}</span>
                        <span className={over ? "usage-over" : undefined}>
                          {used.toLocaleString("ru-RU")} из{" "}
                          {unlimited ? "∞" : Number(limit).toLocaleString("ru-RU")}
                          {over ? " — превышение" : ""}
                        </span>
                      </span>
                      {unlimited ? null : (
                        <span className="usage-track">
                          <span
                            className="usage-fill"
                            style={{
                              width: `${pct}%`,
                              background: over
                                ? "var(--danger)"
                                : pct >= 80
                                  ? "var(--warning)"
                                  : "var(--accent)",
                            }}
                          />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {data.limitPolicy === "hard"
                  ? "При превышении новое создать нельзя."
                  : "При превышении — только предупреждение, создавать можно."}
              </Text>
            </div>

            <CallLinesBlock tenantId={t.id} />

            <div>
              <Text strong>Опции (докуплено)</Text>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 6 }}>
                Добавляются к лимитам тарифа: доп. сотрудник — +1 место,
                WABA или доп. WhatsApp — +1 номер, AI-менеджер включает модуль AI.
                «до дата» — опция оплачена заранее до этого дня, потом снимается сама.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: "8px",
                }}
              >
                {addonMeta.map((a) => {
                  const cur = addonDraft ?? data.addons ?? {};
                  return (
                    <div key={a.key}>
                      <div style={{ fontSize: 12 }}>
                        {a.label}
                        {data.addonsPaidUntil?.[a.key] ? (
                          <span style={{ color: "var(--text-3)" }}>
                            {" "}· до {new Date(data.addonsPaidUntil[a.key]).toLocaleDateString("ru-RU")}
                          </span>
                        ) : null}
                      </div>
                      <InputNumber
                        min={0}
                        max={SINGLE_ADDON_KEYS.has(a.key) ? 1 : undefined}
                        style={{ width: "100%" }}
                        placeholder="0"
                        disabled={!can("billing.edit")}
                        value={cur[a.key] ?? 0}
                        onChange={(v) =>
                          setAddonDraft({
                            ...(addonDraft ?? data.addons ?? {}),
                            [a.key]: Number(v ?? 0),
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
              {(() => {
                const seat = data.addons?.extraSeat ?? 0;
                const wa =
                  (data.addons?.wabaNumber ?? 0) +
                  (data.addons?.extraWhatsapp ?? 0);
                const line = (
                  label: string,
                  eff: number | null | undefined,
                  bonus: number,
                ) => {
                  const e = eff ?? null;
                  const txt =
                    e === null
                      ? "∞"
                      : bonus > 0
                        ? `${e - bonus} (тариф) + ${bonus} (аддон) = ${e}`
                        : `${e}`;
                  return `${label}: ${txt}`;
                };
                return (
                  <div
                    style={{ fontSize: 12, color: "var(--text-2)", margin: "8px 0 4px" }}
                  >
                    <div>{line("Лимит сотрудников", data.limits?.users, seat)}</div>
                    <div>
                      {line("Лимит номеров WhatsApp", data.limits?.whatsappNumbers, wa)}
                    </div>
                  </div>
                );
              })()}
            </div>
          </Space>


          <Divider titlePlacement="start">Оплата</Divider>
          {/* Биллинг (ручной) */}
          <Space wrap style={{ marginBottom: 8 }}>
            <Tag color={PAYMENT_COLOR[t.paymentStatus]}>
              {PAYMENT_LABEL[t.paymentStatus]}
            </Tag>
            <Text type="secondary">Оплачено до: {fmtDate(t.paidUntil)}</Text>
            <Text type="secondary">След. списание: {fmtDate(t.nextChargeAt)}</Text>
          </Space>

          {/* Триал — только у компаний в триале (у замороженной продление
              триала ничего не даёт и путает). */}
          {t.status === "trial" && (
            <>
              <Divider titlePlacement="start">Триал</Divider>
              <Space orientation="vertical" style={{ marginBottom: 8 }}>
                <Text type={t.trialDaysLeft <= 0 ? "danger" : undefined}>
                  {t.trialDaysLeft > 0
                    ? `Осталось ${t.trialDaysLeft} дн. (до ${fmtDate(t.trialEndsAt)})`
                    : `Триал истёк (${fmtDate(t.trialEndsAt)})`}
                </Text>
                <Space>
                  {/* Продлить за раз — не больше 3 дней (как и сам триал). */}
                  {[1, 2, 3].map((d) => (
                    <Button
                      key={d}
                      size="small"
                      disabled={trialAtMax}
                      onClick={() => addDays(d)}
                      loading={extendTrial.isPending}
                    >
                      +{d} дн.
                    </Button>
                  ))}
                </Space>
              </Space>
              <Divider titlePlacement="start">Платежи</Divider>
            </>
          )}
          <div>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              disabled={!can("billing.edit") || t.status === "deleted"}
              onClick={openPay}
            >
              Добавить подписку
            </Button>
          </div>
          <List
            size="small"
            style={{ marginTop: 8 }}
            locale={{ emptyText: "Платежей ещё не было" }}
            dataSource={paymentsResp?.items ?? []}
            pagination={
              (paymentsResp?.total ?? 0) > 10
                ? {
                    current: payPage,
                    pageSize: 10,
                    total: paymentsResp?.total ?? 0,
                    onChange: setPayPage,
                    size: "small",
                  }
                : false
            }
            renderItem={(p) => (
              <List.Item>
                <Space orientation="vertical" size={0} style={{ width: "100%" }}>
                  <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    <Space size={6} wrap>
                      <Text delete={p.cancelled} strong>
                        {fmtMoney(p.amount)}
                        {p.periodMonths && (!p.kind || p.kind === "subscription")
                          ? ` · ${p.periodMonths} мес.`
                          : ""}
                      </Text>
                      <Tag
                        color={p.source === "online" ? "blue" : "default"}
                        style={{ marginInlineEnd: 0 }}
                      >
                        {paymentOrigin(p)}
                      </Tag>
                      {p.cancelled && (
                        <Tag color="default" style={{ marginInlineEnd: 0 }}>
                          отменена
                        </Tag>
                      )}
                    </Space>
                    {!p.cancelled && p.source !== "online" && can("billing.edit") && (
                      <Button
                        type="link"
                        size="small"
                        danger
                        loading={cancelPayment.isPending}
                        onClick={() =>
                          modal.confirm({
                            title: `Отменить оплату ${fmtMoney(p.amount)}?`,
                            content:
                              p.source === "manual"
                                ? `«Оплачено до» вернётся на ${p.periodMonths ?? 1} мес. назад. Запись останется в истории как отменённая.`
                                : "«Оплачено до» пересчитается по оставшимся оплатам. Запись останется в истории как отменённая.",
                            okText: "Отменить оплату",
                            okButtonProps: { danger: true },
                            cancelText: "Не отменять",
                            onOk: () =>
                              cancelPayment
                                .mutateAsync({ id: t.id, paymentId: p.id })
                                .then(
                                  () => void message.success("Оплата отменена"),
                                  (e: unknown) =>
                                    void message.error(
                                      (e as { response?: { data?: { message?: string } } })
                                        ?.response?.data?.message ??
                                        "Не удалось отменить",
                                    ),
                                ),
                          })
                        }
                      >
                        Отменить
                      </Button>
                    )}
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {p.paidUntil ? `до ${fmtDate(p.paidUntil)} · ` : ""}
                    {new Date(p.createdAt).toLocaleDateString("ru-RU")} ·{" "}
                    {p.adminLogin}
                    {p.receipt ? ` · чек ${p.receipt}` : ""}
                    {p.note ? ` · ${p.note}` : ""}
                  </Text>
                </Space>
              </List.Item>
            )}
          />

                  </>
                ),
              },
              {
                label: allSectionKeys.length
                  ? `Модули · ${moduleOnCount}/${allSectionKeys.length}`
                  : "Модули",
                key: "modules",
                children: (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Отрасль: привязка + применение пресета (перезапись override модулей). */}
            <Divider titlePlacement="start">Отрасль</Divider>
            {(() => {
              const list = (industriesQ.data ?? []).filter((i) => i.isActive);
              const currentId =
                list.find((i) => i.slug === data.industry?.slug)?.id ?? null;
              const selected = industryDraft ?? currentId;
              const selectedName =
                list.find((i) => i.id === selected)?.nameRu ?? "—";
              const canEdit = can("tenants.tariff");
              return (
                <div>
                  <Space.Compact style={{ width: "100%" }}>
                    <Select
                      style={{ width: "100%" }}
                      loading={industriesQ.isLoading}
                      placeholder="Не задана"
                      value={selected ?? undefined}
                      disabled={!canEdit}
                      onChange={(v) => setIndustryDraft(v ?? null)}
                      options={list.map((i) => ({
                        value: i.id,
                        label: i.nameRu,
                      }))}
                      allowClear
                    />
                    <Button
                      disabled={!canEdit || selected === currentId}
                      loading={setIndustry.isPending}
                      onClick={() =>
                        setIndustry.mutate(
                          { id: t.id, industryId: selected },
                          {
                            onSuccess: () => {
                              message.success("Отрасль обновлена");
                              setIndustryDraft(null);
                            },
                            onError: () =>
                              message.error("Не удалось сохранить отрасль"),
                          },
                        )
                      }
                    >
                      Привязать
                    </Button>
                    <Button
                      type="primary"
                      ghost
                      disabled={!canEdit || !selected}
                      loading={applyPreset.isPending}
                      onClick={() =>
                        modal.confirm({
                          title: "Применить пресет отрасли?",
                          content: `Модули компании будут перезаписаны по пресету отрасли «${selectedName}» (термин клиента и склад — тоже). Воронка и данные не затрагиваются.`,
                          okText: "Применить",
                          cancelText: "Отмена",
                          onOk: () =>
                            applyPreset.mutate(
                              { id: t.id, industryId: selected as string },
                              {
                                onSuccess: () => {
                                  message.success("Пресет отрасли применён");
                                  setIndustryDraft(null);
                                  setModuleChecked(null);
                                },
                                onError: () =>
                                  message.error("Не удалось применить пресет"),
                              },
                            ),
                        })
                      }
                    >
                      Применить пресет
                    </Button>
                  </Space.Compact>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <Text type="secondary">
                      «Применить пресет» перезапишет набор модулей по отрасли.
                      «Привязать» — только сменит отрасль, модули не трогает.
                    </Text>
                  </div>
                </div>
              );
            })()}

            <div>
              <Space
                style={{
                  width: "100%",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <Text strong>Модули компании</Text>
                {overrideCount > 0 && (
                  <Space size={8}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Изменено относительно тарифа: {overrideCount}
                    </Text>
                    <Button
                      size="small"
                      disabled={!can("tenants.tariff")}
                      onClick={() =>
                        modal.confirm({
                          title: "Сбросить модули к тарифу?",
                          content:
                            "Индивидуальные правки модулей удалятся, останутся модули тарифа.",
                          okText: "Сбросить",
                          okButtonProps: { danger: true },
                          cancelText: "Отмена",
                          onOk: () =>
                            setModules.mutate(
                              { id: t.id, modules: {} },
                              {
                                onSuccess: () => {
                                  message.success("Сброшено к тарифу");
                                  setModuleChecked(null);
                                },
                                onError: () =>
                                  message.error("Не удалось сбросить"),
                              },
                            ),
                        })
                      }
                    >
                      Сбросить к тарифу
                    </Button>
                  </Space>
                )}
              </Space>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 6 }}>
                Итоговый набор разделов = тариф + индивидуальные правки. Отличия
                от тарифа помечены.
              </div>
              <Space style={{ width: "100%", marginBottom: 6 }}>
                <Input.Search
                  allowClear
                  size="small"
                  placeholder="Поиск модуля"
                  value={moduleSearch}
                  onChange={(e) => setModuleSearch(e.target.value)}
                  style={{ width: 200 }}
                />
                <Button size="small" onClick={() => setModuleExpanded(groupTreeKeys)}>
                  Развернуть всё
                </Button>
                <Button size="small" onClick={() => setModuleExpanded([])}>
                  Свернуть всё
                </Button>
              </Space>
              <Tree
                checkable
                selectable={false}
                disabled={!can("tenants.tariff")}
                treeData={moduleTreeData}
                expandedKeys={moduleExpandedKeys}
                onExpand={(keys) => setModuleExpanded(keys as string[])}
                checkedKeys={
                  moduleChecked ??
                  allSectionKeys.filter((k) => data.modules[k] !== false)
                }
                onCheck={(keys) => {
                  const arr = (Array.isArray(keys) ? keys : keys.checked).map(
                    String,
                  );
                  setModuleChecked(arr.filter((k) => !k.startsWith("grp:")));
                }}
              />
            </div>

                  </div>
                ),
              },
              {
                label: "История",
                key: "history",
                children: (
                  <>
          {/* Журнал биллинга (авто): оплаты/продления/докупки/смена тарифа. */}
          <Divider titlePlacement="start">Оплаты и продления</Divider>
          <List
            size="small"
            locale={{ emptyText: "Событий биллинга ещё не было" }}
            dataSource={billingJournal ?? []}
            pagination={
              (billingJournal?.length ?? 0) > 10
                ? { pageSize: 10, size: "small" }
                : false
            }
            renderItem={(j) => (
              <List.Item>
                <Space orientation="vertical" size={0} style={{ width: "100%" }}>
                  <Text>
                    {j.title}
                    {j.amount
                      ? ` · ${Number(j.amount).toLocaleString("ru-RU")} сом`
                      : ""}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(j.createdAt).toLocaleString("ru-RU")}
                  </Text>
                </Space>
              </List.Item>
            )}
          />

          {/* Уведомления клиенту (все уведомления — про триал и оплату) */}
          <Divider titlePlacement="start">Уведомления</Divider>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: REMINDER_TYPES.map((rt) => ({
                key: rt.value,
                label: rt.label,
                onClick: () => confirmReminder(rt.value, rt.label),
              })),
            }}
          >
            <Button
              size="small"
              disabled={!can("tenants.notify")}
              loading={sendReminder.isPending}
            >
              Отправить уведомление ▾
            </Button>
          </Dropdown>
          <List
            size="small"
            style={{ marginTop: 8 }}
            locale={{ emptyText: "Уведомлений ещё не было" }}
            dataSource={(notifications ?? []).slice(0, 10)}
            renderItem={(n) => (
              <List.Item>
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <span>
                    <Tag color={NOTIF_STATUS_COLOR[n.status] ?? "default"}>
                      {NOTIF_STATUS_LABEL[n.status] ?? n.status}
                    </Tag>
                    {REMINDER_TYPES.find((rt) => rt.value === n.type)?.label ??
                      n.type}
                  </span>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(n.createdAt).toLocaleString("ru-RU")}
                  </Text>
                </Space>
              </List.Item>
            )}
          />


          <Divider titlePlacement="start">Действия администраторов</Divider>
          {/* Журнал действий админа */}
          <Select
            size="small"
            value={auditFilter}
            style={{ width: "100%", marginBottom: 8 }}
            onChange={(v) => {
              setAuditFilter(v);
              setAuditLimit(20);
            }}
            options={AUDIT_FILTERS.map((f, i) => ({ value: i, label: f.label }))}
          />
          <List
            size="small"
            locale={{ emptyText: "Пока нет действий" }}
            loadMore={
              audit?.hasMore ? (
                <div style={{ textAlign: "center", padding: 8 }}>
                  <Button
                    size="small"
                    onClick={() => setAuditLimit((l) => l + 20)}
                  >
                    Показать ещё
                  </Button>
                </div>
              ) : undefined
            }
            dataSource={audit?.rows ?? []}
            renderItem={(r) => (
              <List.Item>
                <Space orientation="vertical" size={0} style={{ width: "100%" }}>
                  <Text>
                    {actionLabel(r.action)}{" "}
                    <Text type="secondary">· {r.adminLogin || "система"}</Text>
                  </Text>
                  {auditDetails(r.action, r.details) ? (
                    <Text style={{ fontSize: 13 }}>{auditDetails(r.action, r.details)}</Text>
                  ) : null}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(r.createdAt).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </Space>
              </List.Item>
            )}
          />
                  </>
                ),
              },
            ]}
          />

          {/* Деструктив (заморозка/удаление) — ввод slug вручную. */}
          <Modal
            open={danger !== null}
            title={
              danger === "delete" ? "Удалить компанию?" : "Заморозить компанию?"
            }
            okText={danger === "delete" ? "Удалить" : "Заморозить"}
            okButtonProps={{
              danger: true,
              disabled: confirmSlug.trim() !== t.slug,
            }}
            confirmLoading={setStatus.isPending}
            cancelText="Отмена"
            onCancel={() => setDanger(null)}
            onOk={runDanger}
            destroyOnHidden
          >
            <Alert
              type="warning"
              showIcon
              title={
                danger === "delete"
                  ? "Вход в компанию закроется."
                  : "Компания перейдёт в режим «только чтение»."
              }
              description={
                danger === "delete"
                  ? "Данные сохраняются, компанию можно восстановить."
                  : "Сотрудники видят свои данные, но ничего не меняют и не отправляют. Данные сохраняются, разморозить можно в любой момент."
              }
            />
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Для подтверждения введите адрес компании:{" "}
                <Text code>{t.slug}</Text>
              </Text>
              <Input
                style={{ marginTop: 6 }}
                autoFocus
                autoComplete="off"
                status={confirmSlug && confirmSlug.trim() !== t.slug ? "error" : undefined}
                onPressEnter={() => {
                  if (confirmSlug.trim() === t.slug) runDanger();
                }}
                value={confirmSlug}
                onChange={(e) => setConfirmSlug(e.target.value)}
                placeholder={t.slug}
              />
            </div>
          </Modal>

          <DeleteTenantModal
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            tenantId={t.id}
            slug={t.slug}
            name={t.name}
            isTest={t.isTest}
          />
        </>
      )}
    </Drawer>
  );
};
