import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type RegisterDto, registerSchema } from "@packages/dto";
import type { Response } from "express";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";

/** Максимальное время жизни refresh cookie в секундах (§25 SPEC.md). */
const COOKIE_MAX_AGE_SECONDS = 2_592_000;

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
   * @param dto - Валидированный DTO регистрации.
   * @param response - HTTP-ответ Express для установки cookie и статуса.
   * @returns `{ accessToken }` в body.
   */
  @Post("register")
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string }> {
    const result = await this.authService.register(dto);

    const secure = this.configService.get<boolean>("cookie.secure") ?? false;
    const refreshTokenName =
      this.configService.get<string>("cookie.refreshTokenName") ??
      "refresh_token";

    response.cookie(refreshTokenName, result.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/api/v1/auth",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });

    response.status(HttpStatus.CREATED);
    return { accessToken: result.accessToken };
  }
}
