import type { DailyChallengeResponseDtoDifficulty } from "@packages/api";
import type { BadgeVariant } from "@packages/ui";
import { describe, expect, it } from "vitest";
import { getDailyChallengeBadgeVariant } from "./daily-challenge";

const cases: Array<[DailyChallengeResponseDtoDifficulty, BadgeVariant]> = [
  ["EASY", "statusSuccess"],
  ["MEDIUM", "statusInfo"],
  ["HARD", "statusDanger"],
];

describe("Метки сложности задачи дня", () => {
  it.each(
    cases,
  )("сопоставляет %s с семантическим вариантом метки", (difficulty, variant) => {
    expect(getDailyChallengeBadgeVariant(difficulty)).toBe(variant);
  });
});
