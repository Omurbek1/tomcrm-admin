import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp, ConfigProvider } from "antd";
import ruRU from "antd/locale/ru_RU";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SelfHeal, VersionWatcher } from "./components/resilience";
import { initMonitoring } from "./lib/monitoring";

void initMonitoring();

// 30 с «свежести»: переход между разделами и «Обзором» берёт данные из кэша
// без повторных запросов; мутации сами инвалидируют нужные ключи.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

// Одна тема на всю панель: шрифт, радиусы и основной цвет — как в графиках.
const THEME = {
  token: {
    colorPrimary: "#2a78d6",
    colorLink: "#2a78d6",
    borderRadius: 8,
    colorBgLayout: "#f4f6fa",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  components: {
    Table: { headerBg: "#f8fafc", headerColor: "#475569", rowHoverBg: "#f5f8fd" },
    Card: { borderRadiusLG: 12 },
  },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={ruRU} theme={THEME}>
        <AntApp>
          <ErrorBoundary>
            <SelfHeal />
            <VersionWatcher />
            <App />
          </ErrorBoundary>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
);
