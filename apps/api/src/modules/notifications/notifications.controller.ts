import {
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  notificationActionResponseSchema,
  notificationsListSchema,
  unreadNotificationsCountSchema,
} from "@packages/dto";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { registerSchema } from "../../common/openapi/zod-openapi";
import { NotificationsService } from "./notifications.service";

@ApiTags("Notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: "Get user notifications",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    default: 1,
    minimum: 1,
    description: "Page number. Minimum value is 1.",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    default: 20,
    minimum: 1,
    maximum: 100,
    description: "Number of notifications per page. Allowed range: 1–100.",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated notifications list",
    schema: registerSchema("NotificationsListDto", notificationsListSchema),
  })
  async getNotifications(
    @CurrentUser("sub") userId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    return this.notificationsService.getNotifications(userId, page, limit);
  }

  @Get("unread-count")
  @ApiOperation({
    summary: "Get unread notifications count",
  })
  @ApiResponse({
    status: 200,
    description: "Unread notifications count",
    schema: registerSchema(
      "UnreadNotificationsCountDto",
      unreadNotificationsCountSchema,
    ),
  })
  async getUnreadCount(@CurrentUser("sub") userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(":id/read")
  @ApiOperation({
    summary: "Mark notification as read",
  })
  @ApiParam({
    name: "id",
    type: String,
    format: "uuid",
  })
  @ApiResponse({
    status: 200,
    description: "Notification marked as read",
    schema: registerSchema(
      "NotificationActionResponseDto",
      notificationActionResponseSchema,
    ),
  })
  @ApiResponse({
    status: 404,
    description: "Notification not found",
  })
  async markAsRead(
    @CurrentUser("sub") userId: string,
    @Param("id") id: string,
  ) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete notification",
  })
  @ApiParam({
    name: "id",
    type: String,
    format: "uuid",
  })
  @ApiResponse({
    status: 200,
    description: "Notification deleted",
    schema: registerSchema(
      "NotificationActionResponseDto",
      notificationActionResponseSchema,
    ),
  })
  @ApiResponse({
    status: 404,
    description: "Notification not found",
  })
  async markAsDeleted(
    @CurrentUser("sub") userId: string,
    @Param("id") id: string,
  ) {
    return this.notificationsService.markAsDeleted(userId, id);
  }
}
