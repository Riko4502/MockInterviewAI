import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { DashboardCacheService } from "./dashboard-cache.service";
import { DashboardChallengeService } from "./dashboard-challenge.service";
import { DashboardLiveMatchService } from "./dashboard-live-match.service";
import { DashboardReadinessService } from "./dashboard-readiness.service";
import { DashboardStatsService } from "./dashboard-stats.service";

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    DashboardStatsService,
    DashboardReadinessService,
    DashboardChallengeService,
    DashboardLiveMatchService,
    DashboardCacheService,
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
