import {
  BadRequestException,
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
    schema: {
      type: "integer",
      minimum: 1,
      default: 1,
    },
    description: "Page number. Minimum value is 1.",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    schema: {
      type: "integer",
      minimum: 1,
      maximum: 100,
      default: 20,
    },
    description: "Number of notifications per page. Allowed range: 1–100.",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated notifications list",
    schema: registerSchema("NotificationsListDto", notificationsListSchema),
  })
  @ApiResponse({
    status: 400,
    description: "Invalid pagination parameters",
  })
  async getNotifications(
    @CurrentUser("sub") userId: string,
    @Query(
      "page",
      new DefaultValuePipe(1),
      new ParseIntPipe({
        errorHttpStatusCode: 400,
      }),
    )
    page: number,
    @Query(
      "limit",
      new DefaultValuePipe(20),
      new ParseIntPipe({
        errorHttpStatusCode: 400,
      }),
    )
    limit: number,
  ) {
    if (page < 1) {
      throw new BadRequestException("page must be greater than or equal to 1");
    }

    if (limit < 1 || limit > 100) {
      throw new BadRequestException("limit must be between 1 and 100");
    }

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
