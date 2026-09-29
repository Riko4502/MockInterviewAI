import {
  InterviewParticipantRole,
  InterviewSessionStatus,
} from "@packages/dto";
import type { PrismaService } from "../../prisma/prisma.service";
import { DashboardService } from "./dashboard.service";
import { DashboardStatsService } from "./dashboard-stats.service";

describe("DashboardStatsService", () => {
  let statsService: DashboardStatsService;
  let prismaMock: {
    interviewSession: {
      count: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };

  const fixedNow = new Date("2026-09-27T12:00:00.000Z");

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(fixedNow);
    prismaMock = {
      interviewSession: {
        count: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };
    statsService = new DashboardStatsService(
      prismaMock as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("getStats", () => {
    it("should compute totals using count and streak using distinct dates without loading full sessions into memory", async () => {
      const today = new Date().toISOString().slice(0, 10);
      prismaMock.interviewSession.count
        .mockResolvedValueOnce(5) // totalInterviews
        .mockResolvedValueOnce(3); // completedInterviews

      prismaMock.$queryRaw
        .mockResolvedValueOnce([{ activityDate: today }]) // distinct dates for streak
        .mockResolvedValueOnce([{ totalMinutes: 135 }]); // practice time aggregation

      const stats = await statsService.getStats("user-1");

      expect(stats.totalInterviews).toBe(5);
      expect(stats.completedInterviews).toBe(3);
      expect(stats.totalPracticeTimeMinutes).toBe(135);
      expect(stats.currentStreakDays).toBe(1);
      expect(stats.maxStreakDays).toBe(1);
      expect(stats.averageScore).toBeNull();
      expect(stats.solvedTasks).toEqual({
        total: 0,
        easy: 0,
        medium: 0,
        hard: 0,
      });

      // Verify count was called with correct filter
      expect(prismaMock.interviewSession.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { userId: "user-1" },
            { participants: { some: { userId: "user-1" } } },
          ],
        },
      });
      expect(prismaMock.interviewSession.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { userId: "user-1" },
            { participants: { some: { userId: "user-1" } } },
          ],
          status: InterviewSessionStatus.CLOSED,
        },
      });
    });

    it("should return 0 stats and null average score when user has no completed sessions", async () => {
      prismaMock.interviewSession.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      prismaMock.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ totalMinutes: 0 }]);

      const stats = await statsService.getStats("user-1");

      expect(stats.totalInterviews).toBe(1);
      expect(stats.completedInterviews).toBe(0);
      expect(stats.averageScore).toBeNull();
      expect(stats.totalPracticeTimeMinutes).toBe(0);
      expect(stats.currentStreakDays).toBe(0);
      expect(stats.maxStreakDays).toBe(0);
    });
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

    it("should be stable around midnight UTC when evaluated at 23:59:59.999", () => {
      jest.setSystemTime(new Date("2026-09-27T23:59:59.999Z"));
      const today = new Date("2026-09-27T01:00:00.000Z");
      const yesterday = new Date("2026-09-26T20:00:00.000Z");

      const res = statsService.calculateStreak([yesterday, today]);
      expect(res.currentStreak).toBe(2);
      expect(res.maxStreak).toBe(2);
    });

    it("should be stable around midnight UTC when evaluated at 00:00:00.001", () => {
      jest.setSystemTime(new Date("2026-09-28T00:00:00.001Z"));
      const yesterday = new Date("2026-09-27T23:59:59.000Z");

      const res = statsService.calculateStreak([yesterday]);
      expect(res.currentStreak).toBe(1);
      expect(res.maxStreak).toBe(1);
    });
  });
});

describe("DashboardService", () => {
  let dashboardService: DashboardService;
  let prismaMock: {
    interviewSession: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaMock = {
      interviewSession: {
        findMany: jest.fn(),
      },
    };
    dashboardService = new DashboardService(
      prismaMock as unknown as PrismaService,
    );
  });

  describe("getRecentSessions", () => {
    it("should return recent sessions with score: null and hasFeedbackReport: false when no real feedback exists", async () => {
      const now = new Date("2026-09-27T12:00:00.000Z");
      const started = new Date("2026-09-27T11:00:00.000Z");
      prismaMock.interviewSession.findMany.mockResolvedValue([
        {
          id: "11111111-1111-4111-a111-111111111111",
          startedAt: started,
          endedAt: now,
          createdAt: started,
          participants: [{ role: InterviewParticipantRole.INTERVIEWER }],
        },
        {
          id: "22222222-2222-4222-b222-222222222222",
          startedAt: null,
          endedAt: null,
          createdAt: started,
          participants: [],
        },
      ]);

      const result = await dashboardService.getRecentSessions("user-1", 5);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        id: "11111111-1111-4111-a111-111111111111",
        title: "Mock Session #111111",
        completedAt: now.toISOString(),
        durationMinutes: 60,
        score: null,
        specialization: null,
        level: null,
        role: InterviewParticipantRole.INTERVIEWER,
        hasFeedbackReport: false,
      });

      expect(result.items[1]).toEqual({
        id: "22222222-2222-4222-b222-222222222222",
        title: "Mock Session #222222",
        completedAt: started.toISOString(),
        durationMinutes: 45,
        score: null,
        specialization: null,
        level: null,
        role: InterviewParticipantRole.CANDIDATE,
        hasFeedbackReport: false,
      });

      expect(prismaMock.interviewSession.findMany).toHaveBeenCalledWith({
        where: {
          status: InterviewSessionStatus.CLOSED,
          OR: [
            { userId: "user-1" },
            { participants: { some: { userId: "user-1" } } },
          ],
        },
        take: 5,
        orderBy: { endedAt: "desc" },
        include: {
          participants: {
            where: { userId: "user-1" },
            select: { role: true },
          },
        },
      });
    });

    it("should return empty items when no sessions are found", async () => {
      prismaMock.interviewSession.findMany.mockResolvedValue([]);
      const result = await dashboardService.getRecentSessions("user-1", 5);
      expect(result).toEqual({ items: [] });
    });
  });
});
