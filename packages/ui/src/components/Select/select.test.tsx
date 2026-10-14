import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Select } from "./select";
import type { SelectOption } from "./types";

const mockOptions: SelectOption[] = [
  { value: "opt-1", label: "Вариант 1" },
  { value: "opt-2", label: "Вариант 2" },
  { value: "opt-3", label: "Вариант 3 (отключен)", disabled: true },
];

describe("Select component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with options prop and displays placeholder in trigger", () => {
    render(
      <Select
        options={mockOptions}
        placeholder="Выберите вариант..."
        triggerClassName="custom-trigger"
        data-testid="test-select-1"
      />,
    );

    const trigger = screen.getByTestId("test-select-1");
    expect(trigger).toBeDefined();
    expect(trigger.className).toContain("custom-trigger");
    expect(screen.getByText("Выберите вариант...")).toBeDefined();
  });

  it("renders with defaultValue via options prop", () => {
    render(
      <Select
        options={mockOptions}
        defaultValue="opt-2"
        data-testid="test-select-2"
      />,
    );

    const trigger = screen.getByTestId("test-select-2");
    expect(trigger).toBeDefined();
    expect(screen.getByText("Вариант 2")).toBeDefined();
  });

  it("supports classic compound usage via children", () => {
    render(
      <Select defaultValue="val-1">
        <Select.Trigger data-testid="compound-trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="val-1">Пункт 1</Select.Item>
        </Select.Content>
      </Select>,
    );

    expect(screen.getByTestId("compound-trigger")).toBeDefined();
  });
});
