import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  DailyChallengeResponseDto,
  DashboardInsightsResponseDto,
  DashboardMatchRequestsResponseDto,
  DashboardReadinessResponseDto,
  DashboardStatsResponseDto,
  dailyChallengeResponseSchema,
  dashboardInsightsResponseSchema,
  dashboardMatchRequestsResponseSchema,
  dashboardReadinessResponseSchema,
  dashboardStatsResponseSchema,
  LiveMatchStatusResponseDto,
  LiveMatchToggleDto,
  liveMatchStatusResponseSchema,
  liveMatchToggleSchema,
  RecentSessionsResponseDto,
  recentSessionsResponseSchema,
  ShowcaseStatusResponseDto,
  showcaseStatusResponseSchema,
  UpcomingSessionResponseDto,
  upcomingSessionResponseSchema,
} from "@packages/dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { registerSchema, ZodBody } from "../../common/openapi/zod-openapi";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { DashboardService } from "./dashboard.service";
import { DashboardCacheService } from "./dashboard-cache.service";
import { DashboardChallengeService } from "./dashboard-challenge.service";
import { DashboardLiveMatchService } from "./dashboard-live-match.service";
import { DashboardReadinessService } from "./dashboard-readiness.service";
import { DashboardStatsService } from "./dashboard-stats.service";

@ApiTags("Dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly statsService: DashboardStatsService,
    private readonly readinessService: DashboardReadinessService,
    private readonly challengeService: DashboardChallengeService,
    private readonly liveMatchService: DashboardLiveMatchService,
    private readonly cacheService: DashboardCacheService,
  ) {}

  /**
   * 1. Ближайшая запланированная или активная сессия.
   */
  @Get("upcoming")
  @ApiOperation({
    summary: "Получить ближайшее запланированное или активное интервью",
  })
  @ApiResponse({
    status: 200,
    description:
      "Информация о ближайшем интервью с таймером и статусом готовности",
    schema: registerSchema(
      "UpcomingSessionResponseDto",
      upcomingSessionResponseSchema,
    ),
  })
  async getUpcoming(
    @CurrentUser("sub") userId: string,
  ): Promise<UpcomingSessionResponseDto> {
    return this.cacheService.getOrSet(
      `cache:dashboard:upcoming:${userId}`,
      15,
      () => this.dashboardService.getUpcomingSession(userId),
    );
  }

  /**
   * 2. Чек-лист готовности профиля (Онбординг).
   */
  @Get("readiness")
  @ApiOperation({
    summary: "Получить процент готовности профиля и статус шагов онбординга",
  })
  @ApiResponse({
    status: 200,
    description: "Процент готовности и список шагов с actionUrl",
    schema: registerSchema(
      "DashboardReadinessResponseDto",
      dashboardReadinessResponseSchema,
    ),
  })
  async getReadiness(
    @CurrentUser("sub") userId: string,
  ): Promise<DashboardReadinessResponseDto> {
    return this.cacheService.getOrSet(
      `cache:dashboard:readiness:${userId}`,
      300,
      () => this.readinessService.getReadiness(userId),
    );
  }

  /**
   * 3. Алгоритмическая задача дня.
   */
  @Get("daily-challenge")
  @ApiOperation({
    summary: "Получить сегодняшнюю задачу дня по алгоритмам",
  })
  @ApiResponse({
    status: 200,
    description: "Задача дня с бейджем сложности и статусом решения",
    schema: registerSchema(
      "DailyChallengeResponseDto",
      dailyChallengeResponseSchema,
    ),
  })
  async getDailyChallenge(
    @CurrentUser("sub") userId: string,
  ): Promise<DailyChallengeResponseDto> {
    const today = new Date().toISOString().slice(0, 10);
    return this.cacheService.getOrSet(
      `cache:daily-challenge:${today}:${userId}`,
      3600,
      () => this.challengeService.getDailyChallenge(userId),
    );
  }

  /**
   * 4. Переключение режима живого поиска напарника (Live Match).
   */
  @Post("live-match/toggle")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Включить или выключить режим мгновенного поиска напарника",
  })
  @ZodBody(liveMatchToggleSchema, "LiveMatchToggleDto")
  @ApiResponse({
    status: 200,
    description: "Текущий статус поиска напарника (IDLE, SEARCHING, MATCHED)",
    schema: registerSchema(
      "LiveMatchStatusResponseDto",
      liveMatchStatusResponseSchema,
    ),
  })
  async toggleLiveMatch(
    @CurrentUser("sub") userId: string,
    @Body(new ZodValidationPipe(liveMatchToggleSchema)) dto: LiveMatchToggleDto,
  ): Promise<LiveMatchStatusResponseDto> {
    return this.liveMatchService.toggleLiveMatch(userId, dto);
  }

  /**
   * 5. Входящие заявки на собеседование (MatchRequest).
   */
  @Get("match-requests")
  @ApiOperation({
    summary: "Получить входящие запросы на собеседование с витрины",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    schema: { type: "integer", default: 5, maximum: 20 },
  })
  @ApiResponse({
    status: 200,
    description: "Список входящих заявок в статусе PENDING",
    schema: registerSchema(
      "DashboardMatchRequestsResponseDto",
      dashboardMatchRequestsResponseSchema,
    ),
  })
  async getMatchRequests(
    @CurrentUser("sub") userId: string,
    @Query("limit", new DefaultValuePipe(5), new ParseIntPipe()) limit: number,
  ): Promise<DashboardMatchRequestsResponseDto> {
    return this.dashboardService.getMatchRequests(
      userId,
      Math.min(20, Math.max(1, limit)),
    );
  }

  /**
   * 6. KPI-метрики, стрик дней активности и решенные задачи.
   */
  @Get("stats")
  @ApiOperation({
    summary: "Получить сводные показатели активности и стрик кандидата",
  })
  @ApiResponse({
    status: 200,
    description: "Метрики: интервью, стрик дней, задачи, средний балл",
    schema: registerSchema(
      "DashboardStatsResponseDto",
      dashboardStatsResponseSchema,
    ),
  })
  async getStats(
    @CurrentUser("sub") userId: string,
  ): Promise<DashboardStatsResponseDto> {
    return this.cacheService.getOrSet(
      `cache:dashboard:stats:${userId}`,
      600,
      () => this.statsService.getStats(userId),
    );
  }

  /**
   * 7. Последние завершенные сессии.
   */
  @Get("recent-sessions")
  @ApiOperation({
    summary: "Получить список последних завершенных интервью",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    schema: { type: "integer", default: 5, maximum: 10 },
  })
  @ApiResponse({
    status: 200,
    description: "Список недавних сессий с оценками и ссылками на отчеты",
    schema: registerSchema(
      "RecentSessionsResponseDto",
      recentSessionsResponseSchema,
    ),
  })
  async getRecentSessions(
    @CurrentUser("sub") userId: string,
    @Query("limit", new DefaultValuePipe(5), new ParseIntPipe()) limit: number,
  ): Promise<RecentSessionsResponseDto> {
    return this.cacheService.getOrSet(
      `cache:dashboard:recent:${userId}:${limit}`,
      60,
      () =>
        this.dashboardService.getRecentSessions(
          userId,
          Math.min(10, Math.max(1, limit)),
        ),
    );
  }

  /**
   * 8. Рекомендации AI («Зоны роста»).
   */
  @Get("insights")
  @ApiOperation({
    summary:
      "Получить рекомендации AI по зонам роста на основе прошлых интервью",
  })
  @ApiResponse({
    status: 200,
    description: "Слабые темы и ссылки на практические материалы в песочнице",
    schema: registerSchema(
      "DashboardInsightsResponseDto",
      dashboardInsightsResponseSchema,
    ),
  })
  async getInsights(
    @CurrentUser("sub") userId: string,
  ): Promise<DashboardInsightsResponseDto> {
    return this.cacheService.getOrSet(
      `cache:dashboard:insights:${userId}`,
      1800,
      () => this.dashboardService.getInsights(userId),
    );
  }

  /**
   * 9. Статус анкеты текущего пользователя на витрине.
   */
  @Get("showcase-status")
  @ApiOperation({
    summary: "Получить статус анкеты на витрине поиска напарников",
  })
  @ApiResponse({
    status: 200,
    description: "Статус карточки: оставшиеся дни, просмотры, возможность bump",
    schema: registerSchema(
      "ShowcaseStatusResponseDto",
      showcaseStatusResponseSchema,
    ),
  })
  async getShowcaseStatus(
    @CurrentUser("sub") userId: string,
  ): Promise<ShowcaseStatusResponseDto> {
    return this.cacheService.getOrSet(
      `cache:dashboard:showcase:${userId}`,
      60,
      () => this.dashboardService.getShowcaseStatus(userId),
    );
  }
}
