import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Панель платформы. По умолчанию dev-сервер на 5199, чтобы не конфликтовать с
// CRM (5173). Бэкенд-адрес фронт берёт из VITE_API_URL (см. .env.example).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5199,
  },
});
