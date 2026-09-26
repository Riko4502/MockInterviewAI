import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

const changeLocaleMock = vi.fn();

vi.mock("@/entities/user", () => ({
  usePreferences: () => ({
    locale: "ru",
    changeLocale: changeLocaleMock,
  }),
}));

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage("ru");
  });

  it("должен отображать текущий язык", () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole("button", {
      name: /Сменить язык|actions\.switchLanguage/i,
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("RU");
  });

  it("должен открывать список языков и вызывать changeLocale при выборе", () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole("button", {
      name: /Сменить язык|actions\.switchLanguage/i,
    });
    fireEvent.pointerDown(button, { button: 0 });

    const enOption = screen.getByText("English");
    expect(enOption).toBeInTheDocument();

    fireEvent.click(enOption);
    expect(changeLocaleMock).toHaveBeenCalledWith("en");
  });
});
