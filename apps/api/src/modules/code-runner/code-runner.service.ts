import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RunCodeRequestDto, RunCodeResponseDto } from "@packages/dto";

/**
 * Сырой ответ от сервиса `apps/code-runner` (Go).
 */
export interface InternalCodeRunnerResponse {
  status: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  executionTimeMs?: number;
  memoryUsageBytes?: number;
}

@Injectable()
export class CodeRunnerService {
  private readonly logger = new Logger(CodeRunnerService.name);
  private readonly codeRunnerUrl: string;
  private readonly authToken: string;

  constructor(private readonly configService: ConfigService) {
    this.codeRunnerUrl =
      this.configService.get<string>("codeRunner.url") ??
      "http://localhost:8090";
    this.authToken =
      this.configService.get<string>("codeRunner.authToken") ?? "";
  }

  /**
   * Запускает пользовательский код через изолированный сервис `apps/code-runner` (Judge0).
   */
  async runCode(dto: RunCodeRequestDto): Promise<RunCodeResponseDto> {
    const runUrl = `${this.codeRunnerUrl.replace(/\/+$/, "")}/api/v1/run`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.authToken) {
      headers["X-Internal-Token"] = this.authToken;
    }

    try {
      const response = await fetch(runUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          language: dto.language,
          code: dto.code,
          stdin: dto.stdin ?? "",
          timeoutMs: dto.timeoutMs ?? 3000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        this.logger.warn(
          `Code runner responded with HTTP ${response.status}: ${errorText}`,
        );

        return {
          success: false,
          totalTests: 0,
          passedTests: 0,
          results: [],
          logs: [
            `[ERROR] Execution failed (HTTP ${response.status}): ${
              errorText || response.statusText
            }`,
          ],
          totalTimeMs: 0,
          status: "INTERNAL_ERROR",
        };
      }

      const data = (await response.json()) as InternalCodeRunnerResponse;
      return this.mapToResponseDto(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown connection error";
      this.logger.error(`Failed to connect to code runner: ${message}`);

      return {
        success: false,
        totalTests: 0,
        passedTests: 0,
        results: [],
        logs: [
          "[ERROR] Service unavailable: could not connect to code-runner",
          `[ERROR] ${message}`,
        ],
        totalTimeMs: 0,
        status: "SERVICE_UNAVAILABLE",
      };
    }
  }

  /**
   * Преобразует ответ `apps/code-runner` в контракт `RunCodeResponseDto`,
   * совместимый с панелью консоли фронтенда.
   */
  private mapToResponseDto(
    data: InternalCodeRunnerResponse,
  ): RunCodeResponseDto {
    const logs: string[] = [];

    if (data.stdout) {
      const stdoutLines = data.stdout
        .split("\n")
        .filter((_, idx, arr) => idx < arr.length - 1 || _ !== "");
      logs.push(...stdoutLines);
    }

    if (data.stderr) {
      const stderrLines = data.stderr
        .split("\n")
        .filter((_, idx, arr) => idx < arr.length - 1 || _ !== "")
        .map((line) => (line.startsWith("[ERROR]") ? line : `[ERROR] ${line}`));
      logs.push(...stderrLines);
    }

    const isSuccess = data.status === "SUCCESS" && (data.exitCode ?? 0) === 0;

    if (!isSuccess && logs.length === 0) {
      logs.push(`[ERROR] Process finished with status: ${data.status}`);
      if (data.exitCode !== undefined && data.exitCode !== 0) {
        logs.push(`[ERROR] Exit code: ${data.exitCode}`);
      }
    }

    return {
      success: isSuccess,
      totalTests: 0,
      passedTests: 0,
      results: [],
      logs,
      totalTimeMs: data.executionTimeMs ?? 0,
      status: data.status,
      stdout: data.stdout ?? "",
      stderr: data.stderr ?? "",
      exitCode: data.exitCode ?? 0,
      memoryUsageBytes: data.memoryUsageBytes ?? 0,
    };
  }
}
