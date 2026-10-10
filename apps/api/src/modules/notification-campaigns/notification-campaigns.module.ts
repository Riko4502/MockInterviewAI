import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { NotificationCampaignsController } from "./notification-campaigns.controller";
import { NotificationCampaignsService } from "./notification-campaigns.service";

@Module({
  imports: [NotificationsModule],
  controllers: [NotificationCampaignsController],
  providers: [NotificationCampaignsService],
  exports: [NotificationCampaignsService],
})
export class NotificationCampaignsModule {}
