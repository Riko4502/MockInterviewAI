"use client";

import { Button, Typography } from "@packages/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import {
  type BrowserNotificationPermission,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from "@/shared/lib/notifications/browser-notifications";

export function BrowserNotificationControl() {
  const { t } = useTranslation("common");
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
          {pending
            ? t("notifications.pendingPermission")
            : t("notifications.enableSystem")}
        </Button>
      ) : (
        <Typography.Muted role="status">
          {permission === "granted"
            ? t("notifications.enabled")
            : t("notifications.denied")}
        </Typography.Muted>
      )}
      {error && (
        <Typography.Muted role="alert" className="mt-2 block">
          {t("notifications.permissionError")}
        </Typography.Muted>
      )}
    </div>
  );
}
