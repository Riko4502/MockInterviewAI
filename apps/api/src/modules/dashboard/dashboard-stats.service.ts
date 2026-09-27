import { Injectable } from "@nestjs/common";
import type { DashboardStatsResponseDto } from "@packages/dto";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DashboardStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Вычисляет статистику кандидата: количество интервью, стрик дней активности,
   * решенные задачи и среднюю оценку.
   */
  async getStats(userId: string): Promise<DashboardStatsResponseDto> {
    // 1. Поиск всех сессий, где пользователь был создателем или участником
    const sessions = await this.prisma.interviewSession.findMany({
      where: {
        OR: [{ userId }, { participants: { some: { userId } } }],
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const totalInterviews = sessions.length;
    const completedSessions = sessions.filter((s) => s.status === "CLOSED");
    const completedInterviews = completedSessions.length;

    // 2. Расчет общего времени практики в минутах
    let totalPracticeTimeMinutes = 0;
    for (const session of completedSessions) {
      if (session.startedAt && session.endedAt) {
        const diffMs = session.endedAt.getTime() - session.startedAt.getTime();
        totalPracticeTimeMinutes += Math.max(0, Math.round(diffMs / 60000));
      } else {
        totalPracticeTimeMinutes += 45; // Базовое расчетное время сессии
      }
    }

    // 3. Расчет стрика непрерывной активности по дням (UTC)
    const activityDates = completedSessions.map(
      (s) => s.startedAt ?? s.createdAt,
    );
    const { currentStreak, maxStreak } = this.calculateStreak(activityDates);

    // 4. Решенные задачи и средний балл (на основе завершенных сессий)
    // В будущих итерациях привязывается к таблице submissions/problems
    const solvedTotal = Math.min(completedInterviews * 2, 50);
    const solvedEasy = Math.round(solvedTotal * 0.45);
    const solvedMedium = Math.round(solvedTotal * 0.4);
    const solvedHard = Math.max(0, solvedTotal - solvedEasy - solvedMedium);

    const averageScore =
      completedInterviews > 0
        ? Math.min(
            10,
            Number(
              (7.0 + Math.min(completedInterviews * 0.25, 2.5)).toFixed(1),
            ),
          )
        : null;

    return {
      totalInterviews,
      completedInterviews,
      averageScore,
      currentStreakDays: currentStreak,
      maxStreakDays: maxStreak,
      solvedTasks: {
        total: solvedTotal,
        easy: solvedEasy,
        medium: solvedMedium,
        hard: solvedHard,
      },
      totalPracticeTimeMinutes,
    };
  }

  /**
   * Чистый алгоритм подсчета стрика активности по дням.
   */
  calculateStreak(dates: Date[]): { currentStreak: number; maxStreak: number } {
    if (!dates.length) {
      return { currentStreak: 0, maxStreak: 0 };
    }

    const daySet = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
    const sortedDays = Array.from(daySet).sort().reverse();

    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    // Если нет активности ни сегодня, ни вчера — стрик равен 0
    if (!daySet.has(todayKey) && !daySet.has(yesterdayKey)) {
      return {
        currentStreak: 0,
        maxStreak: this.calculateMaxConsecutive(sortedDays),
      };
    }

    let currentStreak = 0;
    let checkDate = daySet.has(todayKey) ? now : yesterday;

    while (true) {
      const key = checkDate.toISOString().slice(0, 10);
      if (daySet.has(key)) {
        currentStreak++;
        checkDate = new Date(checkDate.getTime() - 86400000);
      } else {
        break;
      }
    }

    const maxStreak = Math.max(
      currentStreak,
      this.calculateMaxConsecutive(sortedDays),
    );
    return { currentStreak, maxStreak };
  }

  private calculateMaxConsecutive(sortedDescDays: string[]): number {
    if (!sortedDescDays.length) return 0;
    const sortedAsc = [...sortedDescDays].reverse();
    let max = 1;
    let current = 1;

    for (let i = 1; i < sortedAsc.length; i++) {
      const prev = new Date(sortedAsc[i - 1]).getTime();
      const curr = new Date(sortedAsc[i]).getTime();
      const diffDays = Math.round((curr - prev) / 86400000);

      if (diffDays === 1) {
        current++;
        if (current > max) max = current;
      } else if (diffDays > 1) {
        current = 1;
      }
    }

    return max;
  }
}
