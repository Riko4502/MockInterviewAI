import { randomUUID } from "node:crypto";
import { ForbiddenException } from "@nestjs/common";
import { InterviewParticipantRole } from "../../src/generated/prisma/enums";
import { sessionMembersKey } from "../../src/modules/sessions/session-keys";
import { SessionsService } from "../../src/modules/sessions/sessions.service";
import {
  type StartedApp,
  startTestApp,
  stopTestApp,
  uniqueEmail,
} from "../helpers/test-app.helper";

describe("Integration (PostgreSQL + Redis): Concurrency Serialization for Participant Limit in joinSession", () => {
  let started: StartedApp;
  let sessionsService: SessionsService;
  let redisClient: { hlen: (k: string) => Promise<number> };
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    started = await startTestApp();
    sessionsService = started.app.get(SessionsService);
    redisClient = (
      started.redis as unknown as {
        client: { hlen: (k: string) => Promise<number> };
      }
    ).client;
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await started.prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    await stopTestApp(started);
  });

  async function createUser(
    prefix = "user",
  ): Promise<{ id: string; email: string }> {
    const user = await started.prisma.user.create({
      data: {
        email: uniqueEmail(),
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
        username: `${prefix}_${randomUUID().slice(0, 8)}`,
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  it("конкурентные параллельные запросы joinSession при 9 участниках: только 1 запрос успешен, лимит 10 не превышается", async () => {
    // 1. Создаем владельца и сессию (1-й участник)
    const owner = await createUser("owner");
    const { sessionId, inviteToken } = await sessionsService.createSession(
      owner.id,
    );

    // 2. Добавляем 8 участников, чтобы в сессии стало ровно 9 участников (остался 1 свободный слот до 10)
    for (let i = 0; i < 8; i++) {
      const participantUser = await createUser(`member_${i}`);
      await sessionsService.addParticipant(
        sessionId,
        participantUser.id,
        InterviewParticipantRole.CANDIDATE,
      );
    }

    const countBefore = await started.prisma.interviewParticipant.count({
      where: { sessionId },
    });
    expect(countBefore).toBe(9);

    // 3. Создаем 4 новых кандидата, которые попытаются войти одновременно
    const candidate1 = await createUser("cand_1");
    const candidate2 = await createUser("cand_2");
    const candidate3 = await createUser("cand_3");
    const candidate4 = await createUser("cand_4");

    const candidates = [candidate1, candidate2, candidate3, candidate4];

    // 4. Запускаем одновременный вызов joinSession параллельно
    const results = await Promise.allSettled(
      candidates.map((cand) =>
        sessionsService.joinSession(sessionId, cand.id, inviteToken),
      ),
    );

    // 5. Проверяем результаты выполнения промисов
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(3);

    for (const rej of rejected) {
      expect(rej.reason).toBeInstanceOf(ForbiddenException);
      expect(rej.reason.message).toBe("Interview session is full");
    }

    // 6. Проверяем состояние в PostgreSQL: строго 10 участников
    const countAfter = await started.prisma.interviewParticipant.count({
      where: { sessionId },
    });
    expect(countAfter).toBe(10);

    // 7. Проверяем состояние в Redis-зеркале: ровно 10 участников, успешный кандидат добавлен, неуспешные нет
    const redisMembersCount = await redisClient.hlen(
      sessionMembersKey(sessionId),
    );
    expect(redisMembersCount).toBe(10);

    const successfulIndex = results.findIndex((r) => r.status === "fulfilled");
    expect(successfulIndex).toBeGreaterThanOrEqual(0);

    const successfulCandidate = candidates[successfulIndex];
    if (!successfulCandidate) {
      throw new Error("Expected successful candidate to be defined");
    }

    const roleInRedis = await started.redis.hget(
      sessionMembersKey(sessionId),
      successfulCandidate.id,
    );
    expect(roleInRedis).toBe(InterviewParticipantRole.CANDIDATE);
  });

  it("конкурентные параллельные запросы при 8 участниках: ровно 2 запроса успешны из 5 параллельных", async () => {
    // 1. Создаем владельца и сессию (1-й участник)
    const owner = await createUser("owner2");
    const { sessionId, inviteToken } = await sessionsService.createSession(
      owner.id,
    );

    // 2. Добавляем 7 участников (всего 8 участников, свободно 2 слота)
    for (let i = 0; i < 7; i++) {
      const participantUser = await createUser(`member2_${i}`);
      await sessionsService.addParticipant(
        sessionId,
        participantUser.id,
        InterviewParticipantRole.CANDIDATE,
      );
    }

    const countBefore = await started.prisma.interviewParticipant.count({
      where: { sessionId },
    });
    expect(countBefore).toBe(8);

    // 3. Создаем 5 новых кандидатов
    const candidates = await Promise.all(
      Array.from({ length: 5 }, (_, i) => createUser(`race_cand_${i}`)),
    );

    // 4. Запускаем все 5 запросов одновременно
    const results = await Promise.allSettled(
      candidates.map((cand) =>
        sessionsService.joinSession(sessionId, cand.id, inviteToken),
      ),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    expect(fulfilled).toHaveLength(2);
    expect(rejected).toHaveLength(3);

    for (const rej of rejected) {
      expect(rej.reason).toBeInstanceOf(ForbiddenException);
      expect(rej.reason.message).toBe("Interview session is full");
    }

    // 5. В PostgreSQL строго 10 участников
    const countAfter = await started.prisma.interviewParticipant.count({
      where: { sessionId },
    });
    expect(countAfter).toBe(10);

    // 6. В Redis-зеркале строго 10 участников
    const redisMembersCount = await redisClient.hlen(
      sessionMembersKey(sessionId),
    );
    expect(redisMembersCount).toBe(10);
  });
});
