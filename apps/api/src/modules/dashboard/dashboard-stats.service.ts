import { Injectable } from "@nestjs/common";
import {
  type DashboardStatsResponseDto,
  InterviewSessionStatus,
} from "@packages/dto";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DashboardStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Вычисляет статистику кандидата: количество интервью, стрик дней активности,
   * решенные задачи и среднюю оценку.
   */
  async getStats(userId: string): Promise<DashboardStatsResponseDto> {
    const userSessionsFilter = {
      OR: [{ userId }, { participants: { some: { userId } } }],
    };

    // 1. Подсчет итогов через count в БД (без загрузки массива сессий в память)
    const totalInterviewsPromise = this.prisma.interviewSession.count({
      where: userSessionsFilter,
    });

    const completedInterviewsPromise = this.prisma.interviewSession.count({
      where: {
        ...userSessionsFilter,
        status: InterviewSessionStatus.CLOSED,
      },
    });

    // 2. Для streak загружаем только уникальные даты закрытых сессий, сгруппированные по дню (UTC)
    const distinctDatesPromise = this.prisma.$queryRaw<
      Array<{ activityDate: string | Date }>
    >`
      SELECT DISTINCT
        TO_CHAR(COALESCE(s.started_at, s.created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "activityDate"
      FROM "interview_sessions" s
      WHERE s.status::text = 'CLOSED'
        AND (
          s.user_id = ${userId}::uuid
          OR EXISTS (
            SELECT 1
            FROM "interview_participants" p
            WHERE p.session_id = s.id AND p.user_id = ${userId}::uuid
          )
        )
      ORDER BY "activityDate" DESC
    `;

    // 3. Расчет общего времени практики в минутах на уровне БД (агрегация вместо загрузки в память)
    const practiceTimePromise = this.prisma.$queryRaw<
      Array<{ totalMinutes: number | string | null }>
    >`
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN s.started_at IS NOT NULL AND s.ended_at IS NOT NULL THEN
                GREATEST(0, ROUND(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60))
              ELSE 45
            END
          ),
          0
        )::int AS "totalMinutes"
      FROM "interview_sessions" s
      WHERE s.status::text = 'CLOSED'
        AND (
          s.user_id = ${userId}::uuid
          OR EXISTS (
            SELECT 1
            FROM "interview_participants" p
            WHERE p.session_id = s.id AND p.user_id = ${userId}::uuid
          )
        )
    `;

    const [
      totalInterviews,
      completedInterviews,
      distinctDateRows,
      practiceTimeRows,
    ] = await Promise.all([
      totalInterviewsPromise,
      completedInterviewsPromise,
      distinctDatesPromise,
      practiceTimePromise,
    ]);

    const totalPracticeTimeMinutes = Number(
      practiceTimeRows[0]?.totalMinutes ?? 0,
    );

    const activityDates = distinctDateRows.map((r) => {
      if (r.activityDate instanceof Date) {
        return r.activityDate;
      }
      const str = String(r.activityDate);
      return str.includes("T")
        ? new Date(str)
        : new Date(`${str}T00:00:00.000Z`);
    });
    const { currentStreak, maxStreak } = this.calculateStreak(activityDates);

    // 4. Решенные задачи и средний балл:
    // До появления источника данных (связи с submissions/problems) возвращаем нулевую разбивку и averageScore: null
    const solvedTotal = 0;
    const solvedEasy = 0;
    const solvedMedium = 0;
    const solvedHard = 0;
    const averageScore = null;

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
