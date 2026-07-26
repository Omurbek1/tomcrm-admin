import { Button } from "antd";
import { useEffect, useState } from "react";

import { reportError } from "../lib/report";

/** Авто-перезагрузка при 404 чанков/CSS (устаревший кэш после деплоя). */
export function SelfHeal() {
  useEffect(() => {
    const KEY = "sh:reloads";
    const CHUNK_RE =
      /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|Failed to fetch dynamically/i;

    const reloadOnce = (reason: string) => {
      const n = Number(sessionStorage.getItem(KEY) || "0");
      if (n >= 2) return;
      reportError(new Error(`chunk load failure: ${reason}`), {
        kind: "self-heal",
        attempt: n + 1,
      });
      sessionStorage.setItem(KEY, String(n + 1));
      window.location.reload();
    };

    const okTimer = window.setTimeout(
      () => sessionStorage.removeItem(KEY),
      10_000,
    );
    const onError = (e: ErrorEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "SCRIPT" || tag === "LINK") {
        reloadOnce(`resource ${tag.toLowerCase()} 404`);
        return;
      }
      if (e.message && CHUNK_RE.test(e.message)) reloadOnce(e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = String((e.reason && (e.reason.message || e.reason)) ?? "");
      if (CHUNK_RE.test(msg)) reloadOnce(msg);
    };
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.clearTimeout(okTimer);
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}

/** Следит за новым деплоем (сравнивает /version.json) → плашка «Обновить». */
export function VersionWatcher() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let baseline: string | null = null;
    let stopped = false;

    const fetchId = async (): Promise<string | null> => {
      try {
        const r = await fetch(`/version.json?ts=${Date.now()}`, {
          cache: "no-store",
        });
        if (!r.ok) return null;
        const data = (await r.json()) as { id?: string };
        return data.id ?? null;
      } catch {
        return null;
      }
    };

    const check = async () => {
      const id = await fetchId();
      if (stopped || !id) return;
      if (baseline === null) {
        baseline = id;
        return;
      }
      if (id !== baseline) setStale(true);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };

    void check();
    const iv = window.setInterval(check, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!stale) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: 8,
        display: "flex",
        justifyContent: "center",
        zIndex: 2000,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#0f172a",
          color: "#fff",
          padding: "8px 12px 8px 16px",
          borderRadius: 999,
          boxShadow: "0 12px 32px -8px rgba(2,6,23,0.5)",
        }}
      >
        <span style={{ fontSize: 13 }}>Доступна новая версия панели</span>
        <Button
          size="small"
          type="primary"
          onClick={() => window.location.reload()}
        >
          Обновить
        </Button>
      </div>
    </div>
  );
}
