import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBrowserTimezone } from "../lib/timezones";
import { useCurrentUser } from "./use-current-user";
import { useViewerTimezone } from "./use-viewer-timezone";

vi.mock("./use-current-user", () => ({
  useCurrentUser: vi.fn(),
}));

const useCurrentUserMock = vi.mocked(useCurrentUser);

describe("useViewerTimezone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("возвращает сохранённую таймзону профиля с приоритетом", () => {
    useCurrentUserMock.mockReturnValue({
      data: { timezone: "Asia/Tokyo" },
    } as unknown as ReturnType<typeof useCurrentUser>);

    const { result } = renderHook(() => useViewerTimezone());

    expect(result.current).toBe("Asia/Tokyo");
  });

  it("падает на таймзону браузера, если профиль недоступен", () => {
    useCurrentUserMock.mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useCurrentUser>);

    const { result } = renderHook(() => useViewerTimezone());

    expect(result.current).toBe(getBrowserTimezone() ?? "UTC");
  });

  it("прокидывает флаг enabled в запрос профиля", () => {
    useCurrentUserMock.mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useCurrentUser>);

    renderHook(() => useViewerTimezone({ enabled: false }));

    expect(useCurrentUserMock).toHaveBeenCalledWith({ enabled: false });
  });
});
