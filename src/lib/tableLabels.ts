// Человеко-читаемые подписи таблиц БД для супер-админки «Объём данных».
// Платформенному админу важно понимать, ЧТО занимает место, а не имя таблицы.
const TABLE_LABEL: Record<string, string> = {
  // CRM / сделки
  deals: "Сделки",
  deal_activities: "Активность сделок",
  deal_tags: "Теги на сделках",
  lead_stage_history: "История этапов сделок",
  pipelines: "Воронки",
  pipeline_stages: "Этапы воронок",
  tags: "Теги",
  tag_stage_rules: "Правила тегов",
  routing_rules: "Правила маршрутизации",
  distribution_participants: "Участники распределения",
  custom_fields: "Доп. поля",
  custom_field_values: "Значения доп. полей",
  deal_settings: "Настройки сделок",
  // Чат / сообщения
  conversations: "Диалоги (чаты)",
  messages: "Сообщения",
  message_send_locks: "Блокировки отправки (служебное)",
  quick_replies: "Быстрые ответы",
  // Уведомления / сессии / аудит
  notifications: "Уведомления",
  employee_sessions: "Сессии входа сотрудников",
  employee_audit_log: "Журнал изменений (аудит)",
  account_audit_log: "Аудит аккаунтов",
  // WhatsApp
  whatsapp_sessions: "WhatsApp-номера",
  whatsapp_calls: "Звонки WhatsApp",
  whatsapp_call_events: "События звонков",
  whatsapp_call_recordings: "Записи звонков",
  whatsapp_call_transcripts: "Расшифровки звонков",
  // Клиенты / лояльность
  clients: "Клиенты",
  client_loyalty_transactions: "Бонусные операции",
  client_promotions: "Акции клиентов",
  client_sms_log: "SMS клиентам",
  loyalty_redemptions: "Списания бонусов",
  review_requests: "Запросы отзывов",
  // Продажи / склад / товары
  sales: "Продажи",
  sale_batch_allocations: "Списания партий (продажи)",
  products: "Товары",
  product_batches: "Партии товара",
  product_photo_assets: "Фото товаров",
  product_categories: "Категории товаров",
  inventory_movements: "Движения склада",
  suppliers: "Поставщики",
  // Финансы
  expenses: "Расходы",
  debts: "Долги",
  bonuses: "Бонусы",
  bonus_targets: "Планы бонусов",
  cash_shifts: "Кассовые смены",
  // Сотрудники / HR / время
  employees: "Сотрудники",
  branches: "Филиалы",
  work_time_entries: "Учёт рабочего времени",
  tasks: "Задачи",
  task_comments: "Комментарии к задачам",
  task_activities: "Активность задач",
  hr_vacancies: "Вакансии",
  hr_candidates: "Кандидаты",
  hr_interviews: "Собеседования",
  // Ремонты
  repair_tickets: "Ремонты",
  repair_events: "События ремонтов",
  // Прочее
  integrations: "Интеграции",
  business_documents: "Документы",
  business_document_revisions: "Версии документов",
  training_materials: "Обучающие материалы",
  marketing_kpis: "Маркетинг (KPI)",
  telegram_channels: "Telegram-каналы",
  telegram_publications: "Публикации Telegram",
  ai_memories: "Память ИИ",
};

/** Подпись таблицы: из словаря, иначе — прибранное имя (Snake_case → «Snake case»). */
export const tableLabel = (table: string): string => {
  if (TABLE_LABEL[table]) return TABLE_LABEL[table];
  const pretty = table.replace(/_/g, " ").trim();
  return pretty ? pretty[0].toUpperCase() + pretty.slice(1) : table;
};

// Служебные таблицы — помечаем, чтобы админ не пугался «мусорных» строк.
const TECHNICAL = new Set([
  "message_send_locks",
  "employee_sessions",
  "webhook_outbox",
  "webhook_deliveries",
]);
export const isTechnicalTable = (table: string): boolean => TECHNICAL.has(table);
