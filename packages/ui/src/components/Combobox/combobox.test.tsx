import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Combobox } from "./combobox";
import type { ComboboxGroup } from "./types";

const groups: ComboboxGroup[] = [
  {
    key: "europe",
    label: "Europe",
    options: [
      { value: "Europe/Moscow", label: "Moscow" },
      { value: "Europe/Paris", label: "Paris", keywords: ["france"] },
    ],
  },
  {
    key: "asia",
    label: "Asia",
    options: [{ value: "Asia/Tokyo", label: "Tokyo" }],
  },
];

function renderCombobox(props: Partial<ComponentProps<typeof Combobox>> = {}) {
  return render(
    <Combobox
      groups={groups}
      placeholder="Выберите"
      searchPlaceholder="Поиск"
      emptyText="Ничего не найдено"
      {...props}
    />,
  );
}

describe("Combobox", () => {
  afterEach(() => {
    cleanup();
  });

  it("открывает панель и рендерит группы и опции", () => {
    renderCombobox();

    fireEvent.click(screen.getByRole("combobox"));

    expect(screen.getByPlaceholderText("Поиск")).toBeDefined();
    expect(screen.getByText("Europe")).toBeDefined();
    expect(screen.getByText("Asia")).toBeDefined();
    expect(screen.getByText("Moscow")).toBeDefined();
    expect(screen.getByText("Tokyo")).toBeDefined();
  });

  it("фильтрует опции по запросу (label и keywords)", () => {
    renderCombobox();
    fireEvent.click(screen.getByRole("combobox"));

    const input = screen.getByPlaceholderText("Поиск");
    fireEvent.change(input, { target: { value: "tok" } });

    expect(screen.getByText("Tokyo")).toBeDefined();
    expect(screen.queryByText("Moscow")).toBeNull();

    fireEvent.change(input, { target: { value: "france" } });
    expect(screen.getByText("Paris")).toBeDefined();
    expect(screen.queryByText("Tokyo")).toBeNull();
  });

  it("показывает emptyText, если ничего не найдено", () => {
    renderCombobox();
    fireEvent.click(screen.getByRole("combobox"));

    fireEvent.change(screen.getByPlaceholderText("Поиск"), {
      target: { value: "zzz" },
    });

    expect(screen.getByText("Ничего не найдено")).toBeDefined();
  });

  it("вызывает onValueChange при выборе опции", () => {
    const onValueChange = vi.fn();
    renderCombobox({ onValueChange });

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Paris"));

    expect(onValueChange).toHaveBeenCalledWith("Europe/Paris");
  });

  it("отображает label выбранного значения в триггере", () => {
    renderCombobox({ value: "Asia/Tokyo" });

    expect(screen.getByRole("combobox").textContent).toContain("Tokyo");
  });

  it("не открывается в disabled-состоянии", () => {
    renderCombobox({ disabled: true });

    const trigger = screen.getByRole("combobox") as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);

    fireEvent.click(trigger);
    expect(screen.queryByPlaceholderText("Поиск")).toBeNull();
  });

  it("выбирает активную опцию по Enter", () => {
    const onValueChange = vi.fn();
    renderCombobox({ onValueChange });

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.keyDown(screen.getByPlaceholderText("Поиск"), { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledWith("Europe/Moscow");
  });
});
