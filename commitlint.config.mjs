export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "refactor",
        "perf",
        "docs",
        "test",
        "style",
        "chore",
        "ci",
      ],
    ],
    "scope-empty": [2, "never"],
    "subject-case": [0],
  },
};
