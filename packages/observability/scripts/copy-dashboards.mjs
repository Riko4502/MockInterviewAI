import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceDir = join(root, "dashboards");
const targetDir = join(root, "dist", "dashboards");

mkdirSync(targetDir, { recursive: true });

for (const file of readdirSync(sourceDir)) {
  if (file.endsWith(".json")) {
    cpSync(join(sourceDir, file), join(targetDir, file));
  }
}
