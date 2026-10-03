import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { ShowcaseSlotInputDto } from "@packages/dto";
import {
  formatInstantInTimeZone,
  resolveLocalTimeToUtc,
  slotEndsAt,
  slotsOverlap,
} from "@packages/utils";

import { MATCHMAKING_SLOT_DEFAULTS } from "../matchmaking/matchmaking.constants";

/**
 * Проверка и перевод слотов расписания (ADR-002:65).
 *
 * Слот приходит с провода как локальное время без смещения, зона приходит из
 * `User.timezone`, а в базу попадает UTC-инстант. Вся эта трансформация
 * сосредоточена здесь, потому что её повторяет и матчмейкинг (слот проверяется
 * перед бронированием), а правило должно быть одно: иначе витрина отклонила бы
 * слот, который заявка затем забронировала.
 */

/** Слот после перевода в UTC: то, что действительно записывается в базу. */
export interface ResolvedSlot {
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
}

/** Слот, с которым сверяется новое расписание. */
export interface ExistingSlot {
  startsAt: Date;
  durationMinutes: number;
}

export interface ResolveSlotsOptions {
  /** IANA-зона владельца карточки; локальное время интерпретируется в ней. */
  timeZone: string;
  /** Текущее время: слот в прошлом недопустим (ADR-002:65). */
  now: Date;
  /** `expiresAt` карточки: слот обязан уместиться в её срок (ADR-002:64). */
  cardExpiresAt: Date;
  /**
   * Слоты, с которыми сверяется новое расписание.
   *
   * Сюда попадают только те, что переживут пересборку (см.
   * `SURVIVING_SLOT_STATUS`): снятые владельцем слоты не могут запрещать новое
   * расписание, иначе удаление слота и добавление нового на его месте были бы
   * невозможны в одном запросе.
   */
  existing: ExistingSlot[];
}

/**
 * Приводит слот к UTC-инстантам или отклоняет его.
 *
 * Порядок проверок соответствует тому, что полезнее сообщить клиенту: сначала
 * существование момента в зоне (иначе все остальные проверки считают неверное
 * время), затем границы времени жизни, затем пересечения.
 *
 * `nonexistent` отличается от остальных отказов статусом 422, а не 400: запрос
 * корректен и осмыслен, он ссылается на момент, которого в зоне владельца нет
 * (ADR-002:66). Это отдельное состояние с отдельным сообщением, а не «плохой
 * запрос».
 */
export function resolveSlot(
  slot: ShowcaseSlotInputDto,
  options: ResolveSlotsOptions,
): ResolvedSlot {
  const resolved = resolveLocalTimeToUtc(slot.startsAtLocal, options.timeZone);

  if (!resolved.ok) {
    if (resolved.reason === "nonexistent") {
      throw new UnprocessableEntityException(
        `Время ${slot.startsAtLocal} не существует в вашей таймзоне (${options.timeZone}): перевод часов в этот день вырезает такой интервал. Выберите другое время.`,
      );
    }

    throw new BadRequestException(
      `Некорректное время слота: ожидается формат YYYY-MM-DDTHH:mm, получено «${slot.startsAtLocal}»`,
    );
  }

  const startsAt = resolved.utc;
  const durationMinutes =
    slot.durationMinutes ?? MATCHMAKING_SLOT_DEFAULTS.DURATION_MINUTES;
  const endsAt = slotEndsAt(startsAt, durationMinutes);

  if (startsAt.getTime() <= options.now.getTime()) {
    throw new BadRequestException(
      "Слот должен начинаться в будущем: выбранное время уже прошло",
    );
  }

  if (endsAt.getTime() > options.cardExpiresAt.getTime()) {
    throw new BadRequestException(
      `Слот должен заканчиваться до ${formatInstantInTimeZone(options.cardExpiresAt, options.timeZone)} — это срок действия анкеты`,
    );
  }

  return { startsAt, endsAt, durationMinutes };
}

/**
 * Проверяет весь набор слотов: каждый слот переводится в UTC, после чего
 * проверяются пересечения внутри набора и с теми, что переживут пересборку.
 *
 * Границы длительности проверяет схема запроса (`showcaseSlotInputSchema`).
 * Дублировать их здесь означало бы передавать лимиты вторым аргументом и получить
 * расхождение с контрактом при их изменении.
 */
export function resolveSlots(
  slots: ShowcaseSlotInputDto[],
  options: ResolveSlotsOptions,
): ResolvedSlot[] {
  const resolved = slots.map((slot) => resolveSlot(slot, options));

  for (let i = 0; i < resolved.length; i++) {
    const current = resolved[i];

    for (const taken of options.existing) {
      assertNoOverlap(current, taken);
    }

    for (let j = i + 1; j < resolved.length; j++) {
      assertNoOverlap(current, resolved[j]);
    }
  }

  return resolved;
}

/**
 * Пересечение слотов — конфликт, а не ошибка валидации: обе посылки запроса
 * сами по себе допустимы, несовместимы вместе.
 */
function assertNoOverlap(first: ResolvedSlot, second: ExistingSlot): void {
  const overlaps = slotsOverlap(
    first.startsAt,
    first.durationMinutes,
    second.startsAt,
    second.durationMinutes,
  );

  if (!overlaps) {
    return;
  }

  // У пережившего пересборку слота `endsAt` в проекции нет, поэтому конец
  // считается из длительности — ровно так же, как он был записан в базу.
  const secondEndsAt = slotEndsAt(second.startsAt, second.durationMinutes);

  throw new ConflictException(
    "Слоты пересекаются по времени: " +
      `${formatInstantInTimeZone(first.startsAt, "UTC")}–${formatInstantInTimeZone(first.endsAt, "UTC")} (UTC) ` +
      `и ${formatInstantInTimeZone(second.startsAt, "UTC")}–${formatInstantInTimeZone(secondEndsAt, "UTC")} (UTC)`,
  );
}
