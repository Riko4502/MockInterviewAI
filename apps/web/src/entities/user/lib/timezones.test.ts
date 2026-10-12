import { describe, expect, it } from "vitest";
import {
  buildTimeZoneList,
  getAllTimeZoneIds,
  getBrowserTimezone,
  getTimeZoneLabel,
  getTimeZoneRegion,
  groupTimezones,
  POPULAR_TIMEZONE_IDS,
  regionToKey,
  toTimeZoneItem,
} from "./timezones";

describe("getTimeZoneLabel", () => {
  it("извлекает город для односоставного региона", () => {
    expect(getTimeZoneLabel("Europe/Moscow")).toBe("Moscow");
  });

  it("заменяет подчёркивания на пробелы", () => {
    expect(getTimeZoneLabel("America/New_York")).toBe("New York");
  });

  it("берёт последний сегмент для трёхсоставных id", () => {
    expect(getTimeZoneLabel("America/Argentina/Buenos_Aires")).toBe(
      "Buenos Aires",
    );
  });

  it("возвращает UTC без изменений", () => {
    expect(getTimeZoneLabel("UTC")).toBe("UTC");
  });
});

describe("getTimeZoneRegion", () => {
  it("распознаёт регион по первому сегменту", () => {
    expect(getTimeZoneRegion("Europe/Moscow")).toBe("Europe");
    expect(getTimeZoneRegion("America/New_York")).toBe("America");
  });

  it("выделяет UTC в отдельный регион", () => {
    expect(getTimeZoneRegion("UTC")).toBe("UTC");
  });

  it("относит неизвестные префиксы в Other", () => {
    expect(getTimeZoneRegion("Etc/GMT+5")).toBe("Other");
  });
});

describe("regionToKey", () => {
  it("нормализует регион в i18n-ключ", () => {
    expect(regionToKey("Europe")).toBe("europe");
    expect(regionToKey("UTC")).toBe("utc");
  });
});

describe("toTimeZoneItem", () => {
  it("собирает item с id, label и region", () => {
    expect(toTimeZoneItem("Asia/Tokyo")).toEqual({
      id: "Asia/Tokyo",
      label: "Tokyo",
      region: "Asia",
    });
  });
});

describe("buildTimeZoneList", () => {
  it("включает популярные зоны", () => {
    const ids = buildTimeZoneList().map((item) => item.id);
    for (const popular of POPULAR_TIMEZONE_IDS) {
      expect(ids).toContain(popular);
    }
  });

  it("дополняет список текущим значением, если его нет среди популярных", () => {
    const ids = buildTimeZoneList("Pacific/Pohnpei").map((item) => item.id);
    expect(ids).toContain("Pacific/Pohnpei");
  });

  it("все элементы резолвимы рантаймом", () => {
    for (const item of buildTimeZoneList()) {
      expect(
        () => new Intl.DateTimeFormat(undefined, { timeZone: item.id }),
      ).not.toThrow();
    }
  });
});

describe("getAllTimeZoneIds", () => {
  it("дедуплицирует популярные и поддерживаемые зоны", () => {
    const ids = getAllTimeZoneIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("Europe/Moscow");
  });
});

describe("groupTimezones", () => {
  it("группирует по регионам и сортирует регионы по приоритету", () => {
    const groups = groupTimezones([
      toTimeZoneItem("Asia/Tokyo"),
      toTimeZoneItem("Europe/Paris"),
      toTimeZoneItem("UTC"),
      toTimeZoneItem("Europe/Berlin"),
    ]);

    expect(groups.map((group) => group.region)).toEqual([
      "UTC",
      "Europe",
      "Asia",
    ]);
    expect(groups[1]?.items.map((item) => item.label)).toEqual([
      "Berlin",
      "Paris",
    ]);
  });
});

describe("getBrowserTimezone", () => {
  it("возвращает строку таймзоны в jsdom", () => {
    const tz = getBrowserTimezone();
    expect(typeof tz === "string" || tz === undefined).toBe(true);
  });
});
