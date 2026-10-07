import { describe, expect, it } from "vitest";
import { getGreetingKey } from "./get-greeting-key";

describe("Приветствие по местному времени", () => {
  it.each([
    [0, "evening"],
    [4, "evening"],
    [5, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [17, "afternoon"],
    [18, "evening"],
    [23, "evening"],
  ])("сопоставляет час %s с периодом %s", (hour, period) => {
    expect(getGreetingKey(Number(hour))).toBe(`greeting.${period}`);
  });
});
