import { BadRequestException, PayloadTooLargeException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import sharp from "sharp";
import { StorageService } from "./storage.service";

// Mock AWS SDK S3Client
jest.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({}),
    })),
    PutObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
  };
});

describe("StorageService", () => {
  let service: StorageService;
  let configServiceMock: jest.Mocked<Partial<ConfigService>>;

  beforeEach(() => {
    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === "storage.endpoint") return "http://localhost:9000";
        if (key === "storage.region") return "us-east-1";
        if (key === "storage.bucketName") return "mock-interview-storage";
        if (key === "storage.publicUrl")
          return "http://localhost:9000/mock-interview-storage";
        if (key === "storage.maxAvatarSizeBytes") return 2_097_152;
        return null;
      }),
    };

    service = new StorageService(configServiceMock as ConfigService);
  });

  describe("uploadAvatar", () => {
    it("успешно валидирует и загружает валидный PNG файл в WebP формате", async () => {
      // Создаем валидный 100x100 PNG буфер через sharp
      const pngBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const mockFile = {
        buffer: pngBuffer,
        size: pngBuffer.length,
        mimetype: "image/png",
        originalname: "avatar.png",
      } as Express.Multer.File;

      const url = await service.uploadAvatar("user-123", mockFile);

      expect(url).toContain(
        "http://localhost:9000/mock-interview-storage/avatars/user-123/",
      );
      expect(url.endsWith(".webp")).toBe(true);
    });

    it("отклоняет GIF файлы (GIF запрещен)", async () => {
      // GIF Magic bytes: 47 49 46 38
      const gifBuffer = Buffer.from([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
      ]);
      const mockFile = {
        buffer: gifBuffer,
        size: gifBuffer.length,
        mimetype: "image/gif",
        originalname: "avatar.gif",
      } as Express.Multer.File;

      await expect(service.uploadAvatar("user-123", mockFile)).rejects.toThrow(
        new BadRequestException(
          "GIF format is not supported. Please upload JPEG, PNG, or WebP.",
        ),
      );
    });

    it("отклоняет файлы с неподдерживаемыми magic bytes (текст, exe)", async () => {
      const textBuffer = Buffer.from("console.log('malicious script');");
      const mockFile = {
        buffer: textBuffer,
        size: textBuffer.length,
        mimetype: "image/png",
        originalname: "script.png",
      } as Express.Multer.File;

      await expect(service.uploadAvatar("user-123", mockFile)).rejects.toThrow(
        new BadRequestException(
          "Unsupported file format. Only JPEG, PNG, and WebP images are allowed.",
        ),
      );
    });

    it("отклоняет файлы, превышающие лимит размера 2 MB", async () => {
      const largeBuffer = Buffer.alloc(2_097_153); // 2 MB + 1 byte
      const mockFile = {
        buffer: largeBuffer,
        size: largeBuffer.length,
        mimetype: "image/png",
        originalname: "large.png",
      } as Express.Multer.File;

      await expect(service.uploadAvatar("user-123", mockFile)).rejects.toThrow(
        PayloadTooLargeException,
      );
    });
  });

  describe("deleteFile", () => {
    it("безопасно удаляет файл по URL", async () => {
      await expect(
        service.deleteFile(
          "http://localhost:9000/mock-interview-storage/avatars/user-123/sample.webp",
        ),
      ).resolves.not.toThrow();
    });

    it("не падает если передан null/undefined", async () => {
      await expect(service.deleteFile(null)).resolves.not.toThrow();
    });
  });

  describe("uploadAvatarFromUrl", () => {
    it("блокирует SSRF обращения к приватным IP и localhost", async () => {
      const urlLocalhost = await service.uploadAvatarFromUrl(
        "user-123",
        "http://localhost:8080/image.jpg",
      );
      expect(urlLocalhost).toBeNull();

      const urlPrivateIp = await service.uploadAvatarFromUrl(
        "user-123",
        "http://192.168.1.1/image.jpg",
      );
      expect(urlPrivateIp).toBeNull();

      const urlMetadata = await service.uploadAvatarFromUrl(
        "user-123",
        "http://169.254.169.254/latest/meta-data/",
      );
      expect(urlMetadata).toBeNull();
    });

    it("отклоняет HTTP редиректы (redirect: manual) во избежание SSRF обхода", async () => {
      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 302,
        headers: { get: () => null },
      });
      global.fetch = fetchMock;

      try {
        const expectedUrl = "https://example.com/redirect-to-internal.jpg";
        const result = await service.uploadAvatarFromUrl(
          "user-123",
          expectedUrl,
        );
        expect(result).toBeNull();
        expect(fetchMock).toHaveBeenCalledWith(
          expectedUrl,
          expect.objectContaining({
            redirect: "manual",
          }),
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("отклоняет протоколы отличные от http/https", async () => {
      const urlFtp = await service.uploadAvatarFromUrl(
        "user-123",
        "file:///etc/passwd",
      );
      expect(urlFtp).toBeNull();
    });

    it("возвращает null при ошибке сети fetch", async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      try {
        const result = await service.uploadAvatarFromUrl(
          "user-123",
          "https://example.com/avatar.jpg",
        );
        expect(result).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("успешно скачивает и загружает валидный аватар по внешней ссылке", async () => {
      const pngBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 0, g: 255, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new Uint8Array(pngBuffer),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        cancel: jest.fn().mockResolvedValue(undefined),
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (header: string) => {
            if (header === "content-length") return String(pngBuffer.length);
            if (header === "content-type") return "image/png";
            return null;
          },
        },
        body: {
          getReader: () => mockReader,
        },
      });

      try {
        const url = await service.uploadAvatarFromUrl(
          "user-123",
          "https://cdn.telegram.org/avatar.png",
        );
        expect(url).toContain(
          "http://localhost:9000/mock-interview-storage/avatars/user-123/",
        );
        expect(url?.endsWith(".webp")).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("прекращает чтение и отменяет reader при превышении лимита размера в процессе потоковой передачи", async () => {
      const cancelMock = jest.fn().mockResolvedValue(undefined);
      const chunk1 = new Uint8Array(1_500_000);
      const chunk2 = new Uint8Array(1_000_000); // 1.5MB + 1MB = 2.5MB > 2MB limit

      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: chunk1 })
          .mockResolvedValueOnce({ done: false, value: chunk2 }),
        cancel: cancelMock,
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => null,
        },
        body: {
          getReader: () => mockReader,
        },
      });

      try {
        const result = await service.uploadAvatarFromUrl(
          "user-123",
          "https://cdn.telegram.org/large-avatar.png",
        );

        expect(result).toBeNull();
        expect(cancelMock).toHaveBeenCalledTimes(1);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("возвращает null если response.body отсутствует", async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        body: null,
      });

      try {
        const result = await service.uploadAvatarFromUrl(
          "user-123",
          "https://cdn.telegram.org/nobody.png",
        );

        expect(result).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
