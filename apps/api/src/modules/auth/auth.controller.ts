import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  type LoginDto,
  loginSchema,
  type RegisterDto,
  registerSchema,
} from "@packages/dto";
import type { Response } from "express";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { AuthThrottlerGuard } from "./guards/auth-throttler.guard";
import { getRefreshTokenTtlSeconds } from "./services/refresh-token-ttl";

/**
 * Контроллер аутентификации (§36 SPEC.md).
 *
 * Отвечает только за HTTP layer: приём request, валидация DTO,
 * вызов `AuthService`, установка cookie, форматирование response.
 * Бизнес-логика в Controller не размещается.
 */
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
  @UseGuards(AuthThrottlerGuard)
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
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string }> {
    const result = await this.authService.login(dto);

    this.setRefreshTokenCookie(response, result.refreshToken);

    return { accessToken: result.accessToken };
  }

  /**
   * Устанавливает HttpOnly refresh cookie (§25–28 SPEC.md).
   *
   * Атрибуты: `HttpOnly`, `Secure` из конфига (`COOKIE_SECURE`),
   * `SameSite=Lax`, `Path=/api/v1/auth`, `Max-Age` — вычисляется из
   * `JWT_REFRESH_EXPIRATION` (совпадает с exp refresh JWT и TTL Redis-сессии).
   * Refresh token не возвращается в JSON response (§25 SPEC.md).
   *
   * @param response - HTTP-ответ Express.
   * @param refreshToken - JWT refresh token для записи в cookie.
   */
  private setRefreshTokenCookie(
    response: Response,
    refreshToken: string,
  ): void {
    const secure = this.configService.get<boolean>("cookie.secure") ?? false;
    const refreshTokenName =
      this.configService.get<string>("cookie.refreshTokenName") ??
      "refresh_token";

    response.cookie(refreshTokenName, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/api/v1/auth",
      maxAge: getRefreshTokenTtlSeconds(this.configService),
    });
  }
}
