import type { ReactNode } from "react";

export const STAT_METRICS = [
  "totalInterviews",
  "currentStreak",
  "averageScore",
  "solvedTasks",
] as const;

export function DashboardStatsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  );
}
