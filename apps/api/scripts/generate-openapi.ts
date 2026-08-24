import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Test } from "@nestjs/testing";
import { stringify as stringifyYaml } from "yaml";
import { AppModule } from "../src/app.module";
import { buildOpenApiDocument } from "../src/common/openapi/openapi-document";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";
import { RedisService } from "../src/redis/redis.service";

/**
 * Генерация артефактов OpenAPI (§62 SPEC.md).
 *
 * Поднимает приложение через `Test.createTestingModule` с заглушками
 * `PrismaService` и `RedisService` — PostgreSQL и Redis НЕ требуются,
 * HTTP-сервер не запускается. Результат записывается в
 * `packages/api/openapi.yaml` и `openapi.json` (пакет `@packages/api`).
 *
 * Запуск: `pnpm --filter api generate:openapi` (или корневой `pnpm generate:api`).
 */
async function main(): Promise<void> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(RedisService)
    .useValue({})
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const document = buildOpenApiDocument(app);

  // __dirname = <repo>/apps/api/scripts -> <repo>/packages/api
  const outDir = join(__dirname, "..", "..", "..", "packages", "api");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "openapi.json"),
    `${JSON.stringify(document, null, 2)}\n`,
  );
  writeFileSync(join(outDir, "openapi.yaml"), stringifyYaml(document));

  await app.close();

  const paths = Object.keys(document.paths ?? {});
  console.log(`[generate-openapi] paths: ${paths.join(", ")}`);
}

void main();
