import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { ShowcaseSlotInputDto } from "@packages/dto";
import { formatInstantInTimeZone } from "@packages/utils";

import { MATCHMAKING_SLOT_DEFAULTS } from "../matchmaking/matchmaking.constants";

import {
  type ExistingSlot,
  resolveSlot,
  resolveSlots,
} from "./availability-slots";

/**
 * Тесты перевода и проверки слотов расписания (ADR-002:65-66).
 *
 * Проверяется именно отображение отказа в статус: сам round-trip несуществующего
 * локального времени живёт в `packages/utils` и покрыт там, но критерий фазы 4 —
 * «слот на несуществующем локальном времени отклоняется с 422», то есть важна
 * разница между 422 и 400, а не сам факт отказа.
 */

/** Зона владельца карточки во всех тестах, кроме явно помеченных случаев. */
const TZ = "Europe/Moscow";
const NOW = new Date("2026-06-01T10:00:00.000Z");

/** Срок анкеты далеко за пределами любых тестовых слотов. */
const CARD_EXPIRES = new Date("2027-01-01T00:00:00.000Z");

function options(
  overrides: Partial<{
    timeZone: string;
    now: Date;
    existing: ExistingSlot[];
  }> = {},
) {
  return {
    timeZone: overrides.timeZone ?? TZ,
    now: overrides.now ?? NOW,
    cardExpiresAt: CARD_EXPIRES,
    existing: overrides.existing ?? [],
  };
}

function slot(
  startsAtLocal: string,
  durationMinutes?: number,
): ShowcaseSlotInputDto {
  return durationMinutes === undefined
    ? { startsAtLocal }
    : { startsAtLocal, durationMinutes };
}

describe("resolveSlot (ADR-002:65-66)", () => {
  describe("перевод в UTC", () => {
    it("переводит локальное время зоны в UTC-инстант, а не наоборот", () => {
      const resolved = resolveSlot(slot("2026-09-15T12:00"), options());

      // Москва в сентябре на UTC+3: локальные 12:00 — это 09:00Z.
      expect(resolved.startsAt.toISOString()).toBe("2026-09-15T09:00:00.000Z");
    });

    it("подставляет длительность по умолчанию, когда клиент её не прислал", () => {
      const resolved = resolveSlot(slot("2026-09-15T12:00"), options());

      expect(resolved.durationMinutes).toBe(
        MATCHMAKING_SLOT_DEFAULTS.DURATION_MINUTES,
      );
    });

    it("уважает длительность клиента и считает конец интервала", () => {
      const resolved = resolveSlot(slot("2026-09-15T12:00", 90), options());

      expect(resolved.durationMinutes).toBe(90);
      expect(resolved.endsAt.toISOString()).toBe("2026-09-15T10:30:00.000Z");
    });

    it("определяет результат зоной, а не разбираемой строкой", () => {
      const moscow = resolveSlot(
        slot("2026-09-15T12:00"),
        options({ timeZone: TZ }),
      );
      const tokyo = resolveSlot(
        slot("2026-09-15T12:00"),
        options({ timeZone: "Asia/Tokyo" }),
      );

      // Одна и та же строка в разных зонах — разные моменты, иначе перевод
      // опирался бы на смещение из запроса, а его там быть не должно.
      expect(moscow.startsAt.toISOString()).toBe("2026-09-15T09:00:00.000Z");
      expect(tokyo.startsAt.toISOString()).toBe("2026-09-15T03:00:00.000Z");
    });
  });

  describe("несуществующее локальное время", () => {
    // 2011-03-27 в Europe/Moscow: перевод часов вырезает интервал 02:00–03:00,
    // поэтому локальные 02:30 в этот день не существуют.
    it("отклоняет с 422, а не 400: запрос осмыслен, момента в зоне нет", () => {
      expect(() => resolveSlot(slot("2011-03-27T02:30"), options())).toThrow(
        UnprocessableEntityException,
      );
    });

    it("объясняет в сообщении, что момент вырезан переводом часов", () => {
      expect(() => resolveSlot(slot("2011-03-27T02:30"), options())).toThrow(
        /не существует в вашей таймзоне/,
      );
    });

    it("называет зону, в которой момента нет", () => {
      expect(() => resolveSlot(slot("2011-03-27T02:30"), options())).toThrow(
        new RegExp(TZ),
      );
    });

    it("принимает время сразу после разрыва", () => {
      // `now` вынесен на год раньше, иначе до перевода не доходит проверка
      // «слот в будущем» — здесь интересует только разрешение момента.
      const resolved = resolveSlot(
        slot("2011-03-27T03:30"),
        options({ now: new Date("2011-03-01T00:00:00.000Z") }),
      );

      // Москва после перехода на UTC+4: локальные 03:30 — это 23:30Z
      // предыдущих суток, то есть момент снова существовал.
      expect(resolved.startsAt.toISOString()).toBe("2011-03-26T23:30:00.000Z");
    });

    it("отличает несуществующее время от некорректной строки", () => {
      // Оба отказа не проходят дальше, но клиенту нужны разные статусы и текст.
      expect(() => resolveSlot(slot("не дата"), options())).toThrow(
        BadRequestException,
      );
    });

    it("переводит разрыв другой зоны в ту же 422, а не в 400", () => {
      // Нью-Йорк переводит часы в марте: 02:30 не существует 8 марта 2026.
      expect(() =>
        resolveSlot(
          slot("2026-03-08T02:30"),
          options({ timeZone: "America/New_York" }),
        ),
      ).toThrow(UnprocessableEntityException);
    });
  });

  describe("остальные отказы — 400", () => {
    it("отклоняет слот, начавшийся в прошлом", () => {
      expect(() => resolveSlot(slot("2026-05-01T12:00"), options())).toThrow(
        /уже прошло/,
      );
    });

    it("отклоняет слот, начавшийся ровно в now: «сейчас» не в будущем", () => {
      const nowInstant = formatInstantInTimeZone(NOW, TZ);

      expect(() => resolveSlot(slot(nowInstant), options())).toThrow(
        BadRequestException,
      );
    });

    it("отклоняет слот, выходящий за срок действия анкеты", () => {
      // Слот 10:00–12:00 по Москве заканчивается в 09:00Z, то есть уже после
      // 2027-01-01T00:00Z, которым заканчивается срок анкеты.
      expect(() =>
        resolveSlot(slot("2027-01-01T10:00", 120), options()),
      ).toThrow(/срок действия анкеты/);
    });

    it("показывает срок анкеты в зоне владельца, а не в UTC", () => {
      // 2027-01-01T00:00Z в Москве — 03:00 первого января.
      expect(() =>
        resolveSlot(slot("2027-01-01T10:00", 120), options()),
      ).toThrow(/2027-01-01 03:00/);
    });
  });
});

describe("resolveSlots (ADR-002:64)", () => {
  it("переводит весь набор слотов", () => {
    const resolved = resolveSlots(
      [slot("2026-09-15T12:00"), slot("2026-09-15T14:00")],
      options(),
    );

    expect(resolved).toHaveLength(2);
    expect(resolved[0].startsAt.toISOString()).toBe("2026-09-15T09:00:00.000Z");
    expect(resolved[1].startsAt.toISOString()).toBe("2026-09-15T11:00:00.000Z");
  });

  it("отклоняет пересечение внутри одного запроса с 409, а не 400", () => {
    // Обе посылки допустимы по отдельности и несовместимы вместе — это
    // конфликт, а не ошибка валидации одного поля.
    expect(() =>
      resolveSlots(
        [slot("2026-09-15T12:00", 60), slot("2026-09-15T12:30", 60)],
        options(),
      ),
    ).toThrow(ConflictException);
  });

  it("отклоняет пересечение со слотом, пережившим пересборку", () => {
    expect(() =>
      resolveSlots([slot("2026-09-15T12:00", 60)], {
        ...options(),
        existing: [
          {
            startsAt: new Date("2026-09-15T09:30:00.000Z"),
            durationMinutes: 60,
          },
        ],
      }),
    ).toThrow(ConflictException);
  });

  it("не считает пересечением интервалы, соприкасающиеся концами", () => {
    // Интервалы полуоткрытые: [09:00, 10:00) и [10:00, 11:00) не пересекаются,
    // слот в 10:00 начинается ровно тогда, когда предыдущий закончился.
    const resolved = resolveSlots([slot("2026-09-15T13:00", 60)], {
      ...options(),
      existing: [
        {
          startsAt: new Date("2026-09-15T09:00:00.000Z"),
          durationMinutes: 60,
        },
      ],
    });

    expect(resolved).toHaveLength(1);
  });

  it("не запрещает новое расписание из-за отсутствия снятых слотов", () => {
    // Снятые владельцем слоты не попадают в `existing` — иначе удаление слота
    // и добавление нового в одном запросе были бы невозможны.
    const resolved = resolveSlots([slot("2026-09-15T12:00", 60)], {
      ...options(),
      existing: [],
    });

    expect(resolved).toHaveLength(1);
  });

  it("останавливается на первом несуществующем времени с 422", () => {
    expect(() =>
      resolveSlots(
        [slot("2026-09-15T12:00"), slot("2011-03-27T02:30")],
        options(),
      ),
    ).toThrow(UnprocessableEntityException);
  });
});
