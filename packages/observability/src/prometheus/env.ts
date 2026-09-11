import { z } from "zod";

export const prometheusEnv = z.object({
  PROMETHEUS_PORT: z.coerce.number().int().min(1024).max(65535).default(9090),
  PROMETHEUS_SCRAPE_INTERVAL: z.string().default("15s"),
  GRAFANA_ADMIN_USER: z.string().default("admin"),
  GRAFANA_ADMIN_PASSWORD: z
    .string()
    .min(1, "GRAFANA_ADMIN_PASSWORD is required"),
});

export type PrometheusEnv = z.infer<typeof prometheusEnv>;

/**
 * Validates and parses Prometheus/Grafana environment variables.
 * Throws immediately if any required variable is missing or invalid.
 */
export function parsePrometheusEnv(): PrometheusEnv {
  return prometheusEnv.parse(process.env);
}
