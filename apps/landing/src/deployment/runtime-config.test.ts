import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

const staticApps = ["landing", "ui-docs"] as const;

describe.each(staticApps)("%s static runtime configuration", (app) => {
  const appRoot = `${repositoryRoot}apps/${app}`;
  const dockerfile = readFileSync(`${appRoot}/Dockerfile`, "utf8");
  const nginxConfig = readFileSync(`${appRoot}/nginx.conf`, "utf8");
  const runtimeStage = dockerfile.slice(dockerfile.lastIndexOf("\nFROM ") + 1);

  it("runs the final image with unprivileged Nginx", () => {
    expect(runtimeStage).toContain(
      "FROM nginxinc/nginx-unprivileged:alpine AS runtime",
    );
    expect(runtimeStage).not.toContain("FROM nginx:alpine AS runtime");
  });

  it("keeps the exposed and listening ports aligned on 8080", () => {
    expect(runtimeStage).toMatch(/(?:^|\n)EXPOSE 8080(?:\n|$)/);
    expect(runtimeStage).not.toMatch(/(?:^|\n)EXPOSE 80(?:\n|$)/);
    expect(nginxConfig).toMatch(/^\s*listen 8080;\s*$/m);
    expect(nginxConfig).not.toMatch(/^\s*listen 80;\s*$/m);
  });
});
