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
  @ApiOperation({ summary: "Estimate active notification campaign recipients" })
  @ApiResponse({
    status: 200,
    description: "Active, non-deleted recipient count",
    schema: registerSchema(
      "NotificationCampaignRecipientEstimateDto",
      notificationCampaignRecipientEstimateSchema,
    ),
  })
  estimateRecipients() {
    return this.campaigns.estimateRecipients();
  }

  @Get("campaigns")
  @ApiOperation({ summary: "List notification campaigns" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({
    name: "status",
    required: false,
    enum: notificationCampaignStatusSchema.options,
  })
  @ApiQuery({
    name: "targetType",
    required: false,
    enum: notificationTargetTypeSchema.options,
  })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: ["createdAt", "scheduledAt", "sentAt"],
  })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["asc", "desc"] })
  @ApiResponse({
    status: 200,
    description: "Paginated campaigns",
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
  @ApiOperation({ summary: "Get notification campaign details" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({
    status: 200,
    description: "Campaign details, including recipient IDs",
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
  @ApiOperation({ summary: "Create a notification campaign" })
  @ZodBody(createNotificationCampaignSchema)
  @ApiResponse({
    status: 201,
    description: "Campaign created for asynchronous scheduling",
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
  @ApiOperation({ summary: "Update a draft or scheduled campaign" })
  @ApiParam({ name: "id", format: "uuid" })
  @ZodBody(updateNotificationCampaignSchema)
  @ApiResponse({
    status: 200,
    description: "Campaign updated",
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
  @ApiOperation({ summary: "Queue a draft campaign for asynchronous delivery" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({
    status: 200,
    description: "Campaign queued",
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
  @ApiOperation({ summary: "Cancel a scheduled or processing campaign" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({
    required: false,
    schema: registerSchema(
      "NotificationCampaignCancelDto",
      notificationCampaignCancelSchema,
    ),
  })
  @ApiResponse({
    status: 200,
    description: "Campaign cancelled",
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
  @ApiOperation({ summary: "Delete a draft or cancelled campaign" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 204, description: "Campaign deleted" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.campaigns.remove(id);
  }
}
