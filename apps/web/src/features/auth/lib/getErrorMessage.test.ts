import { describe, expect, it } from "vitest";

import { getErrorMessage } from "./getErrorMessage";

describe("getErrorMessage", () => {
  it("возвращает сообщение API, если data.message — строка", () => {
    const error = {
      data: {
        message: "Пользователь с таким email уже существует",
      },
    };

    expect(getErrorMessage(error, "Запасное сообщение")).toBe(
      "Пользователь с таким email уже существует",
    );
  });

  it("возвращает сообщения валидации, если data.message — объект", () => {
    const error = {
      data: {
        message: {
          email: "Некорректный email",
          password: "Некорректный пароль",
        },
      },
    };

    expect(getErrorMessage(error, "Запасное сообщение")).toBe(
      "Некорректный email. Некорректный пароль",
    );
  });

  it("возвращает error.message, если сообщение API отсутствует", () => {
    const error = {
      message: "Ошибка сети",
    };

    expect(getErrorMessage(error, "Запасное сообщение")).toBe("Ошибка сети");
  });

  it("возвращает запасное сообщение, если error равен undefined", () => {
    expect(getErrorMessage(undefined, "Запасное сообщение")).toBe(
      "Запасное сообщение",
    );
  });

  it("возвращает запасное сообщение, если в error нет сообщения", () => {
    expect(getErrorMessage({}, "Запасное сообщение")).toBe(
      "Запасное сообщение",
    );
  });
});
