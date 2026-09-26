import "@testing-library/jest-dom/vitest";
import { getProfileControllerGetMyProfileQueryKey } from "@packages/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionContext } from "@/entities/session/model/context";
import { usePreferences } from "./use-preferences";

const setThemeMock = vi.fn();
const changeLanguageMock = vi.fn();
const mutateMock = vi.fn();

vi.mock("@packages/ui", () => ({
  useTheme: () => ({
    theme: "dark",
    resolvedTheme: "dark",
    setTheme: setThemeMock,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      language: "ru",
      changeLanguage: changeLanguageMock,
    },
  }),
}));

vi.mock("@packages/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/api")>();
  return {
    ...actual,
    getProfileControllerGetMyProfileQueryKey: () => ["profile", "me"],
    useProfileControllerUpdateMyProfile: () => ({
      mutate: mutateMock,
    }),
  };
});

describe("usePreferences", () => {
  let queryClient: QueryClient;
  let cookieJar = "";

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient();
    cookieJar = "";
    Object.defineProperty(document, "cookie", {
      get: () => cookieJar,
      set: (val: string) => {
        cookieJar = cookieJar ? `${cookieJar}; ${val}` : val;
      },
      configurable: true,
    });
  });

  const createWrapper = (isAuthenticated: boolean) => {
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <SessionContext.Provider
            value={{
              isAuthenticated,
              status: isAuthenticated ? "authenticated" : "unauthenticated",
              startSession: vi.fn(),
              clearSession: vi.fn(),
            }}
          >
            {children}
          </SessionContext.Provider>
        </QueryClientProvider>
      );
    };
  };

  it("должен переключать тему для гостя без вызова API мутации, но с установкой куки", () => {
    const { result } = renderHook(() => usePreferences(), {
      wrapper: createWrapper(false),
    });

    act(() => {
      result.current.changeTheme("light");
    });

    expect(setThemeMock).toHaveBeenCalledWith("light");
    expect(document.cookie).toContain("theme=light");
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("должен переключать тему для авторизованного пользователя с мутацией и обновлением кэша", () => {
    queryClient.setQueryData(getProfileControllerGetMyProfileQueryKey(), {
      id: "u1",
      theme: "dark",
    });

    const { result } = renderHook(() => usePreferences(), {
      wrapper: createWrapper(true),
    });

    act(() => {
      result.current.changeTheme("light");
    });

    expect(setThemeMock).toHaveBeenCalledWith("light");
    expect(document.cookie).toContain("theme=light");
    expect(mutateMock).toHaveBeenCalledWith({ data: { theme: "light" } });

    const cachedData = queryClient.getQueryData<{ theme: string }>(
      getProfileControllerGetMyProfileQueryKey(),
    );
    expect(cachedData?.theme).toBe("light");
  });

  it("должен переключать язык для гостя без вызова API мутации, но с установкой куки", () => {
    const { result } = renderHook(() => usePreferences(), {
      wrapper: createWrapper(false),
    });

    act(() => {
      result.current.changeLocale("en");
    });

    expect(changeLanguageMock).toHaveBeenCalledWith("en");
    expect(document.cookie).toContain("locale=en");
    expect(document.documentElement.lang).toBe("en");
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("должен переключать язык для авторизованного пользователя с мутацией и обновлением кэша", () => {
    queryClient.setQueryData(getProfileControllerGetMyProfileQueryKey(), {
      id: "u1",
      locale: "ru",
    });

    const { result } = renderHook(() => usePreferences(), {
      wrapper: createWrapper(true),
    });

    act(() => {
      result.current.changeLocale("en");
    });

    expect(changeLanguageMock).toHaveBeenCalledWith("en");
    expect(document.cookie).toContain("locale=en");
    expect(mutateMock).toHaveBeenCalledWith({ data: { locale: "en" } });

    const cachedData = queryClient.getQueryData<{ locale: string }>(
      getProfileControllerGetMyProfileQueryKey(),
    );
    expect(cachedData?.locale).toBe("en");
  });

  it("должен циклически переключать тему через toggleTheme (dark -> light -> system)", () => {
    const { result } = renderHook(() => usePreferences(), {
      wrapper: createWrapper(false),
    });

    act(() => {
      result.current.toggleTheme();
    });

    // Из "dark" переключается в "light"
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });
});
