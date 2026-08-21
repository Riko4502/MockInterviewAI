import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  moduleNameMapper: {
    "^@packages/dto$": "<rootDir>/../../../packages/dto/src",
  },
  collectCoverageFrom: [
    "**/*.ts",
    "!**/*.module.ts",
    "!**/main.ts",
    "!src/generated/**",
  ],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
};

export default config;
