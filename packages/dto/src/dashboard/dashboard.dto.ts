import { z } from "zod";
import { interviewParticipantRoleSchema } from "../sessions/participant.dto";
import {
  type InterviewSessionStatus,
  interviewSessionStatusSchema,
} from "../sessions/session-status.dto";
import {
  experienceLevelEnum,
  specializationEnum,
} from "../showcase/showcase.enums";

// --- 1. Upcoming Session DTOs ---

export { interviewSessionStatusSchema, type InterviewSessionStatus };

export const upcomingPartnerSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  specialization: specializationEnum.nullable().optional(),
  level: experienceLevelEnum.nullable().optional(),
});
export type UpcomingPartnerDto = z.infer<typeof upcomingPartnerSchema>;

export const upcomingSessionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: interviewSessionStatusSchema,
  scheduledAt: z.string(),
  role: interviewParticipantRoleSchema,
  partner: upcomingPartnerSchema.nullable().optional(),
  isReadyToJoin: z.boolean(),
  secondsUntilStart: z.number().int(),
});
export type UpcomingSessionDto = z.infer<typeof upcomingSessionSchema>;

export const upcomingSessionResponseSchema = z.object({
  hasUpcoming: z.boolean(),
  session: upcomingSessionSchema.nullable().optional(),
});
export type UpcomingSessionResponseDto = z.infer<
  typeof upcomingSessionResponseSchema
>;

// --- 2. Readiness Checklist DTOs ---

export const readinessStepKeyEnum = z.enum([
  "EMAIL_CONFIRMED",
  "MEDIA_CONFIGURED",
  "TELEGRAM_LINKED",
  "SHOWCASE_CREATED",
  "FIRST_MOCK_COMPLETED",
]);
export type ReadinessStepKey = z.infer<typeof readinessStepKeyEnum>;

export const readinessStepSchema = z.object({
  key: readinessStepKeyEnum,
  title: z.string(),
  description: z.string(),
  isCompleted: z.boolean(),
  actionUrl: z.string(),
});
export type ReadinessStepDto = z.infer<typeof readinessStepSchema>;

export const dashboardReadinessResponseSchema = z.object({
  totalPercentage: z.number().int().min(0).max(100),
  isFullyReady: z.boolean(),
  steps: z.array(readinessStepSchema),
});
export type DashboardReadinessResponseDto = z.infer<
  typeof dashboardReadinessResponseSchema
>;

// --- 3. Daily Challenge DTOs ---

export const challengeDifficultyEnum = z.enum(["EASY", "MEDIUM", "HARD"]);
export type ChallengeDifficulty = z.infer<typeof challengeDifficultyEnum>;

export const dailyChallengeResponseSchema = z.object({
  problemId: z.string(),
  title: z.string(),
  difficulty: challengeDifficultyEnum,
  tags: z.array(z.string()),
  timeUntilResetSeconds: z.number().int().nonnegative(),
  isSolvedToday: z.boolean(),
  solvedAt: z.string().nullable().optional(),
  pointsReward: z.number().int().positive(),
});
export type DailyChallengeResponseDto = z.infer<
  typeof dailyChallengeResponseSchema
>;

// --- 4. Live Match DTOs ---

export const liveMatchToggleSchema = z.object({
  isSearching: z.boolean(),
  specialization: specializationEnum,
  level: experienceLevelEnum,
});
export type LiveMatchToggleDto = z.infer<typeof liveMatchToggleSchema>;

export const liveMatchStatusEnum = z.enum(["IDLE", "SEARCHING", "MATCHED"]);
export type LiveMatchStatus = z.infer<typeof liveMatchStatusEnum>;

export const liveMatchStatusResponseSchema = z.object({
  status: liveMatchStatusEnum,
  sessionId: z.string().uuid().nullable().optional(),
  estimatedWaitSeconds: z.number().int().optional(),
});
export type LiveMatchStatusResponseDto = z.infer<
  typeof liveMatchStatusResponseSchema
>;

// --- 5. Stats DTOs ---

export const solvedTasksBreakdownSchema = z.object({
  total: z.number().int().nonnegative(),
  easy: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  hard: z.number().int().nonnegative(),
});
export type SolvedTasksBreakdownDto = z.infer<
  typeof solvedTasksBreakdownSchema
>;

export const dashboardStatsResponseSchema = z.object({
  totalInterviews: z.number().int().nonnegative(),
  completedInterviews: z.number().int().nonnegative(),
  averageScore: z.number().nullable(),
  currentStreakDays: z.number().int().nonnegative(),
  maxStreakDays: z.number().int().nonnegative(),
  solvedTasks: solvedTasksBreakdownSchema,
  totalPracticeTimeMinutes: z.number().int().nonnegative(),
});
export type DashboardStatsResponseDto = z.infer<
  typeof dashboardStatsResponseSchema
>;

// --- 6. Match Requests DTOs ---

export const dashboardMatchRequestItemSchema = z.object({
  id: z.string().uuid(),
  senderId: z.string().uuid(),
  senderName: z.string().nullable(),
  senderAvatarUrl: z.string().nullable().optional(),
  specialization: specializationEnum,
  level: experienceLevelEnum,
  skills: z.array(z.string()),
  createdAt: z.string(),
  message: z.string().nullable().optional(),
});
export type DashboardMatchRequestItemDto = z.infer<
  typeof dashboardMatchRequestItemSchema
>;

export const dashboardMatchRequestsResponseSchema = z.object({
  items: z.array(dashboardMatchRequestItemSchema),
  totalPendingCount: z.number().int().nonnegative(),
});
export type DashboardMatchRequestsResponseDto = z.infer<
  typeof dashboardMatchRequestsResponseSchema
>;

// --- 7. Recent Sessions DTOs ---

export const recentSessionItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  completedAt: z.string(),
  durationMinutes: z.number().int().nonnegative(),
  score: z.number().nullable().optional(),
  specialization: specializationEnum.nullable().optional(),
  level: experienceLevelEnum.nullable().optional(),
  role: interviewParticipantRoleSchema,
  hasFeedbackReport: z.boolean(),
});
export type RecentSessionItemDto = z.infer<typeof recentSessionItemSchema>;

export const recentSessionsResponseSchema = z.object({
  items: z.array(recentSessionItemSchema),
});
export type RecentSessionsResponseDto = z.infer<
  typeof recentSessionsResponseSchema
>;

// --- 8. AI Insights DTOs ---

export const aiInsightCategoryEnum = z.enum([
  "ALGORITHMS",
  "SYSTEM_DESIGN",
  "COMMUNICATION",
  "CODE_QUALITY",
]);
export type AiInsightCategory = z.infer<typeof aiInsightCategoryEnum>;

export const aiInsightItemSchema = z.object({
  id: z.string(),
  category: aiInsightCategoryEnum,
  headline: z.string(),
  recommendation: z.string(),
  practiceUrl: z.string().optional(),
});
export type AiInsightItemDto = z.infer<typeof aiInsightItemSchema>;

export const dashboardInsightsResponseSchema = z.object({
  insights: z.array(aiInsightItemSchema),
  overallSummary: z.string().nullable().optional(),
});
export type DashboardInsightsResponseDto = z.infer<
  typeof dashboardInsightsResponseSchema
>;

// --- 9. Showcase Status DTOs ---

export const activeShowcaseCardDetailsSchema = z.object({
  id: z.string().uuid(),
  specialization: specializationEnum,
  level: experienceLevelEnum,
  isUrgent: z.boolean(),
  expiresAt: z.string(),
  daysLeft: z.number().int().nonnegative(),
  canBump: z.boolean(),
  lastBumpedAt: z.string(),
  viewsCount: z.number().int().nonnegative(),
  incomingRequestsCount: z.number().int().nonnegative(),
});
export type ActiveShowcaseCardDetailsDto = z.infer<
  typeof activeShowcaseCardDetailsSchema
>;

export const showcaseStatusResponseSchema = z.object({
  hasActiveCard: z.boolean(),
  card: activeShowcaseCardDetailsSchema.nullable().optional(),
});
export type ShowcaseStatusResponseDto = z.infer<
  typeof showcaseStatusResponseSchema
>;
