import { Injectable, type OnModuleInit } from "@nestjs/common";
import {
  Counter,
  collectDefaultMetrics,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

export type RedisConnectionStatus =
  | "ready"
  | "error"
  | "close"
  | "reconnecting";

export interface HttpRequestLabels {
  method: string;
  route: string;
  statusCode: number;
}

/**
 * Централизованный сервис Prometheus-метрик приложения (SPEC.md, §8).
 *
 * Регистрирует кастомные коллекторы (HTTP, Redis клиент) в общий реестр и
 * включает дефолтные Node.js-метрики (`collectDefaultMetrics`).
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry = new Registry();

  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly activeRequests: Gauge<string>;

  private readonly redisConnectionStatus: Gauge<string>;
  private readonly redisClientErrorsTotal: Counter<string>;

  constructor() {
    this.httpRequestsTotal = new Counter({
      name: "http_requests_total",
      help: "Total number of HTTP requests processed",
      labelNames: ["method", "route", "status_code"],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: "http_request_duration_seconds",
      help: "Duration of HTTP requests in seconds",
      labelNames: ["method", "route"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.activeRequests = new Gauge({
      name: "nestjs_active_requests",
      help: "Number of HTTP requests currently being handled",
      registers: [this.registry],
    });

    this.redisConnectionStatus = new Gauge({
      name: "redis_connection_status",
      help: "Current Redis connection status (1 for the active status, 0 otherwise)",
      labelNames: ["status"],
      registers: [this.registry],
    });

    this.redisClientErrorsTotal = new Counter({
      name: "redis_client_errors_total",
      help: "Total number of Redis client errors by error type",
      labelNames: ["error_type"],
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry });
  }

  requestStarted(): void {
    this.activeRequests.inc();
  }

  requestFinished(labels: HttpRequestLabels, durationMs: number): void {
    this.activeRequests.dec();
    this.httpRequestsTotal.inc({
      method: labels.method,
      route: labels.route,
      status_code: String(labels.statusCode),
    });
    this.httpRequestDuration.observe(
      { method: labels.method, route: labels.route },
      durationMs / 1000,
    );
  }

  setRedisStatus(status: RedisConnectionStatus): void {
    for (const candidate of ["ready", "error", "close", "reconnecting"]) {
      this.redisConnectionStatus.set(
        { status: candidate },
        candidate === status ? 1 : 0,
      );
    }
  }

  incRedisError(errorType: string): void {
    this.redisClientErrorsTotal.inc({ error_type: errorType });
  }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
