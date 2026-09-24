import { Module } from "@nestjs/common";
import { ShowcaseController } from "./showcase.controller";
import { ShowcaseService } from "./showcase.service";
import { ShowcaseCronService } from "./showcase-cron.service";

@Module({
  controllers: [ShowcaseController],
  providers: [ShowcaseService, ShowcaseCronService],
  exports: [ShowcaseService],
})
export class ShowcaseModule {}
