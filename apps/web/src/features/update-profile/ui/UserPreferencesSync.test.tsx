import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserPreferencesSync } from "./UserPreferencesSync";

const setThemeMock = vi.fn();
const changeLanguageMock = vi.fn();

let mockIsAuthenticated = true;
let mockUserData: { theme: string; locale: string } | null = {
  theme: "dark",
  locale: "en",
};

vi.mock("@/entities/session", () => ({
  useSession: () => ({
    isAuthenticated: mockIsAuthenticated,
  }),
}));

vi.mock("@/entities/user", () => ({
  useCurrentUser: () => ({
    data: mockUserData,
  }),
}));

vi.mock("@packages/ui", () => ({
  useTheme: () => ({
    setTheme: setThemeMock,
    theme: "light",
  }),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      i18n: {
        language: "ru",
        changeLanguage: changeLanguageMock,
      },
    }),
  };
});

describe("UserPreferencesSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = true;
    mockUserData = { theme: "dark", locale: "en" };
  });

  it("синхронизирует тему и язык пользователя при загрузке профиля", () => {
    render(<UserPreferencesSync />);

    expect(setThemeMock).toHaveBeenCalledWith("dark");
    expect(changeLanguageMock).toHaveBeenCalledWith("en");
    expect(document.cookie).toContain("theme=dark");
    expect(document.cookie).toContain("locale=en");
  });

  it("ничего не делает, если пользователь не аутентифицирован", () => {
    mockIsAuthenticated = false;
    render(<UserPreferencesSync />);

    expect(setThemeMock).not.toHaveBeenCalled();
    expect(changeLanguageMock).not.toHaveBeenCalled();
  });

  it("не сбрасывает тему повторно, если данные пользователя не менялись", () => {
    const { rerender } = render(<UserPreferencesSync />);
    expect(setThemeMock).toHaveBeenCalledTimes(1);

    // Повторный рендер без изменения профиля (например, переключение темы пользователем)
    rerender(<UserPreferencesSync />);
    expect(setThemeMock).toHaveBeenCalledTimes(1);
  });
});
