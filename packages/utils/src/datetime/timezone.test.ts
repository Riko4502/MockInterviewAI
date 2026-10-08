import { describe, expect, it } from "vitest";

import {
  getTimeZoneRejection,
  isIanaTimeZoneFormat,
  isResolvableTimeZone,
  isValidTimeZone,
} from "./timezone";

describe("isIanaTimeZoneFormat", () => {
  it("принимает идентификаторы IANA с одним и двумя сегментами", () => {
    expect(isIanaTimeZoneFormat("Europe/Moscow")).toBe(true);
    expect(isIanaTimeZoneFormat("America/Argentina/Buenos_Aires")).toBe(true);
    expect(isIanaTimeZoneFormat("Etc/GMT+5")).toBe(true);
    expect(isIanaTimeZoneFormat("UTC")).toBe(true);
  });

  it("отклоняет offset-таймзоны, которые Intl принимает как валидные", () => {
    // С ES2024 `Intl.DateTimeFormat` резолвит и offset-формы. Если бы шага с
    // форматом не было, в `User.timezone` попал бы фиксированный сдвиг.
    expect(isResolvableTimeZone("+04:00")).toBe(true);
    expect(isIanaTimeZoneFormat("+04:00")).toBe(false);
    expect(isIanaTimeZoneFormat("-0730")).toBe(false);
  });

  it("отклоняет мусор и пустое значение", () => {
    expect(isIanaTimeZoneFormat("")).toBe(false);
    expect(isIanaTimeZoneFormat("Europe")).toBe(false);
    expect(isIanaTimeZoneFormat("Europe/Moscow; DROP TABLE")).toBe(false);
    expect(isIanaTimeZoneFormat("Europe//Moscow")).toBe(false);
  });
});

describe("isResolvableTimeZone", () => {
  it("отклоняет несуществующую зону, даже если формат верный", () => {
    expect(isIanaTimeZoneFormat("Europe/Moscowx")).toBe(true);
    expect(isResolvableTimeZone("Europe/Moscowx")).toBe(false);
  });
});

describe("getTimeZoneRejection", () => {
  it("различает форматную ошибку и нерезолвимость", () => {
    expect(getTimeZoneRejection("Europe/Moscow")).toBeNull();
    expect(getTimeZoneRejection("Europe")).toBe("format");
    expect(getTimeZoneRejection("Europe/Moscowx")).toBe("unresolvable");
    expect(getTimeZoneRejection("Europe/".padEnd(65, "x"))).toBe("too_long");
  });

  it("isValidTimeZone согласован с getTimeZoneRejection", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Europe/Moscowx")).toBe(false);
  });
});
