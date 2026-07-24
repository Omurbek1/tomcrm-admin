/**
 * Мониторинг панели платформы: PostHog (аналитика + identify) и Sentry (ошибки).
 * Обе SDK лениво и только при заданных ключах (VITE_POSTHOG_KEY / VITE_SENTRY_DSN)
 * — без конфигурации ни сети, ни веса в основном бандле. Никогда не роняет код.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
let posthog: any = null;
let sentry: any = null;
let started = false;

const PH_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const PH_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ||
  "https://eu.i.posthog.com";
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export async function initMonitoring(): Promise<void> {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    if (PH_KEY) {
      const mod = await import("posthog-js");
      mod.default.init(PH_KEY, {
        api_host: PH_HOST,
        person_profiles: "identified_only",
      });
      posthog = mod.default;
    }
    if (SENTRY_DSN) {
      const S = await import("@sentry/react");
      S.init({ dsn: SENTRY_DSN, tracesSampleRate: 0 });
      sentry = S;
    }
  } catch {
    /* мониторинг не должен ломать приложение */
  }
}

/** Привязать события/ошибки к конкретному админу. */
export function identify(id: string, props?: Record<string, unknown>): void {
  try {
    posthog?.identify(id, props);
    sentry?.setUser({ id, ...props });
  } catch {
    /* noop */
  }
}

export function resetIdentity(): void {
  try {
    posthog?.reset();
    sentry?.setUser(null);
  } catch {
    /* noop */
  }
}

export function trackEvent(event: string, props?: Record<string, unknown>): void {
  try {
    posthog?.capture(event, props);
  } catch {
    /* noop */
  }
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    sentry?.captureException(e, context ? { extra: context } : undefined);
    posthog?.capture("$exception", { message: e.message, ...context });
  } catch {
    /* noop */
  }
}
