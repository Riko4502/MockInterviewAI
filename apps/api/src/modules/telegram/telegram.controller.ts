import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiExcludeController,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  type LinkRequest,
  type LinkTokenResponse,
  linkRequestSchema,
  type TelegramInterviewsListDto,
  type TelegramInterviewsQuery,
  type TelegramPreferencesPatch,
  type TelegramProfileQuery,
  type TelegramUserProfileDto,
  telegramInterviewsQuerySchema,
  telegramPreferencesPatchSchema,
  telegramProfileQuerySchema,
  type UnlinkRequest,
  type UnlinkResponse,
  unlinkRequestSchema,
} from "@packages/dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthThrottlerGuard } from "../auth/guards/auth-throttler.guard";
import { InternalServiceKeyGuard } from "./guards/internal-service-key.guard";
import { TelegramService } from "./telegram.service";

/**
 * Внутренние эндпоинты интеграции с Telegram-ботом (§7
 * docs/TELEGRAM_BOT_ARCHITECTURE.md).
 *
 * Все эндпоинты, кроме `link-token`, аутентифицируются сервисным ключом
 * (`X-Internal-Service-Key`) и помечены `@Public()`: глобальный
 * `AccessTokenGuard` иначе отклонит вызовы бота (бот шлёт только сервисный
 * ключ, без Bearer-токена). `@ApiExcludeController()` скрывает их из
 * публичной OpenAPI (SPEC §13).
 *
 * - `POST /telegram/link-token` — Bearer (глобальный `AccessTokenGuard`) +
 *   per-route `AuthThrottlerGuard` (глобального throttling нет).
 * - Остальные — `@Public()` + `InternalServiceKeyGuard`.
 */
@ApiTags("telegram-internal")
@ApiExcludeController()
@Controller("telegram")
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  /**
   * Генерирует одноразовую ссылку привязки Telegram (`t.me/{bot}?start=T`).
   *
   * Вызывается из `apps/web` авторизованным пользователем (`request.user.sub`).
   */
  @Post("link-token")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @ApiOperation({ summary: "Генерация одноразового токена привязки Telegram" })
  @ApiResponse({
    status: 200,
    description: "Ссылка на привязку Telegram",
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 429, description: "Слишком много запросов" })
  async createLinkToken(
    @CurrentUser("sub") userId: string,
  ): Promise<LinkTokenResponse> {
    return this.telegramService.createLinkToken(userId);
  }

  /**
   * Привязывает `telegramChatId` к пользователю по токену из `/start <token>`.
   *
   * Вызывается ботом с сервисным ключом.
   */
  @Post("link")
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalServiceKeyGuard)
  @ApiOperation({ summary: "Привязка Telegram-чата по одноразовому токену" })
  @ApiResponse({
    status: 200,
    description: "Профиль пользователя после привязки",
  })
  @ApiResponse({ status: 400, description: "Невалидный body" })
  @ApiResponse({ status: 401, description: "Неверный сервисный ключ" })
  @ApiResponse({
    status: 409,
    description: "Чат уже привязан к аккаунту",
  })
  @ApiResponse({
    status: 410,
    description: "Токен истёк, использован или аккаунт удалён",
  })
  async link(
    @Body(new ZodValidationPipe(linkRequestSchema)) body: LinkRequest,
  ): Promise<TelegramUserProfileDto> {
    return this.telegramService.link(body.token, body.chatId);
  }

  /**
   * Отвязывает Telegram-чат от аккаунта.
   */
  @Post("unlink")
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalServiceKeyGuard)
  @ApiOperation({ summary: "Отвязка Telegram-чата" })
  @ApiResponse({
    status: 200,
    description: "Чат отвязан",
  })
  @ApiResponse({ status: 401, description: "Неверный сервисный ключ" })
  @ApiResponse({ status: 404, description: "Чат не привязан" })
  async unlink(
    @Body(new ZodValidationPipe(unlinkRequestSchema)) body: UnlinkRequest,
  ): Promise<UnlinkResponse> {
    return this.telegramService.unlink(body.chatId);
  }

  /**
   * Возвращает профиль пользователя по `chatId`.
   */
  @Get("profile")
  @Public()
  @UseGuards(InternalServiceKeyGuard)
  @ApiOperation({ summary: "Профиль пользователя по Telegram-chatId" })
  @ApiResponse({
    status: 200,
    description: "Профиль пользователя",
  })
  @ApiResponse({ status: 401, description: "Неверный сервисный ключ" })
  @ApiResponse({ status: 404, description: "Пользователь не найден" })
  async profile(
    @Query(new ZodValidationPipe(telegramProfileQuerySchema))
    query: TelegramProfileQuery,
  ): Promise<TelegramUserProfileDto> {
    return this.telegramService.getProfileByChatId(query.chatId);
  }

  /**
   * Возвращает предстоящие собеседования пользователя по `chatId`.
   */
  @Get("interviews")
  @Public()
  @UseGuards(InternalServiceKeyGuard)
  @ApiOperation({ summary: "Список собеседований по Telegram-chatId" })
  @ApiResponse({
    status: 200,
    description: "Список предстоящих собеседований",
  })
  @ApiResponse({ status: 401, description: "Неверный сервисный ключ" })
  @ApiResponse({ status: 404, description: "Пользователь не найден" })
  async interviews(
    @Query(new ZodValidationPipe(telegramInterviewsQuerySchema))
    query: TelegramInterviewsQuery,
  ): Promise<TelegramInterviewsListDto> {
    return this.telegramService.getInterviewsByChatId(query.chatId);
  }

  /**
   * Обновляет сохранённую локаль пользователя (`telegramLocale`).
   */
  @Patch("preferences")
  @Public()
  @UseGuards(InternalServiceKeyGuard)
  @ApiOperation({ summary: "Обновление локали Telegram-пользователя" })
  @ApiResponse({
    status: 200,
    description: "Обновлённый профиль пользователя",
  })
  @ApiResponse({ status: 400, description: "Невалидный body" })
  @ApiResponse({ status: 401, description: "Неверный сервисный ключ" })
  @ApiResponse({ status: 404, description: "Пользователь не найден" })
  async preferences(
    @Body(new ZodValidationPipe(telegramPreferencesPatchSchema))
    body: TelegramPreferencesPatch,
  ): Promise<TelegramUserProfileDto> {
    return this.telegramService.updatePreferences(body.chatId, body.locale);
  }
}
