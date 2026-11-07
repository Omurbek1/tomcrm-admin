import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const pkgOf = (id: string): string => {
  const m = id.split("node_modules/").pop()!.split("/");
  return m[0].startsWith("@") ? `${m[0]}/${m[1]}` : m[0];
};

// Панель платформы. По умолчанию dev-сервер на 5199, чтобы не конфликтовать с
// CRM (5173). Бэкенд-адрес фронт берёт из VITE_API_URL (см. .env.example).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5199,
  },
  build: {
    rollupOptions: {
      output: {
        // Стабильные библиотеки — отдельными файлами: после выкладки админки
        // браузер берёт их из кэша (~86 КБ gz), качает только код приложения.
        // antd сюда НЕ выносим: тогда таблицы/деревья ленивых разделов
        // попадали бы в первый вход (+140 КБ gz, замерено).
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          const p = pkgOf(id);
          if (p === "react" || p === "react-dom" || p === "scheduler")
            return "vendor-react";
          if (p.startsWith("@tanstack/") || p === "axios") return "vendor-data";
        },
      },
    },
  },
});
