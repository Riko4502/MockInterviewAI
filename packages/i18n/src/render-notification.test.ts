import { describe, expect, it } from "vitest";

import { renderNotification } from "./render-notification";

const matchProposedPayload = {
  sessionId: "22222222-2222-4222-a222-222222222222",
  proposedSlotId: "33333333-3333-4333-a333-333333333333",
  proposedStartUtc: "2026-10-01T09:00:00.000Z",
  senderName: "Иван",
};

describe("renderNotification", () => {
  it("подставляет имя в шаблон", () => {
    const rendered = renderNotification(
      "interview.match_proposed",
      matchProposedPayload,
      { locale: "ru" },
    );
    expect(rendered.title).toBe("Предложен слот");
    expect(rendered.message).toContain("Иван");
  });

  it("рендерит разный текст для разных локалей", () => {
    const ru = renderNotification(
      "system.welcome",
      { displayName: "Иван" },
      { locale: "ru" },
    );
    const en = renderNotification(
      "system.welcome",
      { displayName: "Иван" },
      { locale: "en" },
    );
    expect(ru.title).toBe("Добро пожаловать");
    expect(en.title).toBe("Welcome");
    expect(ru.message).not.toBe(en.message);
  });

  it("откатывается на локаль по умолчанию для неизвестной локали", () => {
    const rendered = renderNotification(
      "system.welcome",
      { displayName: "Иван" },
      { locale: "xx-YY" },
    );
    const fallback = renderNotification(
      "system.welcome",
      { displayName: "Иван" },
      { locale: "ru" },
    );
    expect(rendered).toEqual(fallback);
  });

  it("не падает и подставляет заглушку для неизвестного типа события", () => {
    const rendered = renderNotification(
      "system.not_yet_known",
      {},
      { locale: "ru" },
    );
    expect(rendered.title).toBe("Уведомление");
    expect(rendered.message).toBe("Произошло обновление");
  });

  it("показывает время в зоне читателя, а не в UTC", () => {
    const utc = renderNotification(
      "interview.match_proposed",
      matchProposedPayload,
      {
        locale: "ru",
        timeZone: "UTC",
      },
    );
    const moscow = renderNotification(
      "interview.match_proposed",
      matchProposedPayload,
      {
        locale: "ru",
        timeZone: "Europe/Moscow",
      },
    );
    expect(moscow.message).not.toBe(utc.message);
    expect(utc.message).toContain("09:00");
    // 09:00 UTC в московском поясе — 12:00.
    expect(moscow.message).toContain("12:00");
  });

  it("переживает незнакомую зону IANA, не роняя доставку", () => {
    const rendered = renderNotification(
      "interview.match_proposed",
      matchProposedPayload,
      {
        locale: "ru",
        timeZone: "Not/AZone",
      },
    );
    expect(rendered.message).toContain("2026-10-01T09:00:00.000Z");
  });

  it("оставляет не-дату в шаблоне как есть", () => {
    // Проверяется на событии, которое действительно интерполирует: шаблон
    // system.welcome не подставляет ничего, и на нём проверка была бы пустой.
    const rendered = renderNotification(
      "interview.match_proposed",
      {
        sessionId: "s",
        proposedSlotId: "sl",
        proposedStartUtc: "2026-10-01T09:00:00.000Z",
        senderName: "2026-10-01",
      },
      { locale: "ru" },
    );
    expect(rendered.message).toContain("2026-10-01");
  });

  it("не подставляет плейсхолдер, которого нет в payload", () => {
    const rendered = renderNotification(
      "interview.slot_booked",
      { sessionId: "s" },
      { locale: "ru" },
    );
    expect(rendered.message).toContain("{{otherParticipantName}}");
  });
});
