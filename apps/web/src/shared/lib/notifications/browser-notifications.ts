export type BrowserNotificationPermission =
  | NotificationPermission
  | "unsupported";

function diagnose(operation: string, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[BrowserNotifications] ${operation} failed`, error);
  }
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (
    typeof window === "undefined" ||
    typeof window.Notification !== "function" ||
    window.isSecureContext === false
  ) {
    return "unsupported";
  }
  return window.Notification.permission;
}

// Call synchronously from a user gesture, never from an effect.
export async function requestBrowserNotificationPermission() {
  const permission = getBrowserNotificationPermission();
  if (permission !== "default") return permission;
  try {
    return await window.Notification.requestPermission();
  } catch (error) {
    diagnose("Request permission", error);
    throw error;
  }
}

export function openNotificationAction(
  actionUrl: string | null | undefined,
  fallback: string,
  navigate: (path: string) => void,
) {
  if (typeof window === "undefined") return;
  let url: URL;
  try {
    url = new URL(actionUrl || fallback, window.location.origin);
  } catch {
    navigate(fallback);
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    navigate(fallback);
  } else if (url.origin === window.location.origin) {
    navigate(`${url.pathname}${url.search}${url.hash}`);
  } else {
    window.location.assign(url.href);
  }
}

export function showBrowserNotification(
  notification: { id: string; title: string; message: string },
  onClick: () => void,
): Notification | undefined {
  try {
    if (
      getBrowserNotificationPermission() !== "granted" ||
      typeof document === "undefined" ||
      document.visibilityState !== "hidden"
    ) {
      return;
    }
    const native = new window.Notification(notification.title, {
      body: notification.message,
      icon: "/logo.svg",
      tag: notification.id,
    });
    native.onclick = (event) => {
      event.preventDefault();
      closeBrowserNotification(native);
      try {
        window.focus();
      } catch (error) {
        diagnose("Focus window", error);
      }
      try {
        onClick();
      } catch (error) {
        diagnose("Open notification action", error);
      }
    };
    native.onerror = (event) => diagnose("Display notification", event);
    return native;
  } catch (error) {
    diagnose("Create notification", error);
  }
}

export function closeBrowserNotification(notification: Notification) {
  try {
    notification.close();
  } catch (error) {
    diagnose("Close notification", error);
  }
}
