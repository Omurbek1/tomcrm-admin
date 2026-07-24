/**
 * Провайдер-агностик отчёт об ошибках (панель платформы). Без ключей — только
 * console. С VITE_POSTHOG_KEY — шлём $exception прямо в PostHog (без SDK). Либо
 * на произвольный VITE_ERROR_REPORT_URL. Best-effort, никогда не роняет код.
 */
const PH_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const PH_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ||
  'https://eu.i.posthog.com';
const REPORT_URL = import.meta.env.VITE_ERROR_REPORT_URL as string | undefined;

type Context = Record<string, unknown>;

export function reportError(error: unknown, context: Context = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error('[admin]', err, context);

  if (typeof window === 'undefined') return;
  const payload = {
    app: 'tomstore-admin',
    message: err.message,
    stack: err.stack,
    url: window.location.href,
    ua: navigator.userAgent,
    ts: new Date().toISOString(),
    ...context,
  };

  try {
    if (PH_KEY) {
      void fetch(`${PH_HOST}/capture/`, {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: PH_KEY,
          event: '$exception',
          distinct_id: localStorage.getItem('ph_distinct_id') || 'admin-anon',
          properties: payload,
        }),
      }).catch(() => undefined);
    } else if (REPORT_URL) {
      void fetch(REPORT_URL, {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    }
  } catch {
    /* отчёт не должен ломать приложение */
  }
}
