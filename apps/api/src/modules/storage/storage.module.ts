import { Module } from "@nestjs/common";
import { StorageService } from "./storage.service";

/**
 * Модуль объектного хранилища S3/MinIO.
 */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
