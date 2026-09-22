import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import {
  CreateShowcaseCardDto,
  createShowcaseCardSchema,
  PaginatedResponseDto,
  ShowcaseCardResponseDto,
  ShowcaseQueryDto,
  showcaseQuerySchema,
  UpdateShowcaseCardDto,
  UpdateShowcaseCardStatusDto,
  updateShowcaseCardSchema,
  updateShowcaseCardStatusSchema,
} from "@packages/dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodBody } from "../../common/openapi/zod-openapi";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ShowcaseService } from "./showcase.service";

@ApiTags("Showcase")
@ApiBearerAuth()
@Controller("showcase")
export class ShowcaseController {
  constructor(private readonly showcaseService: ShowcaseService) {}

  /**
   * 1. Каталог витрины с фильтрами, поиском и пагинацией.
   */
  @Get()
  @ApiOperation({ summary: "Получить каталог активных карточек витрины" })
  @ApiResponse({ status: 200, description: "Пагинированный список анкет" })
  @ApiResponse({ status: 400, description: "Некорректные параметры query" })
  async findAll(
    @Query(new ZodValidationPipe(showcaseQuerySchema)) query: ShowcaseQueryDto,
    @CurrentUser("sub") currentUserId: string,
  ): Promise<PaginatedResponseDto<ShowcaseCardResponseDto>> {
    return this.showcaseService.findAll(query, currentUserId);
  }

  /**
   * 2. Список карточек текущего пользователя (со статистикой откликов).
   * Объявлен строго ВЫШЕ :id, чтобы NestJS не перехватывал 'my' как UUID.
   */
  @Get("my")
  @ApiOperation({
    summary: "Получить анкеты текущего пользователя со статистикой заявок",
  })
  @ApiResponse({ status: 200, description: "Список анкет пользователя" })
  async findMy(
    @CurrentUser("sub") userId: string,
  ): Promise<ShowcaseCardResponseDto[]> {
    return this.showcaseService.findMyCards(userId);
  }

  /**
   * 3. Создание новой карточки на витрине.
   */
  @Post()
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: "Создать новую анкету на витрине" })
  @ZodBody(createShowcaseCardSchema, "CreateShowcaseCardDto")
  @ApiResponse({ status: 201, description: "Анкета успешно создана" })
  @ApiResponse({
    status: 400,
    description: "Не заполнен профиль или превышен лимит 5 анкет",
  })
  @ApiResponse({
    status: 409,
    description: "Уже есть активная анкета с такой специализацией и уровнем",
  })
  async create(
    @CurrentUser("sub") userId: string,
    @Body(new ZodValidationPipe(createShowcaseCardSchema))
    dto: CreateShowcaseCardDto,
  ): Promise<ShowcaseCardResponseDto> {
    return this.showcaseService.create(userId, dto);
  }

  /**
   * 4. Просмотр одной карточки по ID.
   */
  @Get(":id")
  @ApiOperation({ summary: "Получить детальную информацию об анкете по ID" })
  @ApiParam({ name: "id", format: "uuid", description: "ID карточки витрины" })
  @ApiResponse({ status: 200, description: "Данные анкеты" })
  @ApiResponse({ status: 404, description: "Анкета не найдена" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<ShowcaseCardResponseDto> {
    return this.showcaseService.findOne(id);
  }

  /**
   * 5. Частичное редактирование карточки (только автор).
   */
  @Patch(":id")
  @ApiOperation({ summary: "Редактировать анкету (только автор)" })
  @ApiParam({ name: "id", format: "uuid", description: "ID карточки витрины" })
  @ZodBody(updateShowcaseCardSchema, "UpdateShowcaseCardDto")
  @ApiResponse({ status: 200, description: "Анкета успешно обновлена" })
  @ApiResponse({
    status: 403,
    description: "Недостаточно прав для редактирования",
  })
  @ApiResponse({ status: 404, description: "Анкета не найдена" })
  @ApiResponse({
    status: 409,
    description: "Конфликт уникальности специализации и уровня",
  })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser("sub") userId: string,
    @Body(new ZodValidationPipe(updateShowcaseCardSchema))
    dto: UpdateShowcaseCardDto,
  ): Promise<ShowcaseCardResponseDto> {
    return this.showcaseService.update(id, userId, dto);
  }

  /**
   * 6. Переключение статуса анкеты ACTIVE <-> INACTIVE (только автор).
   */
  @Patch(":id/status")
  @ApiOperation({ summary: "Переключить статус анкеты ACTIVE <-> INACTIVE" })
  @ApiParam({ name: "id", format: "uuid", description: "ID карточки витрины" })
  @ZodBody(updateShowcaseCardStatusSchema, "UpdateShowcaseCardStatusDto")
  @ApiResponse({ status: 200, description: "Статус успешно изменен" })
  @ApiResponse({
    status: 400,
    description: "Превышен лимит 5 активных карточек или анкета просрочена",
  })
  @ApiResponse({ status: 403, description: "Недостаточно прав" })
  @ApiResponse({ status: 404, description: "Анкета не найдена" })
  async updateStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser("sub") userId: string,
    @Body(new ZodValidationPipe(updateShowcaseCardStatusSchema))
    dto: UpdateShowcaseCardStatusDto,
  ): Promise<ShowcaseCardResponseDto> {
    return this.showcaseService.updateStatus(id, userId, dto);
  }

  /**
   * 7. Поднять анкету в топ (раз в 24 часа).
   */
  @Post(":id/bump")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Поднять анкету в топ каталога (раз в 24 часа)" })
  @ApiParam({ name: "id", format: "uuid", description: "ID карточки витрины" })
  @ApiResponse({ status: 200, description: "Анкета поднята в топ" })
  @ApiResponse({
    status: 400,
    description: "Не прошёл кулдаун 24 часа или анкета не активна",
  })
  @ApiResponse({ status: 403, description: "Недостаточно прав" })
  @ApiResponse({ status: 404, description: "Анкета не найдена" })
  async bump(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser("sub") userId: string,
  ): Promise<ShowcaseCardResponseDto> {
    return this.showcaseService.bump(id, userId);
  }

  /**
   * 8. Перепубликовать истекшую анкету EXPIRED -> ACTIVE (на 15 дней).
   */
  @Post(":id/renew")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Продлить истекшую анкету (EXPIRED -> ACTIVE)" })
  @ApiParam({ name: "id", format: "uuid", description: "ID карточки витрины" })
  @ApiResponse({ status: 200, description: "Анкета продлена на 15 дней" })
  @ApiResponse({
    status: 400,
    description: "Анкета не в статусе EXPIRED или достигнут лимит 5 анкет",
  })
  @ApiResponse({ status: 403, description: "Недостаточно прав" })
  @ApiResponse({ status: 404, description: "Анкета не найдена" })
  async renew(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser("sub") userId: string,
  ): Promise<ShowcaseCardResponseDto> {
    return this.showcaseService.renew(id, userId);
  }

  /**
   * 9. Удалить анкету с витрины (только автор).
   */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Удалить анкету" })
  @ApiParam({ name: "id", format: "uuid", description: "ID карточки витрины" })
  @ApiResponse({ status: 204, description: "Анкета успешно удалена" })
  @ApiResponse({ status: 403, description: "Недостаточно прав" })
  @ApiResponse({ status: 404, description: "Анкета не найдена" })
  async remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser("sub") userId: string,
  ): Promise<void> {
    return this.showcaseService.remove(id, userId);
  }
}
