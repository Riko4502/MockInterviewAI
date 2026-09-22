import { createHash, createHmac } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { TelegramAuthDto } from "@packages/dto";
import type { RedisService } from "../../../redis/redis.service";
import { TelegramOAuthService } from "./telegram-oauth.service";

describe("TelegramOAuthService", () => {
  let service: TelegramOAuthService;
  let configService: ConfigService;
  let redisService: RedisService;

  const botToken = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz";

  function createValidPayload(
    overrides?: Partial<TelegramAuthDto>,
  ): TelegramAuthDto {
    const authDate = Math.floor(Date.now() / 1000);
    const data: Record<string, unknown> = {
      auth_date: authDate,
      first_name: "Test",
      id: 123456789,
      username: "testuser",
      ...overrides,
    };

    delete data.hash;

    const dataCheckArr = Object.keys(data)
      .sort()
      .map((k) => `${k}=${data[k]}`);
    const dataCheckString = dataCheckArr.join("\n");

    const secretKey = createHash("sha256").update(botToken).digest();
    const hash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    return {
      ...data,
      hash: overrides?.hash ?? hash,
    } as TelegramAuthDto;
  }

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === "telegram.botToken") return botToken;
        return null;
      }),
    } as unknown as ConfigService;

    redisService = {
      setNx: jest.fn().mockResolvedValue(true),
    } as unknown as RedisService;

    service = new TelegramOAuthService(configService, redisService);
  });

  it("успешно валидирует подлинный payload", async () => {
    const payload = createValidPayload();
    await expect(
      service.validateTelegramPayload(payload),
    ).resolves.not.toThrow();
    expect(redisService.setNx).toHaveBeenCalledWith(
      `auth:telegram:replay:${payload.hash}`,
      "1",
      300,
    );
  });

  it("отклоняет payload с некорректной HMAC подписью", async () => {
    const payload = createValidPayload({
      hash: "invalid_hash_1234567890abcdef1234567890abcdef",
    });
    await expect(service.validateTelegramPayload(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("отклоняет payload с истекшим auth_date (> 300s)", async () => {
    const oldAuthDate = Math.floor(Date.now() / 1000) - 400;
    const payload = createValidPayload({ auth_date: oldAuthDate });
    await expect(service.validateTelegramPayload(payload)).rejects.toThrow(
      "Telegram authentication payload has expired",
    );
  });

  it("отклоняет payload при срабатывании replay guard (уже использованный hash)", async () => {
    (redisService.setNx as jest.Mock).mockResolvedValue(false);
    const payload = createValidPayload();
    await expect(service.validateTelegramPayload(payload)).rejects.toThrow(
      "Telegram auth payload has already been used",
    );
  });
});
