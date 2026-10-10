import { describe, expect, it } from "vitest";

import {
  parseLocalDateTime,
  resolveLocalTimeToUtc,
  slotEndsAt,
  slotsOverlap,
  utcToLocalDateTime,
} from "./slots";

describe("parseLocalDateTime", () => {
  it("разбирает корректное локальное время", () => {
    expect(parseLocalDateTime("2026-10-20T16:00")).toEqual({
      year: 2026,
      month: 10,
      day: 20,
      hours: 16,
      minutes: 0,
    });
  });

  it("отклоняет формат со смещением и без минут", () => {
    expect(parseLocalDateTime("2026-10-20T16:00:00Z")).toBe("malformed");
    expect(parseLocalDateTime("2026-10-20T16:00+03:00")).toBe("malformed");
    expect(parseLocalDateTime("2026-10-20 16:00")).toBe("malformed");
    expect(parseLocalDateTime("2026-10-20")).toBe("malformed");
  });

  it("отклоняет даты, которых в календаре нет", () => {
    expect(parseLocalDateTime("2026-02-30T10:00")).toBe("malformed");
    expect(parseLocalDateTime("2026-13-01T10:00")).toBe("malformed");
    expect(parseLocalDateTime("2026-00-10T10:00")).toBe("malformed");
    expect(parseLocalDateTime("2026-10-20T24:00")).toBe("malformed");
    expect(parseLocalDateTime("2026-10-20T16:60")).toBe("malformed");
  });

  it("учитывает длину месяца", () => {
    expect(parseLocalDateTime("2026-02-28T10:00")).toEqual({
      year: 2026,
      month: 2,
      day: 28,
      hours: 10,
      minutes: 0,
    });
    expect(parseLocalDateTime("2028-02-29T10:00")).not.toBe("malformed");
    expect(parseLocalDateTime("2026-02-29T10:00")).toBe("malformed");
  });
});

describe("resolveLocalTimeToUtc", () => {
  it("переводит локальное время в UTC-инстант", () => {
    const resolved = resolveLocalTimeToUtc("2026-10-20T16:00", "Europe/Moscow");

    expect(resolved).toEqual({
      ok: true,
      utc: new Date("2026-10-20T13:00:00.000Z"),
    });
  });

  it("учитывает зону, а не смещение, зашитое в клиентский запрос", () => {
    const moscow = resolveLocalTimeToUtc("2026-10-20T16:00", "Europe/Moscow");
    const newYork = resolveLocalTimeToUtc(
      "2026-10-20T16:00",
      "America/New_York",
    );

    expect(moscow.ok && moscow.utc.toISOString()).toBe(
      "2026-10-20T13:00:00.000Z",
    );
    expect(newYork.ok && newYork.utc.toISOString()).toBe(
      "2026-10-20T20:00:00.000Z",
    );
  });

  it("отклоняет локальное время, которого нет в зоне из-за перехода на летнее время", () => {
    // 2011-03-27 в Europe/Moscow 02:30 не существует: часы переводятся с
    // 03:00 на 04:00. `TZDate` такое значение молча сдвигает на 03:30,
    // поэтому единственный способ заметить дыру — round-trip.
    expect(resolveLocalTimeToUtc("2011-03-27T02:30", "Europe/Moscow")).toEqual({
      ok: false,
      reason: "nonexistent",
    });

    expect(resolveLocalTimeToUtc("2026-03-29T02:30", "Europe/Berlin")).toEqual({
      ok: false,
      reason: "nonexistent",
    });
  });

  it("принимает локальное время вокруг перехода на летнее время", () => {
    expect(resolveLocalTimeToUtc("2011-03-27T03:30", "Europe/Moscow").ok).toBe(
      true,
    );
    expect(resolveLocalTimeToUtc("2011-03-27T01:30", "Europe/Moscow").ok).toBe(
      true,
    );
  });

  it("принимает локальное время вокруг перехода на зимнее время", () => {
    // Обратный переход не вырезает интервал, поэтому оба повторяющихся часа
    // существуют: round-trip возвращает то же локальное время.
    expect(resolveLocalTimeToUtc("2026-10-25T02:30", "Europe/Berlin").ok).toBe(
      true,
    );
  });

  it("не принимает смещение, даже если строка похожа на локальное время", () => {
    expect(resolveLocalTimeToUtc("2026-10-20T16:00Z", "Europe/Moscow")).toEqual(
      {
        ok: false,
        reason: "malformed",
      },
    );
  });
});

describe("utcToLocalDateTime", () => {
  it("возвращает компоненты инстанта в зоне владельца", () => {
    expect(
      utcToLocalDateTime(new Date("2026-10-20T13:00:00.000Z"), "Europe/Moscow"),
    ).toEqual({
      year: 2026,
      month: 10,
      day: 20,
      hours: 16,
      minutes: 0,
    });
  });
});

describe("slotEndsAt", () => {
  it("считает конец интервала по длительности", () => {
    expect(
      slotEndsAt(new Date("2026-10-20T13:00:00.000Z"), 60).toISOString(),
    ).toBe("2026-10-20T14:00:00.000Z");
  });
});

describe("slotsOverlap", () => {
  const start = new Date("2026-10-20T13:00:00.000Z");

  it("считает пересекающимися слоты внутри друг друга", () => {
    expect(
      slotsOverlap(start, 60, new Date("2026-10-20T13:30:00.000Z"), 60),
    ).toBe(true);
  });

  it("не считает пересечением слоты, которые лишь граничат", () => {
    expect(
      slotsOverlap(start, 60, new Date("2026-10-20T14:00:00.000Z"), 60),
    ).toBe(false);
  });

  it("различает одинаковое время при разной длительности", () => {
    expect(
      slotsOverlap(start, 90, new Date("2026-10-20T13:00:00.000Z"), 30),
    ).toBe(true);
  });
});
