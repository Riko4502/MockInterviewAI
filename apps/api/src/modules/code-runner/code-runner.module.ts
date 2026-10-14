import { Module } from "@nestjs/common";
import { CodeRunnerController } from "./code-runner.controller";
import { CodeRunnerService } from "./code-runner.service";

@Module({
  controllers: [CodeRunnerController],
  providers: [CodeRunnerService],
  exports: [CodeRunnerService],
})
export class CodeRunnerModule {}
