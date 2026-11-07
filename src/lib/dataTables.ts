/**
 * Человеческие названия таблиц базы — для блока «Объём данных» в карточке
 * компании. service: true — служебные записи системы (не то, что компания
 * вводит сама), показываем приглушённо.
 */
type TableLabel = { label: string; service?: boolean };

const LABELS: Record<string, TableLabel> = {
  // Сделки и клиенты
  deals: { label: "Сделки" },
  deal_activities: { label: "История действий по сделкам" },
  lead_stage_history: { label: "Переходы сделок по этапам" },
  deal_returns: { label: "Возвраты по сделкам" },
  deal_merge_log: { label: "Объединения сделок", service: true },
  deal_bulk_audit: { label: "Массовые действия со сделками", service: true },
  lead_assignment_audit: { label: "Назначения ответственных", service: true },
  clients: { label: "Клиенты" },
  tasks: { label: "Задачи" },
  task_comments: { label: "Комментарии к задачам" },
  task_activity: { label: "История задач" },
  tags: { label: "Теги" },
  custom_field_values: { label: "Значения доп. полей" },
  notifications: { label: "Уведомления сотрудникам" },
  // Переписка
  messages: { label: "Сообщения в чатах" },
  conversations: { label: "Чаты с клиентами" },
  outbound_messages: { label: "Отправленные сообщения" },
  message_outbox: { label: "Очередь отправки сообщений", service: true },
  message_send_locks: { label: "Блокировки отправки", service: true },
  automessage_dispatch: { label: "Автосообщения по этапам" },
  quick_replies: { label: "Быстрые ответы" },
  client_sms_logs: { label: "СМС клиентам" },
  email_log: { label: "Письма", service: true },
  // WhatsApp
  wa_auth_state: { label: "Ключи шифрования WhatsApp", service: true },
  wa_session_events: { label: "События подключения WhatsApp", service: true },
  whatsapp_sessions: { label: "Номера WhatsApp" },
  whatsapp_calls: { label: "Звонки" },
  whatsapp_call_events: { label: "События звонков", service: true },
  whatsapp_call_recordings: { label: "Записи звонков" },
  whatsapp_call_transcripts: { label: "Расшифровки звонков" },
  // Instagram
  instagram_messages: { label: "Сообщения Instagram" },
  instagram_comments: { label: "Комментарии Instagram" },
  instagram_contacts: { label: "Контакты Instagram" },
  instagram_events: { label: "События Instagram", service: true },
  instagram_webhook_logs: { label: "Входящие уведомления Instagram", service: true },
  // Товары и склад
  products: { label: "Товары" },
  product_batches: { label: "Партии товаров" },
  product_serials: { label: "Серийные номера" },
  product_barcodes: { label: "Штрихкоды" },
  product_categories: { label: "Категории товаров" },
  product_photo_assets: { label: "Фото товаров" },
  inventory_movements: { label: "Движения по складу" },
  stock_transfers: { label: "Перемещения между филиалами" },
  price_history: { label: "История цен" },
  price_lists: { label: "Прайс-листы" },
  price_list_items: { label: "Строки прайс-листов" },
  suppliers: { label: "Поставщики" },
  supplier_product_aliases: { label: "Названия товаров у поставщиков" },
  scan_drafts: { label: "Черновики сканирования" },
  // Продажи и деньги
  sales: { label: "Продажи" },
  sales_fact: { label: "Строки продаж для отчётов", service: true },
  sale_batch_allocations: { label: "Списания партий при продажах", service: true },
  expenses: { label: "Расходы" },
  debts: { label: "Долги" },
  installment_payments: { label: "Платежи по рассрочке" },
  cash_shifts: { label: "Кассовые смены" },
  cash_transfers: { label: "Перемещения денег" },
  bonuses: { label: "Бонусы клиентов" },
  client_loyalty_transactions: { label: "Начисления лояльности" },
  business_documents: { label: "Документы" },
  business_document_revisions: { label: "Версии документов", service: true },
  repair_tickets: { label: "Ремонты" },
  repair_events: { label: "История ремонтов" },
  // Сотрудники
  employees: { label: "Сотрудники" },
  employee_sessions: { label: "Входы сотрудников", service: true },
  employee_activity_days: { label: "Активность сотрудников по дням", service: true },
  employee_audit_log: { label: "Журнал действий сотрудников", service: true },
  work_time_entries: { label: "Учёт рабочего времени" },
  hr_candidates: { label: "Кандидаты" },
  // ИИ
  ai_traces: { label: "Ответы ИИ (журнал)", service: true },
  ai_memories: { label: "Память ИИ о клиентах" },
  ai_kb_chunks: { label: "База знаний ИИ", service: true },
  ai_knowledge_vectors: { label: "Поисковый индекс ИИ", service: true },
  lead_training_examples: { label: "Примеры для ИИ-классификации" },
  // Интеграции и система
  webhook_deliveries: { label: "Отправки вебхуков", service: true },
  external_api_logs: { label: "Журнал внешних API", service: true },
  marketplace_api_logs: { label: "Журнал API маркетплейсов", service: true },
  print_jobs: { label: "Задания печати", service: true },
  import_jobs: { label: "Импорты файлов" },
  session_security_events: { label: "События безопасности входа", service: true },
  account_audit_log: { label: "Журнал аккаунта", service: true },
  support_ticket_messages: { label: "Сообщения в поддержку" },
  telegram_publications: { label: "Публикации в Telegram" },
};

const PREFIX: Array<[string, string]> = [
  ["marketing_", "Маркетинг"],
  ["hr_", "HR"],
  ["internship", "Практика"],
  ["instagram_", "Instagram"],
  ["whatsapp_", "WhatsApp"],
  ["wa_", "WhatsApp"],
  ["ai_", "ИИ"],
  ["telegram_", "Telegram"],
  ["marketplace", "Маркетплейсы"],
  ["product", "Товары"],
  ["price", "Цены"],
  ["deal", "Сделки"],
  ["client", "Клиенты"],
  ["employee", "Сотрудники"],
  ["finance_", "Финансы"],
  ["cash_", "Касса"],
];

/** Название таблицы для человека; неизвестную — по разделу. */
export const tableLabel = (table: string): TableLabel & { raw: string } => {
  const known = LABELS[table];
  if (known) return { ...known, raw: table };
  const group = PREFIX.find(([p]) => table.startsWith(p))?.[1];
  return {
    label: group ? `${group}: прочие записи` : "Служебные записи",
    service: true,
    raw: table,
  };
};
