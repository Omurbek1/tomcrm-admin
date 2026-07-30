import { useEffect, useMemo, useState } from "react";
import {
  App as AntApp,
  Button,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Tree,
  Typography,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  useCreateIndustry,
  useDeleteIndustry,
  useIndustries,
  useModuleCatalog,
  useReorderIndustries,
  useUpdateIndustry,
} from "../hooks";
import { can } from "../api/client";
import { MODULE_GROUPS_FALLBACK } from "../types";
import type { Industry, IndustryInput } from "../types";

const { Text } = Typography;

// Простой транслит RU→latin для автогенерации slug из названия.
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
const slugify = (s: string) =>
  s
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const emptyForm: IndustryInput = {
  slug: "",
  nameRu: "",
  nameKy: "",
  nameEn: "",
  icon: "",
  isActive: true,
  modules: [],
  pipelineStages: [],
  clientTermRu: "Клиент",
  clientTermKy: "Кардар",
  clientTermEn: "Client",
  warehouseEnabled: false,
};

export function IndustriesPage() {
  const { message } = AntApp.useApp();
  const { data: industries = [], isLoading } = useIndustries();
  const reorder = useReorderIndustries();
  const del = useDeleteIndustry();
  const update = useUpdateIndustry();
  const editable = can("tariffs.edit");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Industry | null>(null);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...industries];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    reorder.mutate(next.map((i) => i.id));
  };

  const toggleActive = (row: Industry, isActive: boolean) => {
    update.mutate(
      { id: row.id, patch: { isActive } },
      { onError: () => message.error("Не удалось изменить") },
    );
  };

  const remove = (row: Industry) => {
    del.mutate(row.id, {
      onSuccess: () => message.success("Отрасль удалена"),
      onError: (e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Не удалось удалить";
        // 409 = есть компании → переведена в архив, показываем как info.
        message.info(msg);
      },
    });
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Text strong style={{ fontSize: 18 }}>
          Отрасли
        </Text>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!editable}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          Создать
        </Button>
      </div>

      <Table<Industry>
        rowKey="id"
        loading={isLoading}
        dataSource={industries}
        pagination={false}
        size="middle"
        columns={[
          {
            title: "",
            width: 70,
            render: (_v, _r, idx) => (
              <Space size={2}>
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowUpOutlined />}
                  disabled={!editable || idx === 0}
                  onClick={() => move(idx, -1)}
                />
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowDownOutlined />}
                  disabled={!editable || idx === industries.length - 1}
                  onClick={() => move(idx, 1)}
                />
              </Space>
            ),
          },
          {
            title: "Название",
            dataIndex: "nameRu",
            render: (v: string, r) => (
              <Space>
                <span>{v}</span>
                {r.isDefault && <Tag color="blue">дефолт</Tag>}
                {!r.isActive && <Tag color="default">архив</Tag>}
              </Space>
            ),
          },
          {
            title: "slug",
            dataIndex: "slug",
            render: (v: string) => <Text code>{v}</Text>,
          },
          {
            title: "Модулей",
            dataIndex: "modules",
            width: 90,
            render: (m: string[]) => m?.length ?? 0,
          },
          {
            title: "Компаний",
            dataIndex: "tenantsCount",
            width: 100,
          },
          {
            title: "Активна",
            dataIndex: "isActive",
            width: 90,
            render: (v: boolean, r) => (
              <Switch
                checked={v}
                disabled={!editable}
                onChange={(checked) => toggleActive(r, checked)}
              />
            ),
          },
          {
            title: "",
            width: 90,
            render: (_v, r) => (
              <Space>
                <Tooltip title="Редактировать">
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setEditing(r);
                      setModalOpen(true);
                    }}
                  />
                </Tooltip>
                <Tooltip
                  title={
                    r.tenantsCount > 0
                      ? "Есть компании — уйдёт в архив"
                      : "Удалить"
                  }
                >
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    disabled={!editable}
                    onClick={() => remove(r)}
                  />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />

      {modalOpen && (
        <IndustryModal
          industry={editing}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

function IndustryModal({
  industry,
  onClose,
}: {
  industry: Industry | null;
  onClose: () => void;
}) {
  const { message } = AntApp.useApp();
  const create = useCreateIndustry();
  const update = useUpdateIndustry();
  const { data: catalog } = useModuleCatalog();
  const groups = catalog?.groups ?? MODULE_GROUPS_FALLBACK;

  const [form, setForm] = useState<IndustryInput>(
    industry ? { ...industry } : emptyForm,
  );
  // slug редактировали вручную? — тогда не перезатираем автогеном.
  const [slugTouched, setSlugTouched] = useState(!!industry);

  const set = <K extends keyof IndustryInput>(k: K, v: IndustryInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!slugTouched) set("slug", slugify(form.nameRu ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.nameRu, slugTouched]);

  const moduleTreeData = useMemo(
    () =>
      groups.map((g) => ({
        key: `grp:${g.key}`,
        title: g.label,
        children: g.sections.map((s) => ({
          key: s.key,
          title: s.alwaysOn ? `${s.label} · всегда` : s.label,
          disabled: s.alwaysOn,
        })),
      })),
    [groups],
  );

  const stages = form.pipelineStages ?? [];
  const setStage = (i: number, v: string) =>
    set(
      "pipelineStages",
      stages.map((s, idx) => (idx === i ? v : s)),
    );
  const moveStage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= stages.length) return;
    const next = [...stages];
    [next[i], next[j]] = [next[j], next[i]];
    set("pipelineStages", next);
  };
  const removeStage = (i: number) =>
    set("pipelineStages", stages.filter((_, idx) => idx !== i));
  const addStage = () => set("pipelineStages", [...stages, ""]);

  const submit = () => {
    const patch: IndustryInput = {
      ...form,
      pipelineStages: (form.pipelineStages ?? [])
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (!patch.nameRu?.trim()) {
      message.error("Укажите название (RU)");
      return;
    }
    const onSuccess = () => {
      message.success(industry ? "Отрасль обновлена" : "Отрасль создана");
      onClose();
    };
    const onError = (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Не удалось сохранить";
      message.error(msg);
    };
    if (industry) {
      update.mutate({ id: industry.id, patch }, { onSuccess, onError });
    } else {
      create.mutate(patch, { onSuccess, onError });
    }
  };

  return (
    <Modal
      open
      title={industry ? "Редактирование отрасли" : "Новая отрасль"}
      onCancel={onClose}
      onOk={submit}
      okText="Сохранить"
      confirmLoading={create.isPending || update.isPending}
      width={640}
    >
      <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <Field label="Название (RU)">
            <Input
              value={form.nameRu}
              onChange={(e) => set("nameRu", e.target.value)}
              placeholder="Розница"
            />
          </Field>
          <Field label="Название (KY)">
            <Input
              value={form.nameKy}
              onChange={(e) => set("nameKy", e.target.value)}
            />
          </Field>
          <Field label="Название (EN)">
            <Input
              value={form.nameEn}
              onChange={(e) => set("nameEn", e.target.value)}
            />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Field label="slug (латиница)">
            <Input
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value);
              }}
              placeholder="retail"
            />
          </Field>
          <Field label="Иконка (имя)">
            <Input
              value={form.icon ?? ""}
              onChange={(e) => set("icon", e.target.value)}
              placeholder="shop"
            />
          </Field>
        </div>

        <div>
          <Text strong>Модули отрасли (пресет)</Text>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
            Те же разделы CRM, что в карточке компании. Всегда-включённые нельзя снять.
          </div>
          <Tree
            checkable
            selectable={false}
            defaultExpandAll
            treeData={moduleTreeData}
            checkedKeys={form.modules ?? []}
            onCheck={(keys) => {
              const arr = (Array.isArray(keys) ? keys : keys.checked).map(String);
              set("modules", arr.filter((k) => !k.startsWith("grp:")));
            }}
          />
        </div>

        <div>
          <Text strong>Стадии воронки</Text>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
            По порядку. Последняя = проигрыш, предпоследняя = победа.
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {stages.map((s, i) => (
              <Space key={i} style={{ width: "100%" }}>
                <Input
                  value={s}
                  onChange={(e) => setStage(i, e.target.value)}
                  placeholder={`Стадия ${i + 1}`}
                  style={{ width: 320 }}
                />
                <Button
                  size="small"
                  icon={<ArrowUpOutlined />}
                  disabled={i === 0}
                  onClick={() => moveStage(i, -1)}
                />
                <Button
                  size="small"
                  icon={<ArrowDownOutlined />}
                  disabled={i === stages.length - 1}
                  onClick={() => moveStage(i, 1)}
                />
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeStage(i)}
                />
              </Space>
            ))}
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={addStage}
              style={{ width: 160 }}
            >
              Добавить стадию
            </Button>
          </div>
        </div>

        <div>
          <Text strong>Как называть «Клиента»</Text>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 6 }}>
            <Input
              addonBefore="RU"
              value={form.clientTermRu}
              onChange={(e) => set("clientTermRu", e.target.value)}
            />
            <Input
              addonBefore="KY"
              value={form.clientTermKy}
              onChange={(e) => set("clientTermKy", e.target.value)}
            />
            <Input
              addonBefore="EN"
              value={form.clientTermEn}
              onChange={(e) => set("clientTermEn", e.target.value)}
            />
          </div>
        </div>

        <Space>
          <Switch
            checked={form.warehouseEnabled}
            onChange={(v) => set("warehouseEnabled", v)}
          />
          <span>Использовать склад</span>
        </Space>
      </div>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}
