import { HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import type { PrismaService } from "../../prisma/prisma.service";
import { HealthController } from "./health.controller";

type LoggerAccessor = { logger: { error: (...args: unknown[]) => void } };

function createPrisma(queryRaw: jest.Mock): PrismaService {
  return { $queryRaw: queryRaw } as unknown as PrismaService;
}

function createResponse(): Response {
  return {
    status: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("HealthController", () => {
  let controller: HealthController;
  let queryRaw: jest.Mock;
  let response: Response;

  beforeEach(() => {
    queryRaw = jest.fn();
    response = createResponse();
    controller = new HealthController(createPrisma(queryRaw));
    jest
      .spyOn((controller as unknown as LoggerAccessor).logger, "error")
      .mockImplementation(() => undefined);
  });

  describe("БД доступна", () => {
    it("возвращает 200 { status: ok, db: up } без установки статус-кода", async () => {
      queryRaw.mockResolvedValue([{ "?column?": 1 }]);

      const result = await controller.check(response);

      expect(result).toEqual({ status: "ok", db: "up" });
      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(String(queryRaw.mock.calls[0][0][0])).toContain("SELECT 1");
      expect(response.status).not.toHaveBeenCalled();
    });

    it("ответ не содержит внутренних деталей инфраструктуры", async () => {
      queryRaw.mockResolvedValue([{ "?column?": 1 }]);

      const result = await controller.check(response);
      const body = JSON.stringify(result);

      expect(body).not.toContain("postgres");
      expect(body).not.toContain("host");
      expect(body).not.toContain("connection");
    });
  });

  describe("Ошибка БД", () => {
    it("возвращает 503 { status: error, db: down }", async () => {
      queryRaw.mockRejectedValue(
        new Error(
          "Connection refused: postgresql://user:secret@db-host:5432/mock",
        ),
      );

      const result = await controller.check(response);

      expect(result).toEqual({ status: "error", db: "down" });
      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });

    it("тело ответа не раскрывает деталей ошибки", async () => {
      queryRaw.mockRejectedValue(
        new Error(
          "Connection refused: postgresql://user:secret@db-host:5432/mock",
        ),
      );

      const result = await controller.check(response);
      const body = JSON.stringify(result);

      expect(body).toBe('{"status":"error","db":"down"}');
      expect(body).not.toContain("Connection refused");
      expect(body).not.toContain("secret");
      expect(body).not.toContain("db-host");
    });
  });
});
