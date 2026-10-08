import { describe, expect, it } from "vitest";

import { formatInstantInTimeZone } from "./format";

describe("formatInstantInTimeZone", () => {
  it("печатает один и тот же инстант по-разному в разных зонах", () => {
    const instant = new Date("2026-10-20T13:00:00.000Z");

    expect(formatInstantInTimeZone(instant, "Europe/Moscow")).toBe(
      "2026-10-20 16:00",
    );
    expect(formatInstantInTimeZone(instant, "America/New_York")).toBe(
      "2026-10-20 09:00",
    );
    expect(formatInstantInTimeZone(instant, "UTC")).toBe("2026-10-20 13:00");
  });

  it("принимает ISO-строку и произвольный паттерн", () => {
    expect(
      formatInstantInTimeZone(
        "2026-10-20T13:00:00.000Z",
        "Asia/Almaty",
        "dd.MM.yyyy HH:mm XXX",
      ),
    ).toBe("20.10.2026 18:00 +05:00");
  });

  it("не зависит от системной зоны процесса", () => {
    // Контейнер API живёт в UTC; если бы паттерн печатал системную зону,
    // рендер в тесте и в проде совпал бы только случайно.
    expect(
      formatInstantInTimeZone(
        new Date("2026-01-20T23:30:00.000Z"),
        "Europe/Moscow",
      ),
    ).toBe("2026-01-21 02:30");
  });
});
