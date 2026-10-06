import { describe, expect, it } from "vitest";
import {
  classifyTelegramError,
  DeduplicationCache,
  DLQ_TTL_MS,
  MAX_DELIVERIES,
  normalizeActionUrl,
  type PushEnvelope,
  pushButtonLabel,
  RETRY_DELAYS_MS,
  RETRY_HEADER,
  readRetryCount,
  renderPush,
} from "./push-delivery";

const MATCH_PROPOSED = {
  type: "interview.match_proposed",
  payload: {
    requestId: "22222222-2222-4222-a222-222222222222",
    proposedSlotId: "33333333-3333-4333-a333-333333333333",
    proposedStartUtc: "2026-11-01T10:00:00.000Z",
    senderName: "Анна",
  },
};

const envelope = (patch: Partial<PushEnvelope> = {}): PushEnvelope => ({
  event: MATCH_PROPOSED,
  chatId: "-100500",
  locale: "ru",
  timeZone: "Europe/Moscow",
  ...patch,
});

/** Ошибка grammY нужного вида: собирается тем же конструктором, что и в рантайме. */
function grammyError(
  errorCode: number,
  description: string,
  retryAfter?: number,
): Error {
  // Импорт внутри функции: тесту нужен только класс ошибки, а не весь рантайм
  // grammY вместе с его зависимостями.
  const { GrammyError } = require("grammy") as {
    GrammyError: new (
      message: string,
      apiError: unknown,
      method: string,
      payload: Record<string, unknown>,
    ) => Error;
  };
  return new GrammyError(
    description,
    {
      ok: false,
      error_code: errorCode,
      description,
      parameters: retryAfter === undefined ? {} : { retry_after: retryAfter },
    },
    "sendMessage",
    {},
  );
}

describe("classifyTelegramError", () => {
  it("bot.ban и блокировка пользователем — permanent", () => {
    expect(
      classifyTelegramError(
        grammyError(403, "Forbidden: bot was blocked by the user"),
      ).kind,
    ).toBe("permanent");
    expect(
      classifyTelegramError(
        grammyError(403, "Forbidden: bot was kicked by the user"),
      ).kind,
    ).toBe("permanent");
  });

  it("chat not found — permanent", () => {
    expect(
      classifyTelegramError(grammyError(400, "Bad Request: chat not found"))
        .kind,
    ).toBe("permanent");
  });

  it("user is deactivated — permanent", () => {
    expect(
      classifyTelegramError(grammyError(403, "Forbidden: user is deactivated"))
        .kind,
    ).toBe("permanent");
  });

  it("отозванный токен — permanent", () => {
    expect(classifyTelegramError(grammyError(401, "Unauthorized")).kind).toBe(
      "permanent",
    );
  });

  it("rate limit — retryable с задержкой от Telegram", () => {
    const failure = classifyTelegramError(
      grammyError(429, "Too Many Requests: retry after 7", 7),
    );
    expect(failure.kind).toBe("retryable");
    expect(failure.retryAfterMs).toBe(7000);
  });

  it("сетевой сбой и 5xx — retryable", () => {
    expect(classifyTelegramError(new TypeError("fetch failed")).kind).toBe(
      "retryable",
    );
    expect(classifyTelegramError(grammyError(502, "Bad Gateway")).kind).toBe(
      "retryable",
    );
  });

  it("неизвестная ошибка считается временной, а не поводом для DLQ", () => {
    expect(classifyTelegramError({ weird: true }).kind).toBe("retryable");
  });
});

describe("readRetryCount", () => {
  it("отсутствующий заголовок — первая доставка", () => {
    expect(readRetryCount({})).toBe(0);
  });

  it("читает накопленный счётчик повторов", () => {
    expect(readRetryCount({ [RETRY_HEADER]: 3 })).toBe(3);
  });

  it("мусорный заголовок не ломает обработку", () => {
    expect(readRetryCount({ [RETRY_HEADER]: "oops" })).toBe(0);
    expect(readRetryCount({ [RETRY_HEADER]: -1 })).toBe(0);
  });
});

describe("политика повторов", () => {
  it("задержки совпадают с ADR: 1/2/4/8/16 секунд", () => {
    expect(RETRY_DELAYS_MS).toEqual([1000, 2000, 4000, 8000, 16000]);
  });

  it("после пяти повторов доставка прекращается", () => {
    expect(MAX_DELIVERIES).toBe(6);
  });

  it("DLQ хранит сообщения 7 дней", () => {
    expect(DLQ_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("DeduplicationCache", () => {
  it("доставленный messageId повторно не обрабатывается", () => {
    const cache = new DeduplicationCache();
    expect(cache.begin("m1")).toBe(true);
    cache.complete("m1");
    expect(cache.begin("m1")).toBe(false);
  });

  it("незавершённая отправка не считается доставкой", () => {
    const cache = new DeduplicationCache();
    expect(cache.begin("m1")).toBe(true);
    cache.release("m1");
    // Повтор после неудачной отправки приходит с тем же `messageId`: если бы
    // отметка ставилась в `begin`, уведомление исчезло бы без единой попытки.
    expect(cache.begin("m1")).toBe(true);
  });

  it("тот же messageId не берётся в обработку дважды одновременно", () => {
    const cache = new DeduplicationCache();
    expect(cache.begin("m1")).toBe(true);
    expect(cache.begin("m1")).toBe(false);
    cache.complete("m1");
  });

  it("разные messageId не конфликтуют", () => {
    const cache = new DeduplicationCache();
    expect(cache.begin("m1")).toBe(true);
    cache.complete("m1");
    expect(cache.begin("m2")).toBe(true);
  });

  it("запись живёт ограниченное время", () => {
    const cache = new DeduplicationCache(10, 1000);
    expect(cache.begin("m1", 0)).toBe(true);
    cache.complete("m1", 0);
    expect(cache.begin("m1", 500)).toBe(false);
    expect(cache.begin("m1", 1500)).toBe(true);
  });

  it("память ограничена: вытесняются самые старые записи", () => {
    const cache = new DeduplicationCache(2, 60_000);
    for (const id of ["m1", "m2", "m3"]) {
      cache.begin(id, 0);
      cache.complete(id, 0);
    }
    // m1 — самая старая запись, и после трёх доставок её уже нет в окне.
    expect(cache.begin("m1", 0)).toBe(true);
  });

  it("повторная доставка обновляет позицию записи в порядке вытеснения", () => {
    const cache = new DeduplicationCache(2, 60_000);
    cache.begin("m1", 0);
    cache.complete("m1", 0);
    cache.begin("m2", 0);
    cache.complete("m2", 0);

    // m1 только что доставлялся, поэтому вытесняться должна m2. `Map.set` для
    // существующего ключа позицию не меняет, и без перевставки вытеснилась бы
    // свежая m1 вместо действительно старой m2.
    cache.begin("m1", 10);
    cache.complete("m1", 10);
    cache.begin("m3", 10);
    cache.complete("m3", 10);

    expect(cache.begin("m1", 10)).toBe(false);
    expect(cache.begin("m2", 10)).toBe(true);
  });
});

describe("renderPush", () => {
  it("рендерит текст общим с in-app рендером в зоне получателя", () => {
    const rendered = renderPush(envelope(), "https://app.example.com");

    expect(rendered.text).toBe(
      "Предложен слот\n\nАнна предлагает провести интервью 1 нояб. 2026 г., 13:00.",
    );
  });

  it("разные зоны дают разное время", () => {
    const moscow = renderPush(envelope(), "https://app.example.com");
    const ny = renderPush(
      envelope({ timeZone: "America/New_York" }),
      "https://app.example.com",
    );
    expect(moscow.text).not.toBe(ny.text);
  });

  it("неизвестная локаль откатывается на локаль по умолчанию", () => {
    expect(renderPush(envelope({ locale: "de" }), "https://x.dev").text).toBe(
      renderPush(envelope(), "https://x.dev").text,
    );
  });

  it("неизвестный тип события приводит к отказу, а не к молчаливой отправке", () => {
    expect(() =>
      renderPush(
        envelope({ event: { type: "unknown.event", payload: {} } }),
        "https://x.dev",
      ),
    ).toThrow();
  });

  it("лишние поля payload'а отбрасываются тем же словарём, что у API", () => {
    const rendered = renderPush(
      envelope({
        event: {
          type: "interview.slot_booked",
          payload: {
            sessionId: "44444444-4444-4444-a444-444444444444",
            slotId: "33333333-3333-4333-a333-333333333333",
            startUtc: "2026-11-01T10:00:00.000Z",
            otherParticipantName: "Иван",
            email: "leak@example.com",
          },
        },
      }),
      "https://x.dev",
    );

    expect(rendered.text).not.toContain("leak@example.com");
  });
});

describe("normalizeActionUrl", () => {
  it("относительный путь становится абсолютной ссылкой на WEB_APP_URL", () => {
    expect(normalizeActionUrl("/me", "https://app.example.com")).toBe(
      "https://app.example.com/me",
    );
  });

  it("WEB_APP_URL с завершающим слэшем не даёт двойного слэша", () => {
    expect(normalizeActionUrl("/me", "https://app.example.com/")).toBe(
      "https://app.example.com/me",
    );
  });

  it("чужая абсолютная ссылка отбрасывается", () => {
    expect(
      normalizeActionUrl("https://phishing.example", "https://app.example.com"),
    ).toBeUndefined();
  });

  it("отсутствующая ссылка остаётся отсутствующей", () => {
    expect(
      normalizeActionUrl(undefined, "https://app.example.com"),
    ).toBeUndefined();
  });
});

describe("pushButtonLabel", () => {
  it("кнопка переводится на язык получателя", () => {
    expect(pushButtonLabel("ru")).toBe("Открыть");
    expect(pushButtonLabel("en")).toBe("Open");
  });
});
