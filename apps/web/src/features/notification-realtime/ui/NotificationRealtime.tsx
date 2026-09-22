"use client";

import {
  getNotificationsControllerGetNotificationsQueryKey,
  getNotificationsControllerGetUnreadCountQueryKey,
  type UnreadNotificationsCountDto,
} from "@packages/api";
import { useToast } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import type { ZodError } from "zod";
import { useSession } from "@/entities/session";
import { openNotificationStream } from "@/shared/api/realtime/notification-stream";
import { paths } from "@/shared/config";
import {
  closeBrowserNotification,
  openNotificationAction,
  showBrowserNotification,
} from "@/shared/lib/notifications/browser-notifications";

import { badgeSchema, newNotificationSchema } from "../model/schemas";

function reportInvalidEvent(type: string, error: ZodError) {
  if (process.env.NODE_ENV === "development") {
    console.warn("[NotificationRealtime] Invalid SSE event", {
      type,
      issues: error.issues,
    });
  }
}

function parseEvent(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function NotificationRealtime() {
  const { t } = useTranslation("common");
  const { isAuthenticated, clearSession } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const getNotificationLabels = useEffectEvent(() => ({
    label: t("notifications.view"),
    altText: t("notifications.open"),
  }));
  const revokeSession = useEffectEvent(() => {
    clearSession();
    queryClient.clear();
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    const stream = openNotificationStream();
    const seen = new Set<string>();
    const toastIds = new Set<string>();
    const nativeNotifications = new Set<Notification>();
    const listKey = getNotificationsControllerGetNotificationsQueryKey();
    const countKey = getNotificationsControllerGetUnreadCountQueryKey();
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: listKey });
      void queryClient.invalidateQueries({ queryKey: countKey });
    };
    const updateCount = (update: (count: number) => number) => {
      // Cancel an older HTTP response before applying the more recent event.
      void queryClient.cancelQueries({ queryKey: countKey }, { revert: false });
      queryClient.setQueryData<UnreadNotificationsCountDto>(
        countKey,
        (data) => ({
          count: update(data?.count ?? 0),
        }),
      );
    };

    stream.addEventListener("open", invalidate);
    stream.addEventListener("notification.new", (event) => {
      const result = newNotificationSchema.safeParse(parseEvent(event.data));
      if (!result.success) {
        reportInvalidEvent("notification.new", result.error);
        return;
      }
      const notification = result.data.payload;
      if (seen.has(notification.id)) return;
      seen.add(notification.id);
      if (seen.size > 1000) {
        const oldest = seen.values().next().value;
        if (oldest !== undefined) seen.delete(oldest);
      }

      updateCount((count) => count + 1);
      const toastId = `notification:${notification.id}`;
      toastIds.add(toastId);
      toast.push({
        id: toastId,
        status: "info",
        title: notification.title,
        description: notification.message,
        action: {
          ...getNotificationLabels(),
          onClick: () => {
            router.push(paths.notifications);
            toast.dismiss(toastId);
          },
        },
        onClose: () => toastIds.delete(toastId),
      });
      invalidate();
      const native = showBrowserNotification(notification, () => {
        openNotificationAction(
          notification.actionUrl,
          paths.notifications,
          (path) => router.push(path),
        );
      });
      if (native) {
        nativeNotifications.add(native);
        native.onclose = () => nativeNotifications.delete(native);
      }
    });
    stream.addEventListener("notification.badge", (event) => {
      const result = badgeSchema.safeParse(parseEvent(event.data));
      if (!result.success) {
        reportInvalidEvent("notification.badge", result.error);
        return;
      }
      updateCount(() => result.data.payload.unreadCount);
      invalidate();
    });
    stream.addEventListener("error", (event) => {
      if (event.code === 401 || event.code === 403) {
        stream.close();
        revokeSession();
      }
    });
    stream.addEventListener("auth.revoked", () => {
      stream.close();
      revokeSession();
    });

    return () => {
      stream.close();
      for (const id of toastIds) toast.dismiss(id);
      for (const native of nativeNotifications) {
        native.onclick = null;
        closeBrowserNotification(native);
      }
      nativeNotifications.clear();
    };
  }, [isAuthenticated, queryClient, router, toast]);

  return null;
}
