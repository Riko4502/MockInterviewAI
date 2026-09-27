import { DashboardController } from "./dashboard.controller";
import type { DashboardService } from "./dashboard.service";
import type { DashboardCacheService } from "./dashboard-cache.service";
import type { DashboardChallengeService } from "./dashboard-challenge.service";
import type { DashboardLiveMatchService } from "./dashboard-live-match.service";
import type { DashboardReadinessService } from "./dashboard-readiness.service";
import type { DashboardStatsService } from "./dashboard-stats.service";

describe("DashboardController", () => {
  let controller: DashboardController;
  let dashboardServiceMock: Partial<Record<keyof DashboardService, jest.Mock>>;
  let statsServiceMock: Partial<Record<keyof DashboardStatsService, jest.Mock>>;
  let readinessServiceMock: Partial<
    Record<keyof DashboardReadinessService, jest.Mock>
  >;
  let challengeServiceMock: Partial<
    Record<keyof DashboardChallengeService, jest.Mock>
  >;
  let liveMatchServiceMock: Partial<
    Record<keyof DashboardLiveMatchService, jest.Mock>
  >;
  let cacheServiceMock: { getOrSet: jest.Mock };

  const userId = "11111111-1111-4111-a111-111111111111";

  beforeEach(() => {
    dashboardServiceMock = {
      getUpcomingSession: jest
        .fn()
        .mockResolvedValue({ hasUpcoming: false, session: null }),
      getMatchRequests: jest
        .fn()
        .mockResolvedValue({ items: [], totalPendingCount: 0 }),
      getRecentSessions: jest.fn().mockResolvedValue({ items: [] }),
      getInsights: jest.fn().mockResolvedValue({ insights: [] }),
      getShowcaseStatus: jest
        .fn()
        .mockResolvedValue({ hasActiveCard: false, card: null }),
    };

    statsServiceMock = {
      getStats: jest.fn().mockResolvedValue({
        totalInterviews: 5,
        completedInterviews: 4,
        averageScore: 8.5,
        currentStreakDays: 3,
        maxStreakDays: 7,
        solvedTasks: { total: 10, easy: 5, medium: 4, hard: 1 },
        totalPracticeTimeMinutes: 180,
      }),
    };

    readinessServiceMock = {
      getReadiness: jest.fn().mockResolvedValue({
        totalPercentage: 80,
        isFullyReady: false,
        steps: [],
      }),
    };

    challengeServiceMock = {
      getDailyChallenge: jest.fn().mockResolvedValue({
        problemId: "two-sum",
        title: "Two Sum",
        difficulty: "EASY",
        tags: ["Array"],
        timeUntilResetSeconds: 12345,
        isSolvedToday: false,
        pointsReward: 30,
      }),
    };

    liveMatchServiceMock = {
      toggleLiveMatch: jest.fn().mockResolvedValue({
        status: "SEARCHING",
        estimatedWaitSeconds: 45,
      }),
    };

    // getOrSet по умолчанию просто выполняет fallback функцию
    cacheServiceMock = {
      getOrSet: jest
        .fn()
        .mockImplementation((_key, _ttl, fallback) => fallback()),
    };

    controller = new DashboardController(
      dashboardServiceMock as unknown as DashboardService,
      statsServiceMock as unknown as DashboardStatsService,
      readinessServiceMock as unknown as DashboardReadinessService,
      challengeServiceMock as unknown as DashboardChallengeService,
      liveMatchServiceMock as unknown as DashboardLiveMatchService,
      cacheServiceMock as unknown as DashboardCacheService,
    );
  });

  it("should return upcoming session", async () => {
    const res = await controller.getUpcoming(userId);
    expect(res).toEqual({ hasUpcoming: false, session: null });
    expect(cacheServiceMock.getOrSet).toHaveBeenCalledWith(
      `cache:dashboard:upcoming:${userId}`,
      15,
      expect.any(Function),
    );
  });

  it("should return readiness status", async () => {
    const res = await controller.getReadiness(userId);
    expect(res.totalPercentage).toBe(80);
    expect(readinessServiceMock.getReadiness).toHaveBeenCalledWith(userId);
  });

  it("should return daily challenge", async () => {
    const res = await controller.getDailyChallenge(userId);
    expect(res.problemId).toBe("two-sum");
  });

  it("should toggle live match", async () => {
    const res = await controller.toggleLiveMatch(userId, { isSearching: true });
    expect(res.status).toBe("SEARCHING");
    expect(liveMatchServiceMock.toggleLiveMatch).toHaveBeenCalledWith(userId, {
      isSearching: true,
    });
  });

  it("should return stats", async () => {
    const res = await controller.getStats(userId);
    expect(res.currentStreakDays).toBe(3);
    expect(statsServiceMock.getStats).toHaveBeenCalledWith(userId);
  });

  it("should return match requests with limit", async () => {
    const res = await controller.getMatchRequests(userId, 5);
    expect(res).toEqual({ items: [], totalPendingCount: 0 });
    expect(dashboardServiceMock.getMatchRequests).toHaveBeenCalledWith(
      userId,
      5,
    );
  });

  it("should return recent sessions", async () => {
    const res = await controller.getRecentSessions(userId, 5);
    expect(res).toEqual({ items: [] });
    expect(cacheServiceMock.getOrSet).toHaveBeenCalled();
  });

  it("should return insights", async () => {
    const res = await controller.getInsights(userId);
    expect(res.insights).toEqual([]);
    expect(cacheServiceMock.getOrSet).toHaveBeenCalled();
  });

  it("should return showcase status", async () => {
    const res = await controller.getShowcaseStatus(userId);
    expect(res).toEqual({ hasActiveCard: false, card: null });
    expect(cacheServiceMock.getOrSet).toHaveBeenCalled();
  });
});
