import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

const setThemeMock = vi.fn();
let mockTheme = "dark";
let mockResolvedTheme = "dark";

vi.mock("@model/ThemeProvider", () => ({
  useTheme: () => ({
    theme: mockTheme,
    resolvedTheme: mockResolvedTheme,
    setTheme: (t: string) => {
      mockTheme = t;
      setThemeMock(t);
    },
  }),
}));

describe("ThemeToggle", () => {
  let cookieJar = "";

  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme = "dark";
    mockResolvedTheme = "dark";
    cookieJar = "";
    Object.defineProperty(document, "cookie", {
      get: () => cookieJar,
      set: (val: string) => {
        cookieJar = cookieJar ? `${cookieJar}; ${val}` : val;
      },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("должен отображать кнопку переключения тем и вызывать смену темы с записью в куки", () => {
    const onThemeChangeMock = vi.fn();
    render(<ThemeToggle onThemeChange={onThemeChangeMock} />);

    const button = screen.getByRole("button", { name: "Переключить тему" });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    // Из dark при allowSystem переходит в light
    expect(setThemeMock).toHaveBeenCalledWith("light");
    expect(document.cookie).toContain("theme=light");
    expect(onThemeChangeMock).toHaveBeenCalledWith("light");
  });

  it("должен циклически переключать темы dark -> light -> system при allowSystem", () => {
    const { rerender } = render(<ThemeToggle allowSystem />);

    const button = screen.getByRole("button", { name: "Переключить тему" });

    // 1. dark -> light
    fireEvent.click(button);
    expect(setThemeMock).toHaveBeenCalledWith("light");

    // 2. light -> system
    mockTheme = "light";
    mockResolvedTheme = "light";
    rerender(<ThemeToggle allowSystem />);
    fireEvent.click(button);
    expect(setThemeMock).toHaveBeenCalledWith("system");

    // 3. system -> dark
    mockTheme = "system";
    mockResolvedTheme = "dark";
    rerender(<ThemeToggle allowSystem />);
    fireEvent.click(button);
    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("должен переключать только light <-> dark, если allowSystem = false", () => {
    mockTheme = "dark";
    mockResolvedTheme = "dark";
    render(<ThemeToggle allowSystem={false} />);

    const button = screen.getByRole("button", { name: "Переключить тему" });
    fireEvent.click(button);

    expect(setThemeMock).toHaveBeenCalledWith("light");
  });
});
