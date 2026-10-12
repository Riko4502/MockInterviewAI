import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { getBrowserTimezone } from "../lib/timezones";
import { TimezoneSelect } from "./TimezoneSelect";

describe("TimezoneSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage("ru");
  });

  it("отображает подпись выбранной зоны в триггере", () => {
    render(<TimezoneSelect value="Europe/Moscow" onValueChange={vi.fn()} />);

    expect(screen.getByRole("combobox")).toHaveTextContent("Moscow");
  });

  it("открывает список с локализованными регионами и поиском", () => {
    render(<TimezoneSelect value="Europe/Moscow" onValueChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("combobox"));

    expect(
      screen.getByPlaceholderText("Поиск часового пояса..."),
    ).toBeInTheDocument();
    expect(screen.getByText("Европа")).toBeInTheDocument();
  });

  it("фильтрует и выбирает зону, вызывая onValueChange", () => {
    const onValueChange = vi.fn();
    render(
      <TimezoneSelect value="Europe/Moscow" onValueChange={onValueChange} />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByPlaceholderText("Поиск часового пояса..."), {
      target: { value: "tokyo" },
    });
    fireEvent.click(screen.getByText("Tokyo"));

    expect(onValueChange).toHaveBeenCalledWith("Asia/Tokyo");
  });

  it("определяет таймзону браузера по кнопке", () => {
    const onValueChange = vi.fn();
    render(
      <TimezoneSelect value="Europe/Moscow" onValueChange={onValueChange} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Определить автоматически" }),
    );

    const detected = getBrowserTimezone();
    if (detected) {
      expect(onValueChange).toHaveBeenCalledWith(detected);
    }
  });

  it("блокирует контролы в disabled-состоянии", () => {
    render(
      <TimezoneSelect value="Europe/Moscow" onValueChange={vi.fn()} disabled />,
    );

    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Определить автоматически" }),
    ).toBeDisabled();
  });
});
