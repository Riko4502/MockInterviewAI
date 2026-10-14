import { describe, expect, it } from "vitest";
import { formatDateTime, formatInstantInTimeZone } from "./format";

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

describe("formatDateTime", () => {
  it("возвращает дефис при null, undefined или пустом значении", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("")).toBe("—");
  });

  it("форматирует дату и время по умолчанию в UTC и ru-RU", () => {
    const result = formatDateTime("2026-02-15T10:00:00.000Z");
    expect(result).toContain("15.02.2026");
    expect(result).toContain("10:00");
  });

  it("позволяет отключить время через includeTime: false", () => {
    const result = formatDateTime("2026-02-15T10:00:00.000Z", {
      includeTime: false,
    });
    expect(result).toBe("15.02.2026");
  });

  it("позволяет задать кастомный timeZone и locale", () => {
    const result = formatDateTime("2026-02-15T10:00:00.000Z", {
      timeZone: "Europe/Moscow",
    });
    // UTC+3: 10:00 UTC -> 13:00 MSK
    expect(result).toContain("15.02.2026");
    expect(result).toContain("13:00");
  });
});
