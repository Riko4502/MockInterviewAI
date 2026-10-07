import { randomUUID } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import { AvailabilitySlotStatus } from "../../src/generated/prisma/enums";
import { MatchmakingService } from "../../src/modules/matchmaking/matchmaking.service";
import {
  type StartedApp,
  startTestApp,
  stopTestApp,
  uniqueEmail,
} from "../helpers/test-app.helper";

/**
 * Integration (PostgreSQL + Redis): атомарный claim слота (ADR-002:73-74).
 *
 * Проверяется то, ради чего claim и писался: `updateMany` с условием
 * `{ id, status: "OPEN" }` выполняется базой, поэтому из двух параллельных
 * откликов на один слот ровно один выигрывает, а второй получает 409.
 *
 * Мок Prisma здесь не годится: проверка «свободен ли слот» целиком лежит в
 * `UPDATE ... WHERE status = 'OPEN'`, и на подделке она всегда возвращает
 * `count: 1`. Поэтому тест идёт на настоящей базе.
 */
describe("Integration (PostgreSQL + Redis): Atomic Slot Claim", () => {
  let started: StartedApp;
  let matchmaking: MatchmakingService;
  const createdUserIds: string[] = [];
  const createdCardIds: string[] = [];

  beforeAll(async () => {
    started = await startTestApp();
    matchmaking = started.app.get(MatchmakingService);
  });

  afterAll(async () => {
    if (createdCardIds.length > 0) {
      await started.prisma.showcaseCard.deleteMany({
        where: { id: { in: createdCardIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await started.prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    await stopTestApp(started);
  });

  async function createUser(prefix: string): Promise<{ id: string }> {
    const user = await started.prisma.user.create({
      data: {
        email: uniqueEmail(),
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
        username: `${prefix}_${randomUUID().slice(0, 8)}`,
        // Профиль должен быть заполнен, иначе `create` откажет раньше claim.
        displayName: `Имя ${prefix}`,
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  /** Карточка витрины с одним открытым слотом через полгода. */
  async function createCardWithSlot(
    userId: string,
  ): Promise<{ cardId: string; slotId: string }> {
    const card = await started.prisma.showcaseCard.create({
      data: {
        userId,
        title: "Карточка для конкурентного claim",
        specialization: "BACKEND",
        level: "MIDDLE",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
    });
    createdCardIds.push(card.id);

    const startsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const slot = await started.prisma.availabilitySlot.create({
      data: {
        cardId: card.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
        durationMinutes: 60,
        status: AvailabilitySlotStatus.OPEN,
      },
    });

    return { cardId: card.id, slotId: slot.id };
  }

  it("два параллельных отклика на один слот: ровно один успешен, второй получает 409, слот забронирован один раз", async () => {
    const owner = await createUser("owner");
    const first = await createUser("first");
    const second = await createUser("second");
    const { cardId, slotId } = await createCardWithSlot(owner.id);

    const results = await Promise.allSettled([
      matchmaking.create(first.id, { targetCardId: cardId, slotId }),
      matchmaking.create(second.id, { targetCardId: cardId, slotId }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    // Клиенту нужен ответ «слот занят», а не «вы уже откликались на эту карточку»
    // и не текст про профиль: это разные отказы с разными действиями.
    expect((rejected[0].reason as Error).message).toMatch(/слот уже занят/);

    const slot = await started.prisma.availabilitySlot.findUniqueOrThrow({
      where: { id: slotId },
      include: { requests: { select: { id: true } } },
    });

    expect(slot.status).toBe(AvailabilitySlotStatus.BOOKED);
    // `bookedByRequestId` указывает ровно на одну заявку: если бы слот
    // забронировали дважды, поле перезаписалось бы вторым и первый победитель
    // остался бы с заявкой без слота.
    expect(slot.bookedByRequestId).toBe(
      (fulfilled[0] as PromiseFulfilledResult<{ id: string }>).value.id,
    );
    expect(slot.requests).toHaveLength(1);
  });

  it("после отказа проигравшего слот остаётся забронированным заявкой победителя", async () => {
    // Регрессия на «гонку двух писателей»: проигравшая транзакция не должна
    // освободить или переписать слот, выигранный другой транзакцией.
    const owner = await createUser("owner2");
    const first = await createUser("first2");
    const second = await createUser("second2");
    const { cardId, slotId } = await createCardWithSlot(owner.id);

    // Кто проиграл, заранее неизвестно, поэтому проигравшего определяем по
    // результату гонки, а не по порядку аргументов.
    const attempts = [
      { senderId: first.id, label: "first2" },
      { senderId: second.id, label: "second2" },
    ];

    const results = await Promise.allSettled(
      attempts.map(({ senderId }) =>
        matchmaking.create(senderId, { targetCardId: cardId, slotId }),
      ),
    );

    const winnerIndex = results.findIndex((r) => r.status === "fulfilled");
    const loserIndex = results.findIndex((r) => r.status === "rejected");

    expect(winnerIndex).toBeGreaterThanOrEqual(0);
    expect(loserIndex).toBeGreaterThanOrEqual(0);

    const winner = results[winnerIndex] as PromiseFulfilledResult<{
      id: string;
    }>;
    const loser = attempts[loserIndex];

    const slot = await started.prisma.availabilitySlot.findUniqueOrThrow({
      where: { id: slotId },
    });

    expect(slot.status).toBe(AvailabilitySlotStatus.BOOKED);
    expect(slot.bookedByRequestId).toBe(winner.value.id);

    // Повторный отклик именно проигравшего на тот же слот должен получить 409,
    // то есть проверка «свободен ли слот» не обходится на уже занятом слоте.
    // Повтор победителя такого отказа не даёт: он находит свою PENDING-заявку
    // и меняет расписание, не пересобирая слот.
    await expect(
      matchmaking.create(loser.senderId, { targetCardId: cardId, slotId }),
    ).rejects.toBeInstanceOf(ConflictException);

    const slotAfterRetry =
      await started.prisma.availabilitySlot.findUniqueOrThrow({
        where: { id: slotId },
      });

    expect(slotAfterRetry.bookedByRequestId).toBe(winner.value.id);
  });
});
