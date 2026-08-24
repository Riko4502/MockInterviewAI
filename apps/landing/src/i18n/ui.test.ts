import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getLangFromUrl, languages, ui, useTranslations } from "./ui";

function getAllFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("i18n Localization & Translation Integrity", () => {
  it("should define both Russian and English languages", () => {
    expect(languages).toHaveProperty("ru", "Русский");
    expect(languages).toHaveProperty("en", "English");
  });

  it("should have 100% key parity between English and Russian dictionaries", () => {
    const enKeys = Object.keys(ui.en).sort();
    const ruKeys = Object.keys(ui.ru).sort();

    expect(enKeys).toEqual(ruKeys);
  });

  it("should not have empty translation strings", () => {
    for (const [key, value] of Object.entries(ui.en)) {
      expect(
        value.trim().length,
        `Empty English value for key: ${key}`,
      ).toBeGreaterThan(0);
    }
    for (const [key, value] of Object.entries(ui.ru)) {
      expect(
        value.trim().length,
        `Empty Russian value for key: ${key}`,
      ).toBeGreaterThan(0);
    }
  });

  it("should translate keys correctly for active language", () => {
    const tRu = useTranslations("ru");
    const tEn = useTranslations("en");

    expect(tRu("nav.signIn")).toBe("Войти");
    expect(tEn("nav.signIn")).toBe("Sign in");

    expect(tRu("cta.button")).toBe("Начать мок-интервью");
    expect(tEn("cta.button")).toBe("Start Mock Interview");

    expect(tRu("howItWorks.step1Tag")).toContain("ЭТАП 01");
    expect(tEn("howItWorks.step1Tag")).toContain("STEP 01");
  });

  it("should extract correct language from URL", () => {
    const urlEn = new URL("https://devsync.ai/en/dashboard");
    expect(getLangFromUrl(urlEn)).toBe("en");

    const urlRu = new URL("https://devsync.ai/");
    expect(getLangFromUrl(urlRu)).toBe("ru");

    const urlUnknown = new URL("https://devsync.ai/de");
    expect(getLangFromUrl(urlUnknown)).toBe("ru");
  });

  it("should ensure all t(...) keys used across all Astro components exist in ui dictionaries", () => {
    const srcDir = path.resolve(__dirname, "..");
    const files = getAllFiles(srcDir, [".astro", ".ts"]);
    const missingKeys: { file: string; key: string }[] = [];

    for (const file of files) {
      if (file.endsWith("ui.test.ts")) continue;
      const content = fs.readFileSync(file, "utf-8");
      const matches = content.matchAll(/\bt\(\s*['"]([^'"]+)['"]\s*\)/g);
      for (const match of matches) {
        const key = match[1];
        if (!(key in ui.en) || !(key in ui.ru)) {
          missingKeys.push({ file: path.relative(srcDir, file), key });
        }
      }
    }

    expect(missingKeys).toEqual([]);
  });
});
