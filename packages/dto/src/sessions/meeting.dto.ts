import { z } from "zod";
import { interviewParticipantRoleSchema } from "./participant.dto";
import { interviewSessionStatusSchema } from "./session-status.dto";

/**
 * Zod schema for creating a meeting (POST /api/v1/sessions/meeting).
 */
export const createMeetingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Meeting title cannot be empty")
    .max(120, "Meeting title must not exceed 120 characters")
    .optional()
    .default("Meeting"),
  description: z
    .string()
    .trim()
    .max(500, "Meeting description must not exceed 500 characters")
    .optional(),
  isPrivate: z.boolean().optional().default(false),
  password: z
    .string()
    .min(4, "Password must be at least 4 characters")
    .max(64, "Password must not exceed 64 characters")
    .optional(),
});

export type CreateMeetingDto = z.infer<typeof createMeetingSchema>;

/**
 * Zod schema for public meeting lobby metadata (GET /api/v1/sessions/:id/lobby).
 */
export const meetingLobbyResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  isPrivate: z.boolean(),
  isPasswordRequired: z.boolean(),
  hostName: z.string(),
  hostAvatar: z.string().nullable().optional(),
  status: interviewSessionStatusSchema,
  participantCount: z.number().int().nonnegative(),
});

export type MeetingLobbyResponseDto = z.infer<
  typeof meetingLobbyResponseSchema
>;

/**
 * Zod schema for joining a meeting (POST /api/v1/sessions/:id/join-meeting).
 */
export const joinMeetingSchema = z.object({
  guestName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must not exceed 50 characters")
    .optional(),
  password: z.string().optional(),
  inviteToken: z.string().optional(),
});

export type JoinMeetingDto = z.infer<typeof joinMeetingSchema>;

/**
 * Zod schema for join meeting response with LiveKit media token.
 */
export const joinMeetingResponseSchema = z.object({
  role: interviewParticipantRoleSchema,
  inviteToken: z.string().optional(),
  mediaToken: z.string(),
  serverUrl: z.string(),
  roomName: z.string(),
  participantId: z.string(),
  displayName: z.string(),
});

export type JoinMeetingResponseDto = z.infer<typeof joinMeetingResponseSchema>;
