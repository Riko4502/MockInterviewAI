import type { BadgeVariants } from "@packages/ui";
import type { TaskDifficulty } from "../model/types";

export const DIFFICULTY_LOCALIZATION: Record<TaskDifficulty, BadgeVariants> = {
  Easy: "statusSuccess",
  Medium: "statusInfo",
  Hard: "statusDanger",
};
