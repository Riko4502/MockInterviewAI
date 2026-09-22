import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import {
  CreateMatchRequestDto,
  createMatchRequestSchema,
  MatchRequestQueryDto,
  MatchRequestResponseDto,
  matchRequestQuerySchema,
  PaginatedResponseDto,
  RejectMatchRequestDto,
  rejectMatchRequestSchema,
  UnreadMatchRequestsCountDto,
} from "@packages/dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodBody } from "../../common/openapi/zod-openapi";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { MatchmakingService } from "./matchmaking.service";

@ApiTags("Matchmaking")
@ApiBearerAuth()
@Controller("matchmaking")
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  /**
   * 1. Количество ожидающих ответа входящих заявок (для бейджа в шапке сайта).
   */
  @Get("requests/unread-count")
  @ApiOperation({
    summary:
      "Получить количество входящих заявок в ожидании ответа (статус PENDING)",
  })
  @ApiResponse({
    status: 200,
    description: "Количество непрочитанных заявок",
  })
  async getUnreadCount(
    @CurrentUser("sub") userId: string,
  ): Promise<UnreadMatchRequestsCountDto> {
    return this.matchmakingService.getUnreadCount(userId);
  }

  /**
   * 2. Создание заявки (отклика) на карточку собеседования с витрины.
   */
  @Post("requests")
  @UseGuards(ThrottlerGuard)
  @ApiOperation({
    summary: "Отправить заявку (отклик) на карточку собеседования",
  })
  @ZodBody(createMatchRequestSchema, "CreateMatchRequestDto")
  @ApiResponse({
    status: 201,
    description: "Заявка успешно отправлена (или согласована при авто-матче)",
  })
  @ApiResponse({
    status: 400,
    description:
      "Не заполнен профиль, попытка отклика на себя, исчерпан лимит входящих на карточке или действует кулдаун",
  })
  @ApiResponse({
    status: 403,
    description: "Указанная карточка отправителя не принадлежит пользователю",
  })
  @ApiResponse({
    status: 404,
    description: "Целевая карточка не найдена или не активна",
  })
  @ApiResponse({
    status: 429,
    description: "Превышен лимит активных исходящих заявок (максимум 5)",
  })
  async create(
    @CurrentUser("sub") senderId: string,
    @Body(new ZodValidationPipe(createMatchRequestSchema))
    dto: CreateMatchRequestDto,
  ): Promise<MatchRequestResponseDto> {
    return this.matchmakingService.create(senderId, dto);
  }

  /**
   * 3. Список входящих заявок с пагинацией и фильтрацией по статусу.
   */
  @Get("requests/incoming")
  @ApiOperation({
    summary: "Получить список входящих заявок текущего пользователя",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"],
    description: "Фильтр по статусу заявки",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Номер страницы (по умолчанию 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Размер страницы (по умолчанию 20, максимум 50)",
  })
  @ApiResponse({
    status: 200,
    description: "Пагинированный список входящих заявок",
  })
  async findIncoming(
    @CurrentUser("sub") userId: string,
    @Query(new ZodValidationPipe(matchRequestQuerySchema))
    query: MatchRequestQueryDto,
  ): Promise<PaginatedResponseDto<MatchRequestResponseDto>> {
    return this.matchmakingService.findIncoming(userId, query);
  }

  /**
   * 4. Список исходящих заявок с пагинацией и фильтрацией по статусу.
   */
  @Get("requests/outgoing")
  @ApiOperation({
    summary: "Получить список исходящих заявок текущего пользователя",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"],
    description: "Фильтр по статусу заявки",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Номер страницы (по умолчанию 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Размер страницы (по умолчанию 20, максимум 50)",
  })
  @ApiResponse({
    status: 200,
    description: "Пагинированный список исходящих заявок",
  })
  async findOutgoing(
    @CurrentUser("sub") userId: string,
    @Query(new ZodValidationPipe(matchRequestQuerySchema))
    query: MatchRequestQueryDto,
  ): Promise<PaginatedResponseDto<MatchRequestResponseDto>> {
    return this.matchmakingService.findOutgoing(userId, query);
  }

  /**
   * 5. Принятие заявки получателем (PENDING -> ACCEPTED).
   */
  @Post("requests/:id/accept")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Принять входящую заявку на собеседование" })
  @ApiParam({ name: "id", format: "uuid", description: "ID заявки" })
  @ApiResponse({
    status: 200,
    description: "Заявка успешно принята, контакты открыты",
  })
  @ApiResponse({
    status: 400,
    description: "Заявка не в статусе ожидания или срок её действия истёк",
  })
  @ApiResponse({
    status: 403,
    description: "Недостаточно прав для принятия чужой заявки",
  })
  @ApiResponse({ status: 404, description: "Заявка не найдена" })
  async accept(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser("sub") userId: string,
  ): Promise<MatchRequestResponseDto> {
    return this.matchmakingService.accept(id, userId);
  }

  /**
   * 6. Отклонение заявки получателем (PENDING -> REJECTED).
   */
  @Post("requests/:id/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Отклонить входящую заявку на собеседование" })
  @ApiParam({ name: "id", format: "uuid", description: "ID заявки" })
  @ZodBody(rejectMatchRequestSchema, "RejectMatchRequestDto")
  @ApiResponse({
    status: 200,
    description: "Заявка успешно отклонена",
  })
  @ApiResponse({
    status: 400,
    description: "Заявка не в статусе ожидания",
  })
  @ApiResponse({
    status: 403,
    description: "Недостаточно прав для отклонения чужой заявки",
  })
  @ApiResponse({ status: 404, description: "Заявка не найдена" })
  async reject(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser("sub") userId: string,
    @Body(new ZodValidationPipe(rejectMatchRequestSchema))
    dto: RejectMatchRequestDto,
  ): Promise<MatchRequestResponseDto> {
    return this.matchmakingService.reject(id, userId, dto);
  }

  /**
   * 7. Отмена исходящей заявки отправителем (PENDING -> CANCELLED).
   */
  @Post("requests/:id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Отменить свою исходящую заявку на собеседование" })
  @ApiParam({ name: "id", format: "uuid", description: "ID заявки" })
  @ApiResponse({
    status: 200,
    description: "Заявка успешно отменена",
  })
  @ApiResponse({
    status: 400,
    description: "Заявка не в статусе ожидания",
  })
  @ApiResponse({
    status: 403,
    description: "Недостаточно прав для отмены чужой заявки",
  })
  @ApiResponse({ status: 404, description: "Заявка не найдена" })
  async cancel(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser("sub") userId: string,
  ): Promise<MatchRequestResponseDto> {
    return this.matchmakingService.cancel(id, userId);
  }
}
