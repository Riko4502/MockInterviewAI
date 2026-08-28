import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..", "..", "..");
const packageDir = resolve(__dirname, "..");
const outputPath = resolve(packageDir, "src", "generated.ts");

// Читаем OPENAPI_OUTPUT_DIR из process.env или дефолтный путь
const openApiOutputDir = process.env.OPENAPI_OUTPUT_DIR ?? "./apps/api/openapi";
const resolvedOutputDir = resolve(rootDir, openApiOutputDir);

let schemaPath = resolve(resolvedOutputDir, "openapi.json");
if (!existsSync(schemaPath)) {
  const localSchema = resolve(packageDir, "schema", "openapi.json");
  if (existsSync(localSchema)) {
    schemaPath = localSchema;
  }
}

const relSchemaPath = relative(packageDir, schemaPath).replace(/\\/g, "/");
const relOutputPath = relative(packageDir, outputPath).replace(/\\/g, "/");

if (!existsSync(schemaPath)) {
  if (existsSync(outputPath)) {
    console.warn(
      `[packages/api] openapi.json not found at ${schemaPath}, reusing existing ${relOutputPath}`,
    );
    process.exit(0);
  }
  console.error(`[packages/api] openapi.json not found at ${schemaPath}`);
  process.exit(1);
}

console.log(
  `[packages/api] Generating types: ${relSchemaPath} -> ${relOutputPath}`,
);

const schemaContent = JSON.parse(readFileSync(schemaPath, "utf-8"));
const ast = await openapiTS(schemaContent);
const output = astToString(ast);

writeFileSync(outputPath, output, "utf-8");

console.log(`[packages/api] Successfully generated ${relOutputPath}`);
