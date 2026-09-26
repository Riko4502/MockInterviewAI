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
    jest.useFakeTimers({ now: new Date("2026-09-24T10:00:00.500Z") });
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

  afterEach(() => {
    jest.useRealTimers();
  });

  it("успешно валидирует подлинный payload со стандартным auth_date (TTL >= 300)", async () => {
    const payload = createValidPayload();
    await expect(
      service.validateTelegramPayload(payload),
    ).resolves.not.toThrow();
    expect(redisService.setNx).toHaveBeenCalledWith(
      `auth:telegram:replay:${payload.hash}`,
      "1",
      expect.any(Number),
    );
    const ttlArg = (redisService.setNx as jest.Mock).mock.calls[0][2];
    expect(ttlArg).toBeGreaterThanOrEqual(300);
  });

  it("рассчитывает увеличенный TTL для replay protection при auth_date в будущем (+60s skew)", async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const futureAuthDate = nowInSeconds + 60;
    const payload = createValidPayload({ auth_date: futureAuthDate });

    await expect(
      service.validateTelegramPayload(payload),
    ).resolves.not.toThrow();

    expect(redisService.setNx).toHaveBeenCalledWith(
      `auth:telegram:replay:${payload.hash}`,
      "1",
      expect.any(Number),
    );

    const ttlArg = (redisService.setNx as jest.Mock).mock.calls[0][2];
    // Для auth_date = now + 60 оставшаяся валидность = 60 + 300 + 1 = 361 c.
    // Фиксированное старое значение 300 вызвало бы ошибку регрессии.
    expect(ttlArg).toBeGreaterThanOrEqual(361);
  });

  it("отклоняет payload с auth_date из слишком далекого будущего (> 60s)", async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const tooFutureAuthDate = nowInSeconds + 65;
    const payload = createValidPayload({ auth_date: tooFutureAuthDate });

    await expect(service.validateTelegramPayload(payload)).rejects.toThrow(
      "Telegram authentication payload has expired",
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

  it("успешно валидирует rawPayload, содержащий доп. подписанные поля", async () => {
    const authDate = Math.floor(Date.now() / 1000);
    const rawData: Record<string, unknown> = {
      auth_date: authDate,
      first_name: "Test",
      id: 123456789,
      username: "testuser",
      photo_url: "https://t.me/i/userpic/320/test.jpg",
      custom_telegram_field: "extra_val",
    };

    const dataCheckArr = Object.keys(rawData)
      .sort()
      .map((k) => `${k}=${rawData[k]}`);
    const dataCheckString = dataCheckArr.join("\n");

    const secretKey = createHash("sha256").update(botToken).digest();
    const hash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    const parsedDto: TelegramAuthDto = {
      id: 123456789,
      first_name: "Test",
      username: "testuser",
      auth_date: authDate,
      hash,
    };

    const rawPayload = { ...rawData, hash };

    await expect(
      service.validateTelegramPayload(parsedDto, rawPayload),
    ).resolves.not.toThrow();
  });
});
