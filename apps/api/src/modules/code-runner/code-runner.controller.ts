import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  type RunCodeRequestDto,
  type RunCodeResponseDto,
  runCodeRequestSchema,
} from "@packages/dto";
import { Public } from "../../common/decorators/public.decorator";
import { registerSchema, ZodBody } from "../../common/openapi/zod-openapi";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CodeRunnerService } from "./code-runner.service";

/**
 * Контроллер выполнения кода (`/api/v1/code`).
 *
 * Предоставляет эндпоинт для безопасного исполнения пользовательского кода
 * в песочнице (Judge0) через внутренний сервис `apps/code-runner`.
 * Доступен как авторизованным пользователям, так и гостям в интервью-комнате (@Public).
 * Защищен строгим rate limit: не более 20 запусков в минуту.
 */
@ApiTags("Code")
@Controller("code")
export class CodeRunnerController {
  constructor(private readonly codeRunnerService: CodeRunnerService) {}

  /**
   * Выполняет код пользователя в песочнице.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("run")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Запустить код пользователя в изолированной песочнице",
    description:
      "Отправляет код на исполнение в Judge0 через сервис apps/code-runner, возвращая stdout, stderr, время выполнения и статус.",
  })
  @ZodBody(runCodeRequestSchema, "RunCodeRequestDto")
  @ApiResponse({
    status: 200,
    description: "Результат выполнения кода",
    schema: registerSchema("RunCodeResponseDto", {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          description: "Успешность выполнения программы",
        },
        totalTests: { type: "number", description: "Общее число тестов" },
        passedTests: { type: "number", description: "Число пройденных тестов" },
        results: {
          type: "array",
          items: { type: "object" },
          description: "Результаты тест-кейсов",
        },
        logs: {
          type: "array",
          items: { type: "string" },
          description: "Логи вывода stdout/stderr",
        },
        totalTimeMs: { type: "number", description: "Время выполнения в мс" },
        status: {
          type: "string",
          description: "Статус выполнения (SUCCESS, RUNTIME_ERROR, etc.)",
        },
        stdout: { type: "string", description: "Сырой stdout" },
        stderr: { type: "string", description: "Сырой stderr" },
        exitCode: { type: "number", description: "Код выхода процесса" },
        memoryUsageBytes: {
          type: "number",
          description: "Пиковое потребление памяти в байтах",
        },
      },
      required: [
        "success",
        "totalTests",
        "passedTests",
        "results",
        "logs",
        "totalTimeMs",
      ],
    }),
  })
  async run(
    @Body(new ZodValidationPipe(runCodeRequestSchema)) dto: RunCodeRequestDto,
  ): Promise<RunCodeResponseDto> {
    return this.codeRunnerService.runCode(dto);
  }
}
