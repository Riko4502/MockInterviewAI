"use client";

import { Button, Typography } from "@packages/ui";
import { useEffect, useRef, useState } from "react";
import {
  type BrowserNotificationPermission,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from "@/shared/lib/notifications/browser-notifications";

export function BrowserNotificationControl() {
  const [permission, setPermission] =
    useState<BrowserNotificationPermission>("unsupported");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const requesting = useRef(false);

  useEffect(() => {
    const sync = () => setPermission(getBrowserNotificationPermission());
    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const enable = async () => {
    if (requesting.current) return;
    requesting.current = true;
    setPending(true);
    setError(false);
    try {
      setPermission(await requestBrowserNotificationPermission());
    } catch {
      setError(true);
    } finally {
      requesting.current = false;
      setPending(false);
    }
  };

  if (permission === "unsupported") return null;

  return (
    <div className="border-b border-border px-4 py-3">
      {permission === "default" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => void enable()}
        >
          {pending ? "Ожидание разрешения…" : "Включить системные уведомления"}
        </Button>
      ) : (
        <Typography.Muted role="status">
          {permission === "granted"
            ? "Системные уведомления включены"
            : "Уведомления запрещены. Разрешите их в настройках сайта в браузере."}
        </Typography.Muted>
      )}
      {error && (
        <Typography.Muted role="alert" className="mt-2 block">
          Не удалось запросить разрешение. Попробуйте ещё раз.
        </Typography.Muted>
      )}
    </div>
  );
}
