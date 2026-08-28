import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SchemaObject } from "@nestjs/swagger";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  type LoginDto,
  loginSchema,
  type RegisterDto,
  registerSchema,
} from "@packages/dto";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { ZodBody } from "../../common/openapi/zod-openapi";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { AuthThrottlerGuard } from "./guards/auth-throttler.guard";
import { getRefreshTokenTtlSeconds } from "./services/refresh-token-ttl";

/**
 * Схемы ответов для OpenAPI (§61 SPEC.md).
 *
 * Refresh token в схемах отсутствует — он передаётся только через
 * HttpOnly cookie (§25 SPEC.md).
 */
const ACCESS_TOKEN_RESPONSE_SCHEMA: SchemaObject = {
  type: "object",
  properties: {
    accessToken: { type: "string", description: "JWT access token" },
  },
  required: ["accessToken"],
};

const VALIDATION_ERROR_SCHEMA: SchemaObject = {
  type: "object",
  properties: {
    statusCode: { type: "number", example: 400 },
    message: {
      type: "object",
      additionalProperties: { type: "string" },
      example: { email: "Некорректный email" },
      description: "Карта ошибок `{ field: message }`.",
    },
  },
  required: ["statusCode", "message"],
};

const ERROR_RESPONSE_SCHEMA: SchemaObject = {
  type: "object",
  properties: {
    statusCode: { type: "number", example: 401 },
    message: { type: "string", example: "Invalid credentials" },
    error: { type: "string" },
  },
  required: ["statusCode", "message"],
};

const REFRESH_COOKIE_DESCRIPTION =
  "Set-Cookie: refresh_token={JWT}; HttpOnly; SameSite=Lax; " +
  "Path=/api/v1/auth; Max-Age=JWT_REFRESH_EXPIRATION (§25–28 SPEC.md). " +
  "Refresh token не возвращается в JSON response.";

/**
 * Контроллер аутентификации (§36 SPEC.md).
 *
 * Отвечает только за HTTP layer: приём request, валидация DTO,
 * вызов `AuthService`, установка cookie, форматирование response.
 * Бизнес-логика в Controller не размещается.
 */
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  /**
   * @param authService - Сервис аутентификации.
   * @param configService - Конфигурация приложения (секции `cookie.secure`, `cookie.refreshTokenName`).
   */
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Регистрирует нового пользователя (§4, §36 SPEC.md).
   *
   * Принимает `{ email, password }`, валидирует через `ZodValidationPipe`,
   * вызывает `AuthService.register()`, устанавливает HttpOnly refresh cookie,
   * возвращает `{ accessToken }`.
   *
   * Rate limiting (§41 SPEC.md): глобальный по IP + на маршруте
   * `AuthThrottlerGuard` с tracker `ip + body.email` — защита от массовой
   * регистрации одного email с разных IP.
   *
   * @param dto - Валидированный DTO регистрации.
   * @param response - HTTP-ответ Express для установки cookie и статуса.
   * @returns `{ accessToken }` в body.
   */
  @Post("register")
  @Public()
  @UseGuards(AuthThrottlerGuard)
  @ZodBody(registerSchema)
  @ApiOperation({ summary: "Регистрация нового пользователя (§4)" })
  @ApiResponse({
    status: 201,
    description: `Успешная регистрация. ${REFRESH_COOKIE_DESCRIPTION}`,
    schema: ACCESS_TOKEN_RESPONSE_SCHEMA,
  })
  @ApiResponse({
    status: 400,
    description: "Ошибка валидации DTO.",
    schema: VALIDATION_ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 409,
    description: "Email уже зарегистрирован.",
    schema: ERROR_RESPONSE_SCHEMA,
  })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string }> {
    const result = await this.authService.register(dto);

    this.setRefreshTokenCookie(response, result.refreshToken);

    response.status(HttpStatus.CREATED);
    return { accessToken: result.accessToken };
  }

  /**
   * Выполняет вход пользователя (§58 SPEC.md).
   *
   * Принимает `{ email, password }`, валидирует через `ZodValidationPipe`,
   * вызывает `AuthService.login()`, устанавливает HttpOnly refresh cookie
   * (атрибуты §25–28 SPEC.md — идентично register), возвращает `{ accessToken }`.
   *
   * Rate limiting (§41 SPEC.md): глобальный по IP + на маршруте
   * `AuthThrottlerGuard` с tracker `ip + body.email` — защита от brute-force.
   *
   * @param dto - Валидированный DTO входа.
   * @param response - HTTP-ответ Express для установки cookie.
   * @returns `{ accessToken }` в body.
   */
  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @ZodBody(loginSchema)
  @ApiOperation({ summary: "Вход пользователя (§58)" })
  @ApiResponse({
    status: 200,
    description: `Успешный вход. ${REFRESH_COOKIE_DESCRIPTION}`,
    schema: ACCESS_TOKEN_RESPONSE_SCHEMA,
  })
  @ApiResponse({
    status: 400,
    description: "Ошибка валидации DTO.",
    schema: VALIDATION_ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 401,
    description: "Неверные учётные данные (единый ответ без деталей, §59).",
    schema: ERROR_RESPONSE_SCHEMA,
  })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string }> {
    const result = await this.authService.login(dto);

    this.setRefreshTokenCookie(response, result.refreshToken);

    return { accessToken: result.accessToken };
  }

  /**
   * Выполняет выход пользователя (§60 SPEC.md).
   *
   * Refresh token читается из HttpOnly cookie; тело запроса отсутствует.
   * Строгая семантика (§60): при отказе сервиса (`401`) cookie очищается
   * всегда, чтобы клиент мог восстановиться; при ошибке Redis (`500`)
   * cookie не сбрасывается. Успех — `204 No Content`.
   *
   * Origin/Referer проверяет глобальный `OriginCheckGuard` (CSRF, §29).
   *
   * @param request - HTTP-запрос Express (cookie читаются `cookie-parser`).
   * @param response - HTTP-ответ Express для очистки cookie.
   */
  @Post("logout")
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Выход пользователя (§60)" })
  @ApiResponse({
    status: 204,
    description:
      "Успешный выход. Set-Cookie: refresh_token=; Expires=в прошлом — cookie сброшена (§60).",
  })
  @ApiResponse({
    status: 401,
    description:
      "Refresh cookie отсутствует/невалиден. Cookie при этом очищается всегда (§60).",
    schema: ERROR_RESPONSE_SCHEMA,
  })
  @ApiResponse({
    status: 500,
    description:
      "Redis недоступен. Cookie НЕ сбрасывается, чтобы не потерять сессию (§60).",
    schema: ERROR_RESPONSE_SCHEMA,
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    try {
      await this.authService.logout(
        request.cookies?.[this.getRefreshTokenCookieName()],
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.clearRefreshTokenCookie(response);
      }
      throw error;
    }

    this.clearRefreshTokenCookie(response);
  }

  /**
   * Выполняет обновление токенов — refresh token rotation (§65 SPEC.md).
   *
   * Refresh token читается из HttpOnly cookie; тело запроса отсутствует.
   * При успехе — `200 OK`, `{ accessToken }`, Set-Cookie с новым refresh token.
   * При отказе (401) — cookie очищается; при ошибке Redis (500) — cookie
   * не сбрасывается (§60).
   *
   * @Public() — endpoint не требует access token в заголовке Authorization;
   * аутентификация выполняется через refresh cookie.
   *
   * @param request - HTTP-запрос Express (cookie читаются `cookie-parser`).
   * @param response - HTTP-ответ Express для установки/очистки cookie.
   * @returns `{ accessToken }` в body.
   */
  @Post("refresh")
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @ApiOperation({
    summary: "Обновление токенов — refresh token rotation (§65)",
  })
  @ApiResponse({
    status: 200,
    description: `Успешное обновление. ${REFRESH_COOKIE_DESCRIPTION}`,
    schema: ACCESS_TOKEN_RESPONSE_SCHEMA,
  })
  @ApiResponse({
    status: 401,
    description:
      "Refresh cookie отсутствует/невалиден/replay. Cookie при этом очищается always (§65).",
    schema: ERROR_RESPONSE_SCHEMA,
  })
  @ApiResponse({
    status: 500,
    description:
      "Redis недоступен. Cookie НЕ сбрасывается, чтобы не потерять сессию (§60).",
    schema: ERROR_RESPONSE_SCHEMA,
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string }> {
    try {
      const result = await this.authService.refresh(
        request.cookies?.[this.getRefreshTokenCookieName()],
      );

      this.setRefreshTokenCookie(response, result.refreshToken);

      return { accessToken: result.accessToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.clearRefreshTokenCookie(response);
      }
      throw error;
    }
  }

  /**
   * Возвращает имя refresh cookie из конфигурации (`§25`).
   *
   * @returns Имя cookie (по умолчанию `refresh_token`).
   */
  private getRefreshTokenCookieName(): string {
    return (
      this.configService.get<string>("cookie.refreshTokenName") ??
      "refresh_token"
    );
  }

  /**
   * Формирует базовые атрибуты refresh cookie (§25–28 SPEC.md):
   * `HttpOnly`, `Secure` из конфига, `SameSite=Lax`, `Path=/api/v1/auth`.
   *
   * @returns Атрибуты cookie без `Max-Age`.
   */
  private getRefreshCookieAttributes() {
    return {
      httpOnly: true as const,
      secure: this.configService.get<boolean>("cookie.secure") ?? false,
      sameSite: "lax" as const,
      path: "/api/v1/auth",
    };
  }

  /**
   * Устанавливает HttpOnly refresh cookie (§25–28 SPEC.md).
   *
   * `Max-Age` вычисляется из `JWT_REFRESH_EXPIRATION` (совпадает с exp
   * refresh JWT и TTL Redis-сессии). Refresh token не возвращается
   * в JSON response (§25 SPEC.md).
   *
   * @param response - HTTP-ответ Express.
   * @param refreshToken - JWT refresh token для записи в cookie.
   */
  private setRefreshTokenCookie(
    response: Response,
    refreshToken: string,
  ): void {
    response.cookie(this.getRefreshTokenCookieName(), refreshToken, {
      ...this.getRefreshCookieAttributes(),
      maxAge: getRefreshTokenTtlSeconds(this.configService) * 1000,
    });
  }

  /**
   * Сбрасывает refresh cookie (§60 SPEC.md).
   *
   * Атрибуты идентичны установке (§25–28), кроме `Max-Age`: express
   * дополняет удаление заголовком с датой истечения в прошлом.
   *
   * @param response - HTTP-ответ Express.
   */
  private clearRefreshTokenCookie(response: Response): void {
    response.clearCookie(
      this.getRefreshTokenCookieName(),
      this.getRefreshCookieAttributes(),
    );
  }
}
