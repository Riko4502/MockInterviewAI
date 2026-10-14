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
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  type CreateNotificationCampaignDto,
  createNotificationCampaignSchema,
  type NotificationCampaignCancelDto,
  type NotificationCampaignsQueryDto,
  notificationCampaignCancelSchema,
  notificationCampaignDetailsSchema,
  notificationCampaignRecipientEstimateSchema,
  notificationCampaignSchema,
  notificationCampaignStatusSchema,
  notificationCampaignsPageSchema,
  notificationCampaignsQuerySchema,
  notificationTargetTypeSchema,
  type UpdateNotificationCampaignDto,
  updateNotificationCampaignSchema,
} from "@packages/dto";
import { SystemRole } from "@packages/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { registerSchema, ZodBody } from "../../common/openapi/zod-openapi";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { NotificationCampaignsService } from "./notification-campaigns.service";

@ApiTags("Admin / Notification Campaigns")
@ApiBearerAuth()
@Roles(SystemRole.ADMIN)
@Controller("admin/notifications")
export class NotificationCampaignsController {
  constructor(private readonly campaigns: NotificationCampaignsService) {}

  @Get("preview-recipients")
  @ApiOperation({ summary: "Оценить количество получателей кампании" })
  @ApiResponse({
    status: 200,
    description: "Количество активных пользователей, не удалённых из системы",
    schema: registerSchema(
      "NotificationCampaignRecipientEstimateDto",
      notificationCampaignRecipientEstimateSchema,
    ),
  })
  estimateRecipients() {
    return this.campaigns.estimateRecipients();
  }

  @Get("campaigns")
  @ApiOperation({ summary: "Получить список кампаний уведомлений" })
  @ApiQuery({
    name: "page",
    description: "Номер страницы, начиная с 1",
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: "limit",
    description: "Количество кампаний на странице",
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: "search",
    description: "Поиск кампаний по названию",
    required: false,
    type: String,
  })
  @ApiQuery({
    name: "status",
    description: "Фильтр по статусу кампании",
    required: false,
    enum: notificationCampaignStatusSchema.options,
  })
  @ApiQuery({
    name: "targetType",
    description: "Фильтр по типу аудитории кампании",
    required: false,
    enum: notificationTargetTypeSchema.options,
  })
  @ApiQuery({
    name: "recipientUserId",
    description:
      "UUID \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f, \u0432\u0445\u043e\u0434\u044f\u0449\u0435\u0433\u043e \u0432 \u0430\u0443\u0434\u0438\u0442\u043e\u0440\u0438\u044e \u043a\u0430\u043c\u043f\u0430\u043d\u0438\u0438",
    required: false,
    format: "uuid",
    type: String,
  })
  @ApiQuery({
    name: "sortBy",
    description: "Поле, по которому сортировать кампании",
    required: false,
    enum: ["createdAt", "scheduledAt", "sentAt"],
  })
  @ApiQuery({
    name: "sortOrder",
    description: "Направление сортировки",
    required: false,
    enum: ["asc", "desc"],
  })
  @ApiResponse({
    status: 200,
    description: "Страница кампаний с общим количеством записей",
    schema: registerSchema(
      "NotificationCampaignsPageDto",
      notificationCampaignsPageSchema,
    ),
  })
  findAll(
    @Query(new ZodValidationPipe(notificationCampaignsQuerySchema))
    query: NotificationCampaignsQueryDto,
  ) {
    return this.campaigns.findAll(query);
  }

  @Get("campaigns/:id")
  @ApiOperation({ summary: "Получить подробную информацию о кампании" })
  @ApiParam({ name: "id", description: "UUID кампании", format: "uuid" })
  @ApiResponse({
    status: 200,
    description:
      "Данные кампании, включая идентификаторы выбранных получателей",
    schema: registerSchema(
      "NotificationCampaignDetailsDto",
      notificationCampaignDetailsSchema,
    ),
  })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.campaigns.findOne(id);
  }
  @Post("campaigns")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Создать кампанию уведомлений" })
  @ZodBody(createNotificationCampaignSchema)
  @ApiResponse({
    status: 201,
    description: "Кампания создана и передана на асинхронную обработку",
    schema: registerSchema(
      "NotificationCampaignDto",
      notificationCampaignSchema,
    ),
  })
  create(
    @CurrentUser("sub") adminId: string,
    @Body(new ZodValidationPipe(createNotificationCampaignSchema))
    input: CreateNotificationCampaignDto,
  ) {
    return this.campaigns.create(adminId, input);
  }

  @Patch("campaigns/:id")
  @ApiOperation({ summary: "Обновить черновик или запланированную кампанию" })
  @ApiParam({ name: "id", description: "UUID кампании", format: "uuid" })
  @ZodBody(updateNotificationCampaignSchema)
  @ApiResponse({
    status: 200,
    description: "Данные кампании обновлены",
    schema: registerSchema(
      "NotificationCampaignDto",
      notificationCampaignSchema,
    ),
  })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateNotificationCampaignSchema))
    input: UpdateNotificationCampaignDto,
  ) {
    return this.campaigns.update(id, input);
  }

  @Post("campaigns/:id/queue")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Поставить черновик кампании в очередь на отправку",
  })
  @ApiParam({ name: "id", description: "UUID кампании", format: "uuid" })
  @ApiResponse({
    status: 200,
    description: "Кампания добавлена в очередь на отправку",
    schema: registerSchema(
      "NotificationCampaignDto",
      notificationCampaignSchema,
    ),
  })
  queue(@Param("id", ParseUUIDPipe) id: string) {
    return this.campaigns.queue(id);
  }

  @Post("campaigns/:id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Отменить запланированную или обрабатываемую кампанию",
  })
  @ApiParam({ name: "id", description: "UUID кампании", format: "uuid" })
  @ApiBody({
    description: "Необязательная причина отмены кампании",
    required: false,
    schema: registerSchema(
      "NotificationCampaignCancelDto",
      notificationCampaignCancelSchema,
    ),
  })
  @ApiResponse({
    status: 200,
    description: "Кампания отменена",
    schema: registerSchema(
      "NotificationCampaignDto",
      notificationCampaignSchema,
    ),
  })
  cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("sub") adminId: string,
    @Body(new ZodValidationPipe(notificationCampaignCancelSchema))
    input: NotificationCampaignCancelDto,
  ) {
    return this.campaigns.cancel(id, adminId, input);
  }

  @Delete("campaigns/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Удалить черновик или отменённую кампанию" })
  @ApiParam({ name: "id", description: "UUID кампании", format: "uuid" })
  @ApiResponse({ status: 204, description: "Кампания удалена" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.campaigns.remove(id);
  }
}
