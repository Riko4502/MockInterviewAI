import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import "multer";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import sharp from "sharp";
import { resolveAndValidateUrl } from "./ssrf.util";

/** Максимально допустимые габариты изображения (защита от Decompression Bombs) */
const MAX_IMAGE_DIMENSION = 4096;

/**
 * Сервис безопасного хранения файлов в S3/MinIO.
 *
 * Реализует 4-уровневую защиту от вредоносных файлов:
 * 1. Проверка размера буфера (по умолчанию до 2 MB).
 * 2. Проверка сигнатур Magic Bytes (разрешены строго JPEG, PNG, WebP; GIF запрещен).
 * 3. Валидация габаритов и полное перекодирование через Sharp в WebP (уничтожение эксплойтов).
 * 4. Загрузка в S3 со случайным хешем и заголовком Content-Type: image/webp.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;
  private readonly maxAvatarSizeBytes: number;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>("storage.endpoint");
    const region =
      this.configService.get<string>("storage.region") ?? "us-east-1";
    const accessKey =
      this.configService.get<string>("storage.accessKey") ?? "minioadmin";
    const secretKey =
      this.configService.get<string>("storage.secretKey") ?? "minioadmin";
    const forcePathStyle =
      this.configService.get<boolean>("storage.forcePathStyle") ?? true;

    this.bucketName =
      this.configService.get<string>("storage.bucketName") ??
      "mock-interview-storage";
    this.publicUrl = (
      this.configService.get<string>("storage.publicUrl") ??
      "http://localhost:9000/mock-interview-storage"
    ).replace(/\/$/, "");

    this.maxAvatarSizeBytes =
      this.configService.get<number>("storage.maxAvatarSizeBytes") ?? 2_097_152;

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle,
    });
  }

  /**
   * Безопасно валидирует, сжимает и загружает аватар пользователя в S3.
   *
   * @param userId - UUID пользователя.
   * @param file - Загруженный файл (multer).
   * @returns Публичный URL загруженного аватара.
   */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException("No file provided");
    }

    // 1. Проверка размера файла
    if (file.buffer.length > this.maxAvatarSizeBytes) {
      const maxMb = Math.round(this.maxAvatarSizeBytes / (1024 * 1024));
      throw new PayloadTooLargeException(
        `File size exceeds maximum allowed limit of ${maxMb} MB`,
      );
    }

    // 2. Проверка сигнатур Magic Bytes (JPEG, PNG, WebP)
    this.validateMagicBytes(file.buffer);

    // 3. Валидация габаритов и перекодирование через Sharp
    let optimizedBuffer: Buffer;
    try {
      const image = sharp(file.buffer);
      const metadata = await image.metadata();

      if (
        (metadata.width && metadata.width > MAX_IMAGE_DIMENSION) ||
        (metadata.height && metadata.height > MAX_IMAGE_DIMENSION)
      ) {
        throw new BadRequestException(
          `Image dimensions exceed ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}px limit`,
        );
      }

      optimizedBuffer = await image
        .resize(400, 400, {
          fit: "cover",
          position: "center",
        })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logger.warn(`Failed to process image with Sharp: ${String(err)}`);
      throw new BadRequestException("Corrupt or invalid image file");
    }

    // 4. Генерация ключа S3 и загрузка
    const hash = createHash("sha256")
      .update(optimizedBuffer)
      .digest("hex")
      .slice(0, 16);
    const key = `avatars/${userId}/${hash}.webp`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: optimizedBuffer,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );

      this.logger.log(`Avatar successfully uploaded to S3: ${key}`);
      return `${this.publicUrl}/${key}`;
    } catch (err) {
      this.logger.error(`S3 upload error: ${String(err)}`);
      throw new ServiceUnavailableException(
        "Storage service is temporarily unavailable",
      );
    }
  }

  /**
   * Безопасно скачивает аватар по внешней ссылке (например, Telegram photo_url)
   * с защитой от SSRF и загружает в S3.
   *
   * @param userId - UUID пользователя.
   * @param imageUrl - URL внешнего изображения.
   * @returns Публичный URL аватара в S3 или null при ошибке.
   */
  async uploadAvatarFromUrl(
    userId: string,
    imageUrl?: string | null,
  ): Promise<string | null> {
    if (!imageUrl) return null;

    try {
      const validated = await resolveAndValidateUrl(imageUrl);
      if (!validated) {
        this.logger.warn(
          `SSRF protection: Blocked request or invalid URL ${imageUrl}`,
        );
        return null;
      }

      const fetchOptions: RequestInit & { lookup?: unknown } = {
        signal: AbortSignal.timeout(5000),
        redirect: "manual",
      };
      if (validated.lookupFn) {
        fetchOptions.lookup = validated.lookupFn;
      }

      const response = await fetch(validated.fetchUrl, fetchOptions);

      if (!response.ok) {
        this.logger.warn(
          `Failed to fetch avatar from URL ${imageUrl}: status ${response.status}`,
        );
        return null;
      }

      const contentLength = response.headers.get("content-length");
      if (
        contentLength &&
        Number.parseInt(contentLength, 10) > this.maxAvatarSizeBytes
      ) {
        this.logger.warn(
          `Avatar from URL ${imageUrl} exceeds maximum size limit`,
        );
        return null;
      }

      if (!response.body) {
        this.logger.warn(`Response body is missing for URL ${imageUrl}`);
        return null;
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          received += value.length;
          if (received > this.maxAvatarSizeBytes) {
            await reader.cancel();
            this.logger.warn(
              `Avatar buffer from URL ${imageUrl} exceeds maximum size limit`,
            );
            return null;
          }
          chunks.push(value);
        }
      }

      const buffer = Buffer.concat(chunks);

      const file: Express.Multer.File = {
        fieldname: "avatar",
        originalname: "telegram-avatar.jpg",
        encoding: "7bit",
        mimetype: response.headers.get("content-type") || "image/jpeg",
        buffer,
        size: buffer.length,
        stream: null as unknown as Readable,
        destination: "",
        filename: "",
        path: "",
      };

      return await this.uploadAvatar(userId, file);
    } catch (err) {
      this.logger.warn(
        `Failed to upload avatar from URL ${imageUrl}: ${String(err)}`,
      );
      return null;
    }
  }

  /**
   * Удаляет файл из S3 по URL или ключу.
   *
   * @param fileUrlOrKey - Публичный URL или ключ S3.
   */
  async deleteFile(fileUrlOrKey: string | null | undefined): Promise<void> {
    if (!fileUrlOrKey) return;

    let key = fileUrlOrKey;
    if (fileUrlOrKey.startsWith(this.publicUrl)) {
      key = fileUrlOrKey.replace(`${this.publicUrl}/`, "");
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      this.logger.log(`File deleted from S3: ${key}`);
    } catch (err) {
      this.logger.warn(`Failed to delete S3 file ${key}: ${String(err)}`);
    }
  }

  /**
   * Проверяет сигнатуру файла по первым байтам (Magic Bytes).
   * Разрешены только: JPEG, PNG, WebP. GIF и любые другие форматы строго запрещены.
   */
  private validateMagicBytes(buffer: Buffer): void {
    if (buffer.length < 12) {
      throw new BadRequestException("Invalid file format");
    }

    // JPEG: FF D8 FF
    const isJpeg =
      buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

    // PNG: 89 50 4E 47
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;

    // WebP: RIFF (bytes 0-3) ... WEBP (bytes 8-11)
    const isWebP =
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50;

    // GIF (47 49 46 38)
    const isGif =
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38;

    if (isGif) {
      throw new BadRequestException(
        "GIF format is not supported. Please upload JPEG, PNG, or WebP.",
      );
    }

    if (!isJpeg && !isPng && !isWebP) {
      throw new BadRequestException(
        "Unsupported file format. Only JPEG, PNG, and WebP images are allowed.",
      );
    }
  }
}
