/**
 * Отчёт об ошибке (панель платформы). Console + PostHog/Sentry через monitoring
 * (если заданы ключи/DSN) + опциональный collector VITE_ERROR_REPORT_URL.
 * Best-effort, никогда не роняет вызвавший код.
 */
import { captureException } from "./monitoring";

const REPORT_URL = import.meta.env.VITE_ERROR_REPORT_URL as string | undefined;

type Context = Record<string, unknown>;

export function reportError(error: unknown, context: Context = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error("[admin]", err, context);

  captureException(err, context);

  if (typeof window === "undefined" || !REPORT_URL) return;
  try {
    void fetch(REPORT_URL, {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        app: "tomstore-admin",
        message: err.message,
        stack: err.stack,
        url: window.location.href,
        ua: navigator.userAgent,
        ts: new Date().toISOString(),
        ...context,
      }),
    }).catch(() => undefined);
  } catch {
    /* noop */
  }
}
