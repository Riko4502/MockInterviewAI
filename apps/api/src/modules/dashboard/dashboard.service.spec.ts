import type { PrismaService } from "../../prisma/prisma.service";
import { DashboardStatsService } from "./dashboard-stats.service";

describe("DashboardStatsService", () => {
  let statsService: DashboardStatsService;

  beforeEach(() => {
    statsService = new DashboardStatsService({} as unknown as PrismaService);
  });

  describe("calculateStreak", () => {
    it("should return 0 streak for empty dates", () => {
      const res = statsService.calculateStreak([]);
      expect(res).toEqual({ currentStreak: 0, maxStreak: 0 });
    });

    it("should return 1 streak if activity was today", () => {
      const today = new Date();
      const res = statsService.calculateStreak([today]);
      expect(res.currentStreak).toBe(1);
      expect(res.maxStreak).toBe(1);
    });

    it("should return 1 streak if activity was yesterday", () => {
      const yesterday = new Date(Date.now() - 86400000);
      const res = statsService.calculateStreak([yesterday]);
      expect(res.currentStreak).toBe(1);
    });

    it("should return 0 streak if last activity was 2 days ago", () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
      const res = statsService.calculateStreak([twoDaysAgo]);
      expect(res.currentStreak).toBe(0);
      expect(res.maxStreak).toBe(1);
    });

    it("should calculate consecutive streak correctly", () => {
      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000);

      const res = statsService.calculateStreak([
        threeDaysAgo,
        twoDaysAgo,
        yesterday,
        today,
      ]);
      expect(res.currentStreak).toBe(4);
      expect(res.maxStreak).toBe(4);
    });
  });
});
