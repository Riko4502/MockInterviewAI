import { existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..", "..", "..");
const packageDir = resolve(__dirname, "..");

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

if (!existsSync(schemaPath)) {
  console.error(`[packages/api] openapi.json not found at ${schemaPath}`);
  process.exit(1);
}

const relSchemaPath = relative(packageDir, schemaPath).replace(/\\/g, "/");
const relOutputPath = "./src/generated.ts";

console.log(`[packages/api] Generating types: ${relSchemaPath} -> ${relOutputPath}`);
execSync(`npx openapi-typescript "${relSchemaPath}" -o "${relOutputPath}"`, {
  stdio: "inherit",
  cwd: packageDir,
});
