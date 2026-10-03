import { describe, expect, it } from "vitest";
import {
  formatDashboardDate,
  formatDashboardTime,
  formatDuration,
} from "./formatters";

describe("Форматирование данных дашборда", () => {
  it.each([
    [0, "00:00:00"],
    [3661.9, "01:01:01"],
    [90000, "25:00:00"],
    [-1, "00:00:00"],
    [Number.NaN, "00:00:00"],
    [Number.POSITIVE_INFINITY, "00:00:00"],
  ])("форматирует длительность в %s секунд", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
  it("использует заданные локаль и часовой пояс", () => {
    const date = "2026-01-01T23:30:00Z";
    expect(formatDashboardTime(date, "ru", "UTC")).toBe("23:30");
    expect(formatDashboardTime(date, "ru", "Europe/Samara")).toBe("03:30");
    expect(formatDashboardDate(date, "en", "UTC")).toBe("Jan 1, 2026");
    expect(formatDashboardDate(date, "en", "Europe/Samara")).toBe(
      "Jan 2, 2026",
    );
  });
  it("обрабатывает некорректные даты без исключений", () => {
    expect(formatDashboardDate("invalid", "ru", "UTC")).toBe("");
    expect(formatDashboardTime("invalid", "en", "UTC")).toBe("");
  });
});
