import { Injectable } from "@nestjs/common";
import {
  type DashboardInsightsResponseDto,
  type DashboardMatchRequestsResponseDto,
  InterviewParticipantRole,
  InterviewSessionStatus,
  type RecentSessionsResponseDto,
  type ShowcaseStatusResponseDto,
  type UpcomingSessionResponseDto,
} from "@packages/dto";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Получение ближайшего запланированного или активного интервью.
   */
  async getUpcomingSession(
    userId: string,
  ): Promise<UpcomingSessionResponseDto> {
    const session = await this.prisma.interviewSession.findFirst({
      where: {
        status: {
          in: [InterviewSessionStatus.CREATED, InterviewSessionStatus.ACTIVE],
        },
        OR: [{ userId }, { participants: { some: { userId } } }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      return { hasUpcoming: false, session: null };
    }

    const scheduledDate = session.startedAt ?? session.createdAt;
    const now = new Date();
    const diffMs = scheduledDate.getTime() - now.getTime();
    const secondsUntilStart = Math.max(0, Math.round(diffMs / 1000));

    // Готов к входу, если сессия уже ACTIVE или до старта <= 10 минут
    const isReadyToJoin =
      session.status === InterviewSessionStatus.ACTIVE ||
      secondsUntilStart <= 600;

    // Определяем роль текущего пользователя
    const currentParticipant = session.participants.find(
      (p) => p.userId === userId,
    );
    const role = currentParticipant?.role ?? InterviewParticipantRole.CANDIDATE;

    // Напарник (первый участник, не являющийся текущим пользователем)
    const partnerParticipant = session.participants.find(
      (p) => p.userId !== userId,
    );
    const partner = partnerParticipant
      ? {
          id: partnerParticipant.user.id,
          displayName: partnerParticipant.user.displayName,
          username: partnerParticipant.user.username,
          avatarUrl: partnerParticipant.user.avatarUrl,
        }
      : null;

    return {
      hasUpcoming: true,
      session: {
        id: session.id,
        title: "Mock Interview Session",
        status: session.status,
        scheduledAt: scheduledDate.toISOString(),
        role,
        partner,
        isReadyToJoin,
        secondsUntilStart,
      },
    };
  }

  /**
   * Получение входящих заявок на проведение собеседований (MatchRequest).
   */
  async getMatchRequests(
    userId: string,
    limit = 5,
  ): Promise<DashboardMatchRequestsResponseDto> {
    const [requests, totalPendingCount] = await Promise.all([
      this.prisma.matchRequest.findMany({
        where: {
          receiverId: userId,
          status: "PENDING",
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          sender: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          senderCard: {
            select: {
              specialization: true,
              level: true,
              skills: true,
            },
          },
        },
      }),
      this.prisma.matchRequest.count({
        where: {
          receiverId: userId,
          status: "PENDING",
        },
      }),
    ]);

    const items = requests.map((req) => ({
      id: req.id,
      senderId: req.senderId,
      senderName: req.sender.displayName,
      senderAvatarUrl: req.sender.avatarUrl,
      specialization: req.senderCard?.specialization ?? null,
      level: req.senderCard?.level ?? null,
      skills: req.senderCard?.skills ?? [],
      createdAt: req.createdAt.toISOString(),
      message: req.message,
    }));

    return {
      items,
      totalPendingCount,
    };
  }

  /**
   * Получение последних завершенных интервью.
   */
  async getRecentSessions(
    userId: string,
    limit = 5,
  ): Promise<RecentSessionsResponseDto> {
    const sessions = await this.prisma.interviewSession.findMany({
      where: {
        status: InterviewSessionStatus.CLOSED,
        OR: [{ userId }, { participants: { some: { userId } } }],
      },
      take: limit,
      orderBy: { endedAt: "desc" },
      include: {
        participants: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    const items = sessions.map((s) => {
      const durationMinutes =
        s.startedAt && s.endedAt
          ? Math.max(
              1,
              Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 60000),
            )
          : 45;

      return {
        id: s.id,
        title: `Mock Session #${s.id.slice(0, 6)}`,
        completedAt: (s.endedAt ?? s.createdAt).toISOString(),
        durationMinutes,
        score: null,
        specialization: null,
        level: null,
        role: s.participants[0]?.role ?? InterviewParticipantRole.CANDIDATE,
        hasFeedbackReport: false,
      };
    });

    return { items };
  }

  /**
   * Формирование рекомендаций AI («Зоны роста»).
   */
  async getInsights(_userId: string): Promise<DashboardInsightsResponseDto> {
    return {
      insights: [
        {
          id: "insight-space-complexity",
          category: "ALGORITHMS",
          headline: "Оценка пространственной сложности (Space Complexity)",
          recommendation:
            "В последних сессиях вы упускали стек вызовов при рекурсии в графах и деревьях. Рекомендуем повторить DFS и BFS.",
          practiceUrl: "/dashboard/sandbox?topic=trees",
        },
        {
          id: "insight-db-indexes",
          category: "SYSTEM_DESIGN",
          headline: "Индексы и партиционирование в PostgreSQL",
          recommendation:
            "Отличные знания базовой архитектуры! Для перехода на уровень Senior обратите внимание на составные и частичные индексы.",
          practiceUrl: "/dashboard/sandbox?topic=system-design",
        },
      ],
      overallSummary:
        "Ваш сильнейший навык — декомпозиция задач и коммуникация (9.0/10). Рекомендуемый фокус недели: алгоритмы на графы.",
    };
  }

  /**
   * Получение статуса своей анкеты на витрине.
   */
  async getShowcaseStatus(userId: string): Promise<ShowcaseStatusResponseDto> {
    const card = await this.prisma.showcaseCard.findFirst({
      where: {
        userId,
        status: "ACTIVE",
      },
      include: {
        receivedRequests: {
          where: { status: "PENDING" },
          select: { id: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!card) {
      return { hasActiveCard: false, card: null };
    }

    const now = new Date();
    const daysLeft = Math.max(
      0,
      Math.ceil((card.expiresAt.getTime() - now.getTime()) / 86400000),
    );
    const canBump = now.getTime() - card.bumpedAt.getTime() >= 86400000;

    return {
      hasActiveCard: true,
      card: {
        id: card.id,
        specialization: card.specialization,
        level: card.level,
        isUrgent: card.isUrgent,
        expiresAt: card.expiresAt.toISOString(),
        daysLeft,
        canBump,
        lastBumpedAt: card.bumpedAt.toISOString(),
        viewsCount: 24, // В будущих спринтах привязать к счетчику просмотров
        incomingRequestsCount: card.receivedRequests.length,
      },
    };
  }
}
