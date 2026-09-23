import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBrowserNotificationPermission,
  openNotificationAction,
  requestBrowserNotificationPermission,
  showBrowserNotification,
} from "./browser-notifications";

const payload = { id: "n1", title: "Title", message: "Message" };
const request = vi.fn();
const create = vi.fn();
let permission: NotificationPermission;

beforeEach(() => {
  vi.clearAllMocks();
  permission = "granted";
  vi.stubGlobal(
    "Notification",
    class {
      static get permission() {
        return permission;
      }
      static requestPermission = request;
      constructor(title: string, options: NotificationOptions) {
        create(title, options);
      }
      close = vi.fn();
    },
  );
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("browser notifications", () => {
  it("shows the title, body, existing brand asset and stable tag", () => {
    expect(showBrowserNotification(payload, vi.fn())).toBeDefined();
    expect(create).toHaveBeenCalledWith("Title", {
      body: "Message",
      icon: "/logo.svg",
      tag: "n1",
    });
    expect(request).not.toHaveBeenCalled();
  });
  it("does not show notifications in a visible tab", () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    expect(showBrowserNotification(payload, vi.fn())).toBeUndefined();
    expect(create).not.toHaveBeenCalled();
  });
  it.each([
    "default",
    "denied",
  ] as const)("does not show or prompt for %s permission", async (value) => {
    permission = value;
    showBrowserNotification(payload, vi.fn());
    expect(create).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    if (value === "denied") {
      expect(await requestBrowserNotificationPermission()).toBe("denied");
      expect(request).not.toHaveBeenCalled();
    }
  });
  it("requests permission only when explicitly called with default permission", async () => {
    permission = "default";
    request.mockResolvedValueOnce("granted");
    expect(getBrowserNotificationPermission()).toBe("default");
    expect(request).not.toHaveBeenCalled();
    expect(await requestBrowserNotificationPermission()).toBe("granted");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("handles missing APIs and SSR without touching browser globals", async () => {
    vi.stubGlobal("Notification", undefined);
    expect(getBrowserNotificationPermission()).toBe("unsupported");
    expect(showBrowserNotification(payload, vi.fn())).toBeUndefined();
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    expect(getBrowserNotificationPermission()).toBe("unsupported");
    expect(await requestBrowserNotificationPermission()).toBe("unsupported");
    expect(showBrowserNotification(payload, vi.fn())).toBeUndefined();
    expect(() =>
      openNotificationAction("/x", "/fallback", vi.fn()),
    ).not.toThrow();
  });
  it("closes, focuses and navigates on click", () => {
    const focus = vi.spyOn(window, "focus").mockImplementation(() => {});
    const navigate = vi.fn();
    const native = showBrowserNotification(payload, navigate);
    const event = new Event("click", { cancelable: true });
    native?.onclick?.call(native, event);
    expect(native?.close).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });
  it("isolates constructor errors and logs them in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    create.mockImplementationOnce(() => {
      throw new TypeError("Not supported");
    });
    expect(showBrowserNotification(payload, vi.fn())).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
  it("reports permission request errors", async () => {
    permission = "default";
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    request.mockRejectedValueOnce(new Error("Permission failed"));
    await expect(requestBrowserNotificationPermission()).rejects.toThrow(
      "Permission failed",
    );
    expect(warn).toHaveBeenCalled();
  });
  it.each([
    undefined,
    null,
    "",
    "javascript:alert(1)",
    "data:text/html,test",
    "http://[",
  ])("uses the fallback for an absent or unsafe action: %s", (action) => {
    const navigate = vi.fn();
    openNotificationAction(action, "/dashboard/notifications", navigate);
    expect(navigate).toHaveBeenCalledWith("/dashboard/notifications");
  });
  it("preserves the path, query and hash of an internal action", () => {
    const navigate = vi.fn();
    openNotificationAction(
      "/dashboard/interviews?id=42#details",
      "/fallback",
      navigate,
    );
    expect(navigate).toHaveBeenCalledWith(
      "/dashboard/interviews?id=42#details",
    );
  });
});
