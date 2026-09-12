import { randomUUID } from "node:crypto";
import { InterviewParticipantRole } from "../../src/generated/prisma/enums";
import {
  type StartedApp,
  startTestApp,
  stopTestApp,
  uniqueEmail,
} from "../helpers/test-app.helper";

interface ConstraintInfo {
  constraint_name: string;
  table_name: string;
  foreign_table_name: string;
}

interface IndexInfo {
  indexname: string;
  tablename: string;
}

describe("Integration (PostgreSQL): Database Referential Integrity & ON DELETE CASCADE (CRIT-01)", () => {
  let started: StartedApp;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    started = await startTestApp();
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await started.prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    await stopTestApp(started);
  });

  describe("PostgreSQL System Catalog Introspection", () => {
    it("PostgreSQL содержит FOREIGN KEY constraints для interview_sessions и interview_participants", async () => {
      const constraints = await started.prisma.$queryRaw<ConstraintInfo[]>`
        SELECT
          tc.constraint_name,
          tc.table_name,
          ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name IN ('interview_sessions', 'interview_participants');
      `;

      const sessionUserFk = constraints.find(
        (c) =>
          c.table_name === "interview_sessions" &&
          c.foreign_table_name === "users",
      );
      expect(sessionUserFk).toBeDefined();
      expect(sessionUserFk?.constraint_name).toBe(
        "interview_sessions_userId_fkey",
      );

      const participantUserFk = constraints.find(
        (c) =>
          c.table_name === "interview_participants" &&
          c.foreign_table_name === "users",
      );
      expect(participantUserFk).toBeDefined();
      expect(participantUserFk?.constraint_name).toBe(
        "interview_participants_userId_fkey",
      );

      const participantSessionFk = constraints.find(
        (c) =>
          c.table_name === "interview_participants" &&
          c.foreign_table_name === "interview_sessions",
      );
      expect(participantSessionFk).toBeDefined();
      expect(participantSessionFk?.constraint_name).toBe(
        "interview_participants_sessionId_fkey",
      );
    });

    it("PostgreSQL содержит индексы по userId и status", async () => {
      const indexes = await started.prisma.$queryRaw<IndexInfo[]>`
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename IN ('interview_sessions', 'interview_participants');
      `;

      const indexNames = indexes.map((i) => i.indexname);

      expect(indexNames).toContain("interview_sessions_userId_idx");
      expect(indexNames).toContain("interview_sessions_status_idx");
      expect(indexNames).toContain("interview_participants_userId_idx");
      expect(indexNames).toContain("interview_participants_pkey");
    });
  });

  describe("Real PostgreSQL Cascade Deletion Behavior", () => {
    it("создание User, InterviewSession и InterviewParticipant с реальной связью по внешним ключам", async () => {
      const user = await started.prisma.user.create({
        data: {
          email: uniqueEmail(),
          passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
          username: `user_${randomUUID().slice(0, 8)}`,
        },
      });
      createdUserIds.push(user.id);

      const session = await started.prisma.interviewSession.create({
        data: {
          userId: user.id,
          participants: {
            create: {
              userId: user.id,
              role: InterviewParticipantRole.INTERVIEWER,
            },
          },
        },
        include: {
          user: true,
          participants: true,
        },
      });

      expect(session.userId).toBe(user.id);
      expect(session.user.id).toBe(user.id);
      expect(session.participants).toHaveLength(1);
      expect(session.participants[0].userId).toBe(user.id);
    });

    it("удаление User каскадно удаляет связанные InterviewSession и InterviewParticipant в PostgreSQL", async () => {
      const owner = await started.prisma.user.create({
        data: {
          email: uniqueEmail(),
          passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
          username: `owner_${randomUUID().slice(0, 8)}`,
        },
      });

      const candidate = await started.prisma.user.create({
        data: {
          email: uniqueEmail(),
          passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
          username: `cand_${randomUUID().slice(0, 8)}`,
        },
      });
      createdUserIds.push(candidate.id);

      const session = await started.prisma.interviewSession.create({
        data: {
          userId: owner.id,
          participants: {
            createMany: {
              data: [
                {
                  userId: owner.id,
                  role: InterviewParticipantRole.INTERVIEWER,
                },
                {
                  userId: candidate.id,
                  role: InterviewParticipantRole.CANDIDATE,
                },
              ],
            },
          },
        },
      });

      const sessionId = session.id;

      // Удаляем владельца сессии в PostgreSQL
      await started.prisma.user.delete({
        where: { id: owner.id },
      });

      // Проверяем, что сессия удалена из PostgreSQL
      const deletedSession = await started.prisma.interviewSession.findUnique({
        where: { id: sessionId },
      });
      expect(deletedSession).toBeNull();

      // Проверяем, что записи всех участников сессии также удалены из PostgreSQL
      const remainingParticipants =
        await started.prisma.interviewParticipant.findMany({
          where: { sessionId },
        });
      expect(remainingParticipants).toHaveLength(0);
    });

    it("удаление участника-кандидата каскадно удаляет его запись из InterviewParticipant, сохраняя сессию владельца", async () => {
      const owner = await started.prisma.user.create({
        data: {
          email: uniqueEmail(),
          passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
          username: `owner_keep_${randomUUID().slice(0, 8)}`,
        },
      });
      createdUserIds.push(owner.id);

      const candidate = await started.prisma.user.create({
        data: {
          email: uniqueEmail(),
          passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
          username: `cand_del_${randomUUID().slice(0, 8)}`,
        },
      });

      const session = await started.prisma.interviewSession.create({
        data: {
          userId: owner.id,
          participants: {
            createMany: {
              data: [
                {
                  userId: owner.id,
                  role: InterviewParticipantRole.INTERVIEWER,
                },
                {
                  userId: candidate.id,
                  role: InterviewParticipantRole.CANDIDATE,
                },
              ],
            },
          },
        },
      });

      // Удаляем кандидата в PostgreSQL
      await started.prisma.user.delete({
        where: { id: candidate.id },
      });

      // Сессия владельца должна сохраниться
      const sessionAfter = await started.prisma.interviewSession.findUnique({
        where: { id: session.id },
        include: { participants: true },
      });
      expect(sessionAfter).not.toBeNull();
      expect(sessionAfter?.participants).toHaveLength(1);
      expect(sessionAfter?.participants[0].userId).toBe(owner.id);
    });
  });
});
