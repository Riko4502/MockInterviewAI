import { z } from "zod";

export const sentryEnv = z.object({
  // Required at runtime: без DSN Sentry не активируется (instrument.ts guard).
  SENTRY_DSN: z.string().url("SENTRY_DSN must be a valid URL"),
  // Build-time only (source map upload, Sentry datasource plugin).
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().default("mockinterviewai"),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_ENVIRONMENT: z
    .enum(["development", "staging", "production"])
    .default("production"),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.2),
});

export type SentryEnv = z.infer<typeof sentryEnv>;

/**
 * Validates and parses Sentry environment variables.
 * Throws immediately if SENTRY_DSN is missing or invalid.
 */
export function parseSentryEnv(): SentryEnv {
  return sentryEnv.parse(process.env);
}
