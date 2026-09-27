import { Injectable, NotFoundException } from "@nestjs/common";
import {
  type DashboardReadinessResponseDto,
  InterviewSessionStatus,
  type ReadinessStepDto,
} from "@packages/dto";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DashboardReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Вычисляет процент готовности кандидата к собеседованиям и статус ключевых шагов онбординга.
   */
  async getReadiness(userId: string): Promise<DashboardReadinessResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        deviceSettings: { take: 1 },
        showcaseCards: { select: { id: true, status: true }, take: 1 },
        sessions: {
          where: { status: InterviewSessionStatus.CLOSED },
          select: { id: true },
          take: 1,
        },
        participations: {
          where: {
            session: { status: InterviewSessionStatus.CLOSED },
          },
          select: { sessionId: true },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }

    const emailConfirmed = Boolean(user.email);
    const mediaConfigured =
      user.deviceSettings.length > 0 &&
      Boolean(
        user.deviceSettings[0].preferredAudioInputLabel ||
          user.deviceSettings[0].preferredVideoInputLabel,
      );
    const telegramLinked = Boolean(
      user.telegramLinkVerified && (user.telegramId || user.telegramUsername),
    );
    const showcaseCreated = user.showcaseCards.length > 0;
    const firstMockCompleted =
      user.sessions.length > 0 || user.participations.length > 0;

    const steps: ReadinessStepDto[] = [
      {
        key: "EMAIL_CONFIRMED",
        title: "Подтвердить адрес электронной почты",
        description:
          "Необходимо для восстановления доступа и важных системных уведомлений",
        isCompleted: emailConfirmed,
        actionUrl: "/dashboard/profile",
      },
      {
        key: "MEDIA_CONFIGURED",
        title: "Проверить микрофон и камеру",
        description:
          "Убедитесь, что качество звука и видео готово к онлайн-собеседованию",
        isCompleted: mediaConfigured,
        actionUrl: "/dashboard/profile#media",
      },
      {
        key: "TELEGRAM_LINKED",
        title: "Привязать Telegram для звонков и пушей",
        description:
          "Мгновенные уведомления о приглашениях на мок-интервью прямо в мессенджер",
        isCompleted: telegramLinked,
        actionUrl: "/dashboard/profile#telegram",
      },
      {
        key: "SHOWCASE_CREATED",
        title: "Разместить анкету на витрине поиска",
        description:
          "Укажите стек, грейд и свободное время, чтобы другие кандидаты могли пригласить вас",
        isCompleted: showcaseCreated,
        actionUrl: "/dashboard/partners",
      },
      {
        key: "FIRST_MOCK_COMPLETED",
        title: "Пройти первое практическое интервью",
        description:
          "Проверьте свои навыки в тестовом AI-интервью или в сессии с реальным напарником",
        isCompleted: firstMockCompleted,
        actionUrl: "/dashboard/sandbox",
      },
    ];

    const completedCount = steps.filter((s) => s.isCompleted).length;
    const totalPercentage = Math.round((completedCount / steps.length) * 100);
    const isFullyReady = totalPercentage === 100;

    return {
      totalPercentage,
      isFullyReady,
      steps,
    };
  }
}
