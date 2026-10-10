// transport для локальной разработки

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import type { IMailTransport, SendMailOptions } from "../interfaces";

/**
 * Локальный транспорт для разработки и тестирования.
 *
 * Не требует запущенного SMTP-сервера:
 * 1. Выводит сводку об отправке в консоль NestJS (адрес, тема, текст).
 * 2. Сохраняет сгенерированный HTML в папку `apps/api/.mail-preview`,
 *    чтобы разработчик мог открыть файл в браузере и визуально оценить вёрстку.
 */
@Injectable()
export class DevLoggerTransport implements IMailTransport {
  private readonly logger = new Logger(DevLoggerTransport.name);
  private readonly previewDir = path.resolve(process.cwd(), ".mail-preview");

  /**
   * Эмулирует отправку письма: пишет в лог и сохраняет HTML-превью на диск.
   */
  async send(options: SendMailOptions): Promise<void> {
    const previewText = options.text.trim().slice(0, 120);

    this.logger.log(
      `\n========== [DEV EMAIL PREVIEW] ==========\n` +
        `To:      ${options.to}\n` +
        `Subject: ${options.subject}\n` +
        `Text:    ${previewText}...\n` +
        `=========================================`,
    );

    await this.saveHtmlPreview(options);
  }

  /**
   * Сохраняет HTML-версию письма в папку `.mail-preview`.
   * Ошибки записи диска не ломают выполнение, а только логируются как warning.
   */
  private async saveHtmlPreview(options: SendMailOptions): Promise<void> {
    try {
      await fs.mkdir(this.previewDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeSubject = options.subject
        .replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, "_")
        .slice(0, 30);
      const fileName = `${timestamp}_${safeSubject}.html`;
      const filePath = path.join(this.previewDir, fileName);

      await fs.writeFile(filePath, options.html, "utf-8");
      this.logger.log(`HTML preview saved: ${filePath}`);

      // Ротация: удаляем старые HTML превью, оставляя не более 20 последних файлов
      const files = await fs.readdir(this.previewDir);
      const htmlFiles = files.filter((f) => f.endsWith(".html")).sort();
      if (htmlFiles.length > 20) {
        const toDelete = htmlFiles.slice(0, htmlFiles.length - 20);
        await Promise.all(
          toDelete.map((f) =>
            fs.unlink(path.join(this.previewDir, f)).catch(() => {}),
          ),
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to save HTML preview to disk: ${(error as Error).message}`,
      );
    }
  }
}
