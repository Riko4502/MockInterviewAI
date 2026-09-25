import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BrowserNotificationControl } from "./BrowserNotificationControl";

let permission: NotificationPermission;
const request = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  permission = "default";
  vi.stubGlobal(
    "Notification",
    // biome-ignore lint/complexity/noStaticOnlyClass: Browser API constructor mock.
    class {
      static get permission() {
        return permission;
      }
      static requestPermission = request;
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("requests permission only on click and displays the granted state", async () => {
  request.mockResolvedValueOnce("granted");
  render(<BrowserNotificationControl />);
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Включить системные уведомления" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("включены"),
  );
  expect(request).toHaveBeenCalledOnce();
});

it("does not request permission again after denial", () => {
  permission = "denied";
  render(<BrowserNotificationControl />);
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("запрещены");
  expect(request).not.toHaveBeenCalled();
});

it("hides the control when the API is unavailable", () => {
  vi.stubGlobal("Notification", undefined);
  const { container } = render(<BrowserNotificationControl />);
  expect(container.textContent).toBe("");
  expect(request).not.toHaveBeenCalled();
});

it("refreshes permission after returning from browser settings", () => {
  render(<BrowserNotificationControl />);
  permission = "denied";
  fireEvent(window, new Event("focus"));
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("запрещены");
});

it("shows a recoverable error if the permission request fails", async () => {
  request.mockRejectedValueOnce(new Error("Failed"));
  render(<BrowserNotificationControl />);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
});
