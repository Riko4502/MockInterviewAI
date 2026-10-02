import { defineConfig } from "@rslib/core";

export default defineConfig({
  source: {
    entry: {
      index: "./src/index.ts",
    },
    // Декларации собираются по tsconfig.build.json, а не по tsconfig.json:
    // во втором вместе с src включён scripts/, поэтому rootDir расширился бы на
    // корень пакета и .d.ts легли в dist/src вместо dist/index.d.ts.
    tsconfigPath: "./tsconfig.build.json",
  },
  lib: [
    {
      bundle: true,
      format: "esm",
      dts: true,
      autoExternal: {
        dependencies: false,
      },
    },
    {
      bundle: true,
      format: "cjs",
      autoExternal: {
        dependencies: false,
      },
    },
  ],
  output: {
    externals: ["zod"],
  },
});
