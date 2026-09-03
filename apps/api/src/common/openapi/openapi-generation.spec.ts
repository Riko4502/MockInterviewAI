import type { INestApplication } from "@nestjs/common";
import type {
  OpenAPIObject,
  OperationObject,
  ReferenceObject,
  ResponseObject,
  SchemaObject,
} from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { configureApp } from "../../main";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { buildOpenApiDocument } from "./openapi-document";

const REQUIRED_MOCK_ENV: Record<string, string> = {
  API_DATABASE_URL: "postgresql://mock:mock@localhost:5432/mock_test",
  JWT_ACCESS_SECRET: "mock-test-access-secret-at-least-32-characters-length",
  JWT_REFRESH_SECRET: "mock-test-refresh-secret-at-least-32-characters-length",
  REFRESH_TOKEN_HASH_SECRET: "mock-test-refresh-hash-secret-at-least-32-chars",
};

describe("OpenAPI Generation & Contract Verification (T030)", () => {
  let app: INestApplication;
  let document: OpenAPIObject;
  const envRestorations = new Map<string, string | undefined>();

  beforeAll(async () => {
    for (const [key, value] of Object.entries(REQUIRED_MOCK_ENV)) {
      if (process.env[key] === undefined) {
        envRestorations.set(key, undefined);
        process.env[key] = value;
      } else {
        envRestorations.set(key, process.env[key]);
      }
    }

    const { AppModule } = await import("../../app.module");

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(RedisService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    document = buildOpenApiDocument(app);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    for (const [key, originalValue] of envRestorations.entries()) {
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
  });

  describe("Базовая структура и метаданные документа", () => {
    it("содержит валидную версию OpenAPI и базовую информацию", () => {
      expect(document.openapi).toMatch(/^3\./);
      expect(document.info.title).toBe("Mock Interview AI API");
      expect(document.info.version).toBe("0.1.0");
      expect(document.paths).toBeDefined();
      expect(document.components?.schemas).toBeDefined();
    });
  });

  describe("Маршруты API (Routes)", () => {
    const expectedRoutes = [
      "/api/v1/health",
      "/api/v1/profile/me",
      "/api/v1/profile/avatar",
      "/api/v1/profile/restore",
      "/api/v1/users/{idOrUsername}",
      "/api/v1/auth/register",
      "/api/v1/auth/login",
      "/api/v1/auth/logout",
      "/api/v1/auth/logout-all",
      "/api/v1/auth/change-password",
      "/api/v1/auth/refresh",
      "/api/v1/sessions",
      "/api/v1/sessions/{id}/participants",
      "/api/v1/sessions/{id}/participants/{userId}",
      "/api/v1/sessions/{id}/close",
      "/api/v1/realtime/ticket",
    ];

    it.each(expectedRoutes)("содержит эндпоинт %s", (route) => {
      expect(document.paths[route]).toBeDefined();
    });
  });

  describe("Схемы компонентов (Schemas)", () => {
    const expectedSchemas = [
      "AccessTokenResponseDto",
      "RegisterDto",
      "LoginDto",
      "ChangePasswordDto",
      "UserProfileDto",
      "UpdateProfileDto",
      "PublicUserProfileDto",
      "TicketDto",
      "TicketResponseDto",
      "ErrorResponseDto",
      "ValidationErrorResponseDto",
      "CreateSessionResponseDto",
      "AddParticipantDto",
    ];

    it.each(expectedSchemas)("содержит схему %s", (schemaName) => {
      expect(document.components?.schemas?.[schemaName]).toBeDefined();
    });
  });

  describe("Контракты ответов (Response Contracts)", () => {
    it("POST /api/v1/auth/register: возвращает 201 (AccessTokenResponseDto), 400 (ValidationError), 409 (Error)", () => {
      const op = document.paths["/api/v1/auth/register"]
        ?.post as OperationObject;
      expect(op?.responses).toBeDefined();
      const r201 = op.responses["201"] as ResponseObject;
      const s201 = r201?.content?.["application/json"]
        ?.schema as ReferenceObject;
      expect(s201?.$ref).toBe("#/components/schemas/AccessTokenResponseDto");

      const r400 = op.responses["400"] as ResponseObject;
      const s400 = r400?.content?.["application/json"]
        ?.schema as ReferenceObject;
      expect(s400?.$ref).toBe(
        "#/components/schemas/ValidationErrorResponseDto",
      );

      const r409 = op.responses["409"] as ResponseObject;
      const s409 = r409?.content?.["application/json"]
        ?.schema as ReferenceObject;
      expect(s409?.$ref).toBe("#/components/schemas/ErrorResponseDto");
    });

    it("POST /api/v1/auth/login: возвращает 200 (AccessTokenResponseDto), 400 (ValidationError), 401 (Error)", () => {
      const op = document.paths["/api/v1/auth/login"]?.post as OperationObject;
      expect(op?.responses).toBeDefined();
      const r200 = op.responses["200"] as ResponseObject;
      const s200 = r200?.content?.["application/json"]
        ?.schema as ReferenceObject;
      expect(s200?.$ref).toBe("#/components/schemas/AccessTokenResponseDto");

      const r400 = op.responses["400"] as ResponseObject;
      const s400 = r400?.content?.["application/json"]
        ?.schema as ReferenceObject;
      expect(s400?.$ref).toBe(
        "#/components/schemas/ValidationErrorResponseDto",
      );

      const r401 = op.responses["401"] as ResponseObject;
      const s401 = r401?.content?.["application/json"]
        ?.schema as ReferenceObject;
      expect(s401?.$ref).toBe("#/components/schemas/ErrorResponseDto");
    });

    it("POST /api/v1/auth/refresh: возвращает 200 (AccessTokenResponseDto)", () => {
      const op = document.paths["/api/v1/auth/refresh"]
        ?.post as OperationObject;
      expect(op?.responses).toBeDefined();
      const r200 = op.responses["200"] as ResponseObject;
      const s200 = r200?.content?.["application/json"]
        ?.schema as ReferenceObject;
      expect(s200?.$ref).toBe("#/components/schemas/AccessTokenResponseDto");
    });

    it("POST /api/v1/realtime/ticket: возвращает 201 (TicketResponseDto), 400, 401, 429", () => {
      const op = document.paths["/api/v1/realtime/ticket"]
        ?.post as OperationObject;
      expect(op?.responses).toBeDefined();
      const r201 = op.responses["201"] as ResponseObject;
      const s201 = r201?.content?.["application/json"]
        ?.schema as ReferenceObject;
      expect(s201?.$ref).toBe("#/components/schemas/TicketResponseDto");
      expect(op.responses["400"]).toBeDefined();
      expect(op.responses["401"]).toBeDefined();
      expect(op.responses["429"]).toBeDefined();
    });
  });

  describe("Отсутствие устаревших обёрток { status, data, headers }", () => {
    it("схемы компонентов не содержат свойства { status, data, headers }", () => {
      const schemas = document.components?.schemas ?? {};
      for (const [, schema] of Object.entries(schemas)) {
        const schemaObj = schema as SchemaObject;
        const properties = schemaObj.properties ?? {};
        const propertyNames = Object.keys(properties);

        // Проверяем, что ни одна схема не является обёрткой Orval { status, data, headers }
        const isWrapper =
          propertyNames.includes("status") &&
          propertyNames.includes("data") &&
          propertyNames.includes("headers");

        expect(isWrapper).toBe(false);
      }
    });
  });
});
