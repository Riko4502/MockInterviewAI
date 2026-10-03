import type { DailyChallengeResponseDtoDifficulty } from "@packages/api";
import type { BadgeVariant } from "@packages/ui";

export function getDailyChallengeBadgeVariant(
  difficulty: DailyChallengeResponseDtoDifficulty,
): BadgeVariant {
  switch (difficulty) {
    case "EASY":
      return "statusSuccess";
    case "MEDIUM":
      return "statusInfo";
    case "HARD":
      return "statusDanger";
  }
}
