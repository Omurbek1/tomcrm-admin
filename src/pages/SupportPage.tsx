import { useState } from "react";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Drawer,
  Input,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { PaperClipOutlined, ReloadOutlined, SendOutlined } from "@ant-design/icons";

import { can } from "../api/client";
import { PageHeader } from "../components/viz";
import {
  useSupportReply,
  useSupportTicket,
  useSupportTickets,
  type SupportTicketRow,
  type SupportTicketStatus,
} from "../hooks";

const { Text } = Typography;

const STATUS: Record<SupportTicketStatus, { label: string; color: string }> = {
  open: { label: "Новый", color: "blue" },
  in_progress: { label: "В работе", color: "gold" },
  waiting_user: { label: "Нужен ответ клиента", color: "orange" },
  resolved: { label: "Решён", color: "green" },
  closed: { label: "Закрыт", color: "default" },
};
const CATEGORY: Record<string, string> = {
  technical: "Техническая",
  whatsapp: "WhatsApp",
  integrations: "Интеграции",
  billing: "Оплата",
  inventory: "Склад",
  sales: "Продажи",
  ai: "AI",
  other: "Другое",
};
const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

const TicketDrawer = ({ id, onClose }: { id: string | null; onClose: () => void }) => {
  const { message } = AntApp.useApp();
  const { data, isLoading, refetch } = useSupportTicket(id);
  const reply = useSupportReply(id ?? "");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<SupportTicketStatus | undefined>(undefined);

  const send = async () => {
    if (!text.trim() && !status) return;
    try {
      await reply.mutateAsync({ body: text.trim() || undefined, status });
      setText("");
      setStatus(undefined);
      await refetch();
      message.success("Отправлено");
    } catch (e) {
      message.error(String((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Ошибка"));
    }
  };

  const att = (messageId: string | null) => (data?.attachments ?? []).filter((a) => (a.messageId ?? null) === messageId);

  return (
    <Drawer open={Boolean(id)} onClose={onClose} size={640} title={data ? `Обращение #${data.number}` : "Обращение"} loading={isLoading}>
      {data ? (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div>
            <Space wrap>
              <Tag color={STATUS[data.status]?.color}>{STATUS[data.status]?.label ?? data.status}</Tag>
              <Tag>{CATEGORY[data.category] ?? data.category}</Tag>
              {data.priority === "high" ? <Tag color="red">высокий</Tag> : null}
            </Space>
            <Typography.Title level={4} style={{ margin: "8px 0 4px" }}>{data.subject}</Typography.Title>
            <Text type="secondary">
              {data.tenantName ?? data.tenantId} · {data.author?.name ?? data.userId}
              {data.author?.email ? ` · ${data.author.email}` : ""} · {fmt(data.createdAt)}
            </Text>
          </div>
          <Card size="small">
            <div style={{ whiteSpace: "pre-wrap" }}>{data.description}</div>
            {att(null).length ? (
              <Space wrap style={{ marginTop: 8 }}>
                {att(null).map((a) => (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer"><PaperClipOutlined /> {a.fileName}</a>
                ))}
              </Space>
            ) : null}
            <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
              {[data.route, data.browser, data.appVersion ? `сборка ${data.appVersion}` : "", data.lastErrorId ? `err ${data.lastErrorId}` : ""].filter(Boolean).join(" · ")}
            </div>
          </Card>
          {data.messages.map((m) => (
            <Card key={m.id} size="small" style={{ background: m.authorType === "support" ? "#eff6ff" : "#f8fafc", marginLeft: m.authorType === "support" ? 32 : 0, marginRight: m.authorType === "support" ? 0 : 32 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {m.authorType === "support" ? (m.authorName || "Поддержка") : (m.authorName || "Клиент")} · {fmt(m.createdAt)}
              </Text>
              <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{m.body}</div>
              {att(m.id).length ? (
                <Space wrap style={{ marginTop: 8 }}>
                  {att(m.id).map((a) => (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer"><PaperClipOutlined /> {a.fileName}</a>
                  ))}
                </Space>
              ) : null}
            </Card>
          ))}
          {can("support.manage") ? (
            <Card size="small" title="Ответ">
              <Input.TextArea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст ответа клиенту (придёт уведомлением в CRM и письмом)" />
              <Space style={{ marginTop: 8, width: "100%", justifyContent: "space-between" }} wrap>
                <Select
                  allowClear
                  placeholder="Сменить статус"
                  style={{ width: 220 }}
                  value={status}
                  onChange={(v) => setStatus(v)}
                  options={(Object.keys(STATUS) as SupportTicketStatus[]).map((k) => ({ value: k, label: STATUS[k].label }))}
                />
                <Button type="primary" icon={<SendOutlined />} loading={reply.isPending} onClick={() => void send()} disabled={!text.trim() && !status}>
                  Отправить
                </Button>
              </Space>
            </Card>
          ) : (
            <Alert type="info" showIcon title="Нет права support.manage — только просмотр." />
          )}
        </Space>
      ) : null}
    </Drawer>
  );
};

export const SupportPage = () => {
  const [status, setStatus] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, refetch, isFetching } = useSupportTickets(status);

  if (!can("support.manage") && !can("*")) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="warning"
          showIcon
          title="Раздел доступен администраторам с правом «Обращения в поддержку»."
        />
      </div>
    );
  }

  const columns = [
    { title: "№", dataIndex: "number", width: 70, render: (n: number) => <b>#{n}</b> },
    { title: "Компания", dataIndex: "tenantName", width: 180, render: (v: string | null, r: SupportTicketRow) => v ?? r.tenantId ?? "—" },
    { title: "Тема", dataIndex: "subject", ellipsis: true, render: (v: string, r: SupportTicketRow) => (
      <div>
        <div>{v}</div>
        <Text type="secondary" style={{ fontSize: 12 }}>{CATEGORY[r.category] ?? r.category} · {r.authorName ?? ""}</Text>
      </div>
    ) },
    { title: "Статус", dataIndex: "status", width: 150, render: (s: SupportTicketStatus) => <Tag color={STATUS[s]?.color}>{STATUS[s]?.label ?? s}</Tag> },
    { title: "Обновлено", dataIndex: "lastMessageAt", width: 130, render: (v: string | null, r: SupportTicketRow) => fmt(v ?? r.createdAt) },
  ];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Поддержка"
        subtitle="Обращения компаний из Help Center. Ответ уходит клиенту уведомлением в CRM и письмом."
        extra={<Button icon={<ReloadOutlined />} loading={isFetching} onClick={() => void refetch()}>Обновить</Button>}
      />
      <Segmented
        style={{ marginBottom: 12 }}
        value={status}
        onChange={(v) => setStatus(String(v))}
        options={[
          { value: "", label: "Все" },
          { value: "open", label: "Новые" },
          { value: "in_progress", label: "В работе" },
          { value: "waiting_user", label: "Ждём клиента" },
          { value: "resolved", label: "Решённые" },
          { value: "closed", label: "Закрытые" },
        ]}
      />
      <Table<SupportTicketRow>
        rowKey="id"
        size="middle"
        loading={isLoading}
        dataSource={data ?? []}
        columns={columns}
        pagination={{ pageSize: 25, showSizeChanger: false }}
        onRow={(r) => ({ onClick: () => setOpenId(r.id), style: { cursor: "pointer" } })}
        scroll={{ x: 760 }}
      />
      <TicketDrawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
};
