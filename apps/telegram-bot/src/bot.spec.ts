import type { Bot } from "grammy";
import { describe, expect, it, vi } from "vitest";
import { setupBotCommands } from "./bot";
import type { TgContext } from "./types";

describe("setupBotCommands", () => {
  it("registers default and localized commands via setMyCommands", async () => {
    const setMyCommands = vi.fn().mockResolvedValue(true);
    const mockApi = {
      setMyCommands,
    } as unknown as Bot<TgContext>["api"];

    await setupBotCommands(mockApi);

    expect(setMyCommands).toHaveBeenCalledTimes(2);

    // 1. Дефолтные команды (en)
    expect(setMyCommands).toHaveBeenNthCalledWith(1, [
      { command: "start", description: "Welcome and help" },
      { command: "interviews", description: "Upcoming interviews" },
      { command: "me", description: "My profile" },
      { command: "lang", description: "Choose interface language" },
      { command: "unlink", description: "Unlink account from Telegram" },
    ]);

    // 2. Русскоязычные команды (ru)
    expect(setMyCommands).toHaveBeenNthCalledWith(
      2,
      [
        { command: "start", description: "Приветствие и справка" },
        { command: "interviews", description: "Предстоящие собеседования" },
        { command: "me", description: "Мой профиль" },
        { command: "lang", description: "Выбрать язык интерфейса" },
        { command: "unlink", description: "Отвязать аккаунт от Telegram" },
      ],
      { language_code: "ru" },
    );
  });

  it("handles api errors gracefully without throwing", async () => {
    const setMyCommands = vi
      .fn()
      .mockRejectedValue(new Error("Network timeout"));
    const mockApi = {
      setMyCommands,
    } as unknown as Bot<TgContext>["api"];

    await expect(setupBotCommands(mockApi)).resolves.not.toThrow();
  });
});
