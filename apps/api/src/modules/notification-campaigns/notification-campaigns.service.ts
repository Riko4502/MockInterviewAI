import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type {
  CreateNotificationCampaignDto,
  NotificationCampaignCancelDto,
  NotificationCampaignDetailsDto,
  NotificationCampaignDto,
  NotificationCampaignRecipientEstimateDto,
  NotificationCampaignsPageDto,
  NotificationCampaignsQueryDto,
  UpdateNotificationCampaignDto,
} from "@packages/dto";
import {
  NotificationCampaignStatus,
  NotificationTargetType,
  NotificationType,
  Prisma,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { NotificationsService } from "../notifications/notifications.service";

const campaignInclude = {
  creator: { select: { id: true, displayName: true, email: true } },
} as const;
const campaignDetailsInclude = {
  ...campaignInclude,
  recipients: { select: { userId: true } },
} as const;
const CHUNK_SIZE = 500;
const LOCK_KEY = "mutex:admin-notifications:tick";
const LOCK_TTL_SECONDS = 60;

@Injectable()
export class NotificationCampaignsService {
  private readonly logger = new Logger(NotificationCampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    creatorId: string,
    input: CreateNotificationCampaignDto,
  ): Promise<NotificationCampaignDto> {
    const scheduledAt =
      input.sendMode === "DRAFT"
        ? null
        : new Date(input.scheduledAt ?? Date.now());
    const recipients =
      input.targetType === "SPECIFIC"
        ? await this.validateRecipients(input.recipientUserIds ?? [])
        : [];
    const totalRecipients =
      input.targetType === "ALL"
        ? await this.countActiveRecipients()
        : recipients.length;

    const campaign = await this.prisma.$transaction(async (tx) =>
      tx.notificationCampaign.create({
        data: {
          title: input.title,
          message: input.message,
          category: input.category as NotificationType,
          actionUrl: input.actionUrl ?? null,
          targetType: input.targetType as NotificationTargetType,
          status:
            input.sendMode === "DRAFT"
              ? NotificationCampaignStatus.DRAFT
              : NotificationCampaignStatus.SCHEDULED,
          scheduledAt,
          totalRecipients,
          creatorId,
          ...(recipients.length > 0
            ? {
                recipients: {
                  createMany: {
                    data: recipients.map((userId) => ({ userId })),
                  },
                },
              }
            : {}),
        },
        include: campaignInclude,
      }),
    );
    return this.toDto(campaign, 0, 0);
  }

  async findAll(
    query: NotificationCampaignsQueryDto,
  ): Promise<NotificationCampaignsPageDto> {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetType
        ? { targetType: query.targetType as NotificationTargetType }
        : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: "insensitive" as const } }
        : {}),
    };
    const [campaigns, total] = await Promise.all([
      this.prisma.notificationCampaign.findMany({
        where,
        include: campaignInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notificationCampaign.count({ where }),
    ]);
    const ids = campaigns.map(({ id }) => id);
    const readGroups = ids.length
      ? await this.prisma.notification.groupBy({
          by: ["campaignId"],
          where: { campaignId: { in: ids }, readAt: { not: null } },
          _count: { _all: true },
        })
      : [];
    const reads = new Map(
      readGroups.flatMap((group) =>
        group.campaignId
          ? [[group.campaignId, group._count._all] as const]
          : [],
      ),
    );
    return {
      items: campaigns.map((campaign) =>
        this.toDto(campaign, campaign.sentCount, reads.get(campaign.id) ?? 0),
      ),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string): Promise<NotificationCampaignDetailsDto> {
    const campaign = await this.prisma.notificationCampaign.findUnique({
      where: { id },
      include: campaignDetailsInclude,
    });
    if (!campaign)
      throw new NotFoundException("Notification campaign not found");
    const readCount = await this.prisma.notification.count({
      where: { campaignId: id, readAt: { not: null } },
    });
    return {
      ...this.toDto(campaign, campaign.sentCount, readCount),
      recipientUserIds:
        campaign.targetType === NotificationTargetType.SPECIFIC
          ? campaign.recipients.map(({ userId }) => userId)
          : [],
    };
  }
  async estimateRecipients(): Promise<NotificationCampaignRecipientEstimateDto> {
    return { count: await this.countActiveRecipients() };
  }

  async update(
    id: string,
    input: UpdateNotificationCampaignDto,
  ): Promise<NotificationCampaignDto> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.notificationCampaign.findUnique({
        where: { id },
        include: { recipients: { select: { userId: true } } },
      });
      if (!current)
        throw new NotFoundException("Notification campaign not found");
      if (
        current.status !== NotificationCampaignStatus.DRAFT &&
        current.status !== NotificationCampaignStatus.SCHEDULED
      ) {
        throw new BadRequestException(
          "Only draft or scheduled campaigns can be edited",
        );
      }
      const targetType = (input.targetType ??
        current.targetType) as NotificationTargetType;
      const replaceRecipients =
        input.recipientUserIds !== undefined || input.targetType !== undefined;
      let recipients = current.recipients.map(({ userId }) => userId);
      if (replaceRecipients) {
        recipients =
          targetType === NotificationTargetType.SPECIFIC
            ? await this.validateRecipients(
                input.recipientUserIds ??
                  (current.targetType === targetType ? recipients : []),
                tx,
              )
            : [];
        if (
          targetType === NotificationTargetType.SPECIFIC &&
          recipients.length === 0
        ) {
          throw new BadRequestException(
            "SPECIFIC campaigns require at least one recipient",
          );
        }
        await tx.notificationCampaignRecipient.deleteMany({
          where: { campaignId: id },
        });
        if (recipients.length)
          await tx.notificationCampaignRecipient.createMany({
            data: recipients.map((userId) => ({ campaignId: id, userId })),
          });
      }
      const totalRecipients =
        targetType === NotificationTargetType.ALL
          ? await this.countActiveRecipients(tx)
          : replaceRecipients
            ? recipients.length
            : current.totalRecipients;
      const updated = await tx.notificationCampaign.updateMany({
        where: {
          id,
          status: {
            in: [
              NotificationCampaignStatus.DRAFT,
              NotificationCampaignStatus.SCHEDULED,
            ],
          },
        },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.message !== undefined ? { message: input.message } : {}),
          ...(input.category !== undefined
            ? { category: input.category as NotificationType }
            : {}),
          ...(input.actionUrl !== undefined
            ? { actionUrl: input.actionUrl }
            : {}),
          targetType,
          totalRecipients,
          ...(input.scheduledAt !== undefined
            ? {
                scheduledAt: input.scheduledAt
                  ? new Date(input.scheduledAt)
                  : null,
              }
            : {}),
        },
      });
      if (!updated.count)
        throw new BadRequestException("Campaign status changed while updating");
    });
    return this.findOne(id);
  }

  async queue(id: string): Promise<NotificationCampaignDto> {
    const result = await this.prisma.notificationCampaign.updateMany({
      where: { id, status: NotificationCampaignStatus.DRAFT },
      data: {
        status: NotificationCampaignStatus.SCHEDULED,
        scheduledAt: new Date(),
      },
    });
    if (!result.count)
      await this.throwCampaignActionError(
        id,
        "Only draft campaigns can be queued",
      );
    return this.findOne(id);
  }

  async cancel(
    id: string,
    adminId: string,
    input: NotificationCampaignCancelDto,
  ): Promise<NotificationCampaignDto> {
    const result = await this.prisma.notificationCampaign.updateMany({
      where: {
        id,
        status: {
          in: [
            NotificationCampaignStatus.SCHEDULED,
            NotificationCampaignStatus.PROCESSING,
          ],
        },
      },
      data: {
        status: NotificationCampaignStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: adminId,
        cancellationReason: input?.reason ?? null,
      },
    });
    if (!result.count)
      await this.throwCampaignActionError(
        id,
        "Only scheduled or processing campaigns can be cancelled",
      );
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.prisma.notificationCampaign.deleteMany({
      where: {
        id,
        status: {
          in: [
            NotificationCampaignStatus.DRAFT,
            NotificationCampaignStatus.CANCELLED,
          ],
        },
      },
    });
    if (!result.count)
      await this.throwCampaignActionError(
        id,
        "Only draft or cancelled campaigns can be deleted",
      );
  }

  @Cron("*/10 * * * * *")
  async dispatchScheduledCampaigns(): Promise<void> {
    const workerToken = randomUUID();
    if (!(await this.redis.setNx(LOCK_KEY, workerToken, LOCK_TTL_SECONDS)))
      return;
    try {
      const campaigns = await this.prisma.notificationCampaign.findMany({
        where: {
          status: {
            in: [
              NotificationCampaignStatus.SCHEDULED,
              NotificationCampaignStatus.PROCESSING,
            ],
          },
          scheduledAt: { lte: new Date() },
        },
        select: { id: true, status: true },
        orderBy: { scheduledAt: "asc" },
        take: 50,
      });
      for (const campaign of campaigns) {
        try {
          if (campaign.status === NotificationCampaignStatus.SCHEDULED) {
            const totalRecipients = await this.countCampaignRecipients(
              campaign.id,
            );
            const claimed = await this.prisma.notificationCampaign.updateMany({
              where: {
                id: campaign.id,
                status: NotificationCampaignStatus.SCHEDULED,
              },
              data: {
                status: NotificationCampaignStatus.PROCESSING,
                sentAt: new Date(),
                processingStartedAt: new Date(),
                totalRecipients,
              },
            });
            if (!claimed.count) continue;
          }
          await this.processCampaignChunk(campaign.id);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.error(`Campaign ${campaign.id} failed: ${reason}`);
          try {
            await this.prisma.notificationCampaign.updateMany({
              where: {
                id: campaign.id,
                status: NotificationCampaignStatus.PROCESSING,
              },
              data: {
                status: NotificationCampaignStatus.FAILED,
                failureReason: reason,
                processingStartedAt: null,
              },
            });
          } catch (markFailedError) {
            const failure =
              markFailedError instanceof Error
                ? markFailedError.message
                : String(markFailedError);
            this.logger.error(
              "Could not mark campaign " +
                campaign.id +
                " as FAILED: " +
                failure,
            );
          }
        }
      }
    } finally {
      await this.redis.compareAndDelete(LOCK_KEY, workerToken);
    }
  }

  private async processCampaignChunk(id: string): Promise<void> {
    const campaign = await this.prisma.notificationCampaign.findUnique({
      where: { id },
    });
    if (!campaign || campaign.status !== NotificationCampaignStatus.PROCESSING)
      return;
    const lastId =
      campaign.lastProcessedUserId ?? "00000000-0000-0000-0000-000000000000";
    const activeFilter = { user: { isActive: true, deletedAt: null } };
    const ids =
      campaign.targetType === NotificationTargetType.ALL
        ? (
            await this.prisma.user.findMany({
              where: { id: { gt: lastId }, isActive: true, deletedAt: null },
              orderBy: { id: "asc" },
              take: CHUNK_SIZE,
              select: { id: true },
            })
          ).map(({ id: userId }) => userId)
        : (
            await this.prisma.notificationCampaignRecipient.findMany({
              where: {
                campaignId: id,
                userId: { gt: lastId },
                ...activeFilter,
              },
              orderBy: { userId: "asc" },
              take: CHUNK_SIZE,
              select: { userId: true },
            })
          ).map(({ userId }) => userId);

    if (ids.length === 0) {
      await this.prisma.notificationCampaign.updateMany({
        where: { id, status: NotificationCampaignStatus.PROCESSING },
        data: {
          status: NotificationCampaignStatus.COMPLETED,
          completedAt: new Date(),
          processingStartedAt: null,
        },
      });
      return;
    }
    const cursor = ids[ids.length - 1];
    const created = await this.prisma.$transaction(async (tx) => {
      const inserted = await tx.notification.createMany({
        data: ids.map((userId) => ({
          campaignId: id,
          userId,
          category: campaign.category,
          title: campaign.title,
          message: campaign.message,
          actionUrl: campaign.actionUrl,
        })),
        skipDuplicates: true,
      });
      const progress = await tx.notificationCampaign.updateMany({
        where: { id, status: NotificationCampaignStatus.PROCESSING },
        data: {
          sentCount: { increment: inserted.count },
          lastProcessedUserId: cursor,
        },
      });
      if (!progress.count)
        throw new Error("Campaign was cancelled while processing");
      return tx.notification.findMany({
        where: { campaignId: id, userId: { in: ids } },
        orderBy: { userId: "asc" },
      });
    });
    await this.notifications.syncCampaignNotifications(created);
  }

  private async validateRecipients(
    ids: string[],
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length < 1 || uniqueIds.length > 1000)
      throw new BadRequestException(
        "SPECIFIC campaigns require 1 to 1000 recipients",
      );
    const users = await db.user.findMany({
      where: { id: { in: uniqueIds }, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (users.length !== uniqueIds.length)
      throw new BadRequestException(
        "One or more recipients do not exist or are inactive",
      );
    return uniqueIds;
  }

  private async countActiveRecipients(
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    return db.user.count({ where: { isActive: true, deletedAt: null } });
  }

  private async countCampaignRecipients(id: string): Promise<number> {
    const campaign = await this.prisma.notificationCampaign.findUnique({
      where: { id },
      select: { targetType: true },
    });
    if (campaign?.targetType === NotificationTargetType.ALL)
      return this.countActiveRecipients();
    return this.prisma.notificationCampaignRecipient.count({
      where: { campaignId: id, user: { isActive: true, deletedAt: null } },
    });
  }

  private async throwCampaignActionError(
    id: string,
    message: string,
  ): Promise<never> {
    const exists = await this.prisma.notificationCampaign.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Notification campaign not found");
    throw new BadRequestException(message);
  }

  private toDto(
    campaign: {
      id: string;
      title: string;
      category: NotificationType;
      message: string;
      actionUrl: string | null;
      targetType: NotificationTargetType;
      status: NotificationCampaignStatus;
      scheduledAt: Date | null;
      sentAt: Date | null;
      completedAt: Date | null;
      totalRecipients: number;
      sentCount: number;
      lastProcessedUserId: string | null;
      failureReason: string | null;
      creatorId: string | null;
      cancelledById: string | null;
      cancelledAt: Date | null;
      cancellationReason: string | null;
      createdAt: Date;
      updatedAt: Date;
      creator: { id: string; displayName: string | null; email: string } | null;
    },
    sentCount: number,
    readCount: number,
  ): NotificationCampaignDto {
    return {
      id: campaign.id,
      title: campaign.title,
      message: campaign.message,
      category: campaign.category,
      actionUrl: campaign.actionUrl,
      targetType: campaign.targetType,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
      sentAt: campaign.sentAt?.toISOString() ?? null,
      completedAt: campaign.completedAt?.toISOString() ?? null,
      totalRecipients: campaign.totalRecipients,
      sentCount,
      readCount,
      lastProcessedUserId: campaign.lastProcessedUserId,
      failureReason: campaign.failureReason,
      createdById: campaign.creatorId,
      creator: campaign.creator,
      cancelledById: campaign.cancelledById,
      cancelledAt: campaign.cancelledAt?.toISOString() ?? null,
      cancellationReason: campaign.cancellationReason,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }
}
