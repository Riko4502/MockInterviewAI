import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts", "tsx"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)sx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@packages/dto$": "<rootDir>/../../../packages/dto/src",
    "^@packages/types$": "<rootDir>/../../../packages/types/src",
    "^@packages/utils$": "<rootDir>/../../../packages/utils/src",
    "^@packages/email$": "<rootDir>/../../../packages/email/src",
    "^@packages/i18n$": "<rootDir>/../../../packages/i18n/src",
  },
  collectCoverageFrom: [
    "**/*.ts",
    "!**/*.module.ts",
    "!**/main.ts",
    "!src/generated/**",
  ],
  coverageDirectory: "../coverage",
  coverageReporters: ["text", "text-summary", "json-summary"],
  testEnvironment: "node",
  setupFiles: ["<rootDir>/../test/setup-env.ts"],
  testTimeout: 30000,
};

export default config;
