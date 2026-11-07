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
import { antdThemeFor, applyTheme, useTheme } from "./lib/theme";

// Тема — на <html> до первой отрисовки (без вспышки белого в тёмной).
applyTheme();

/** antd под выбранную тему; меняется сразу, без перезагрузки. */
const Themed = ({ children }: { children: React.ReactNode }) => {
  const { resolved } = useTheme();
  return (
    <ConfigProvider locale={ruRU} theme={antdThemeFor(resolved)}>
      {children}
    </ConfigProvider>
  );
};

void initMonitoring();

// 30 с «свежести»: переход между разделами и «Обзором» берёт данные из кэша
// без повторных запросов; мутации сами инвалидируют нужные ключи.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Themed>
        <AntApp>
          <ErrorBoundary>
            <SelfHeal />
            <VersionWatcher />
            <App />
          </ErrorBoundary>
        </AntApp>
      </Themed>
    </QueryClientProvider>
  </StrictMode>,
);
