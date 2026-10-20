import { describe, expect, it } from "vitest";
import { formatCardSlot } from "./format-card-slot";

describe("formatCardSlot", () => {
  it("печатает начало и вычисленный конец в таймзоне смотрящего", () => {
    const result = formatCardSlot("2026-01-15T16:00:00.000Z", "UTC", 60, "en");

    expect(result).toBe("15 January, 16:00 – 17:00");
  });

  it("учитывает длительность при расчёте конца", () => {
    const result = formatCardSlot(
      "2026-01-15T16:00:00.000Z",
      "Europe/Moscow",
      90,
      "en",
    );

    expect(result).toBe("15 January, 19:00 – 20:30");
  });

  it("поддерживает русскую локаль", () => {
    const result = formatCardSlot("2026-01-15T16:00:00.000Z", "UTC", 30, "ru");

    expect(result).toBe("15 января, 16:00 – 16:30");
  });
});
