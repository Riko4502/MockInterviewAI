import {
  NotificationCampaignStatus,
  NotificationTargetType,
  NotificationType,
} from "../../generated/prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RedisService } from "../../redis/redis.service";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationCampaignsService } from "./notification-campaigns.service";

describe("NotificationCampaignsService.findOne", () => {
  const campaignId = "11111111-1111-4111-a111-111111111111";
  const recipientIds = [
    "22222222-2222-4222-a222-222222222222",
    "33333333-3333-4333-a333-333333333333",
  ];
  const campaignRecord = (
    targetType: NotificationTargetType,
    recipients: { userId: string }[],
  ) => ({
    id: campaignId,
    title: "Maintenance",
    category: NotificationType.SYSTEM,
    message: "Scheduled maintenance",
    actionUrl: null,
    targetType,
    status: NotificationCampaignStatus.DRAFT,
    scheduledAt: null,
    sentAt: null,
    completedAt: null,
    totalRecipients: recipients.length,
    sentCount: 0,
    lastProcessedUserId: null,
    failureReason: null,
    creatorId: null,
    cancelledById: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    creator: null,
    recipients,
  });

  const setup = (campaign: ReturnType<typeof campaignRecord>) => {
    const prisma = {
      notificationCampaign: {
        findUnique: jest.fn().mockResolvedValue(campaign),
      },
      notification: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = new NotificationCampaignsService(
      prisma as unknown as PrismaService,
      {} as RedisService,
      {} as NotificationsService,
    );
    return { service, prisma };
  };

  it("returns all current SPECIFIC recipient IDs without loading User records", async () => {
    const { service, prisma } = setup(
      campaignRecord(
        NotificationTargetType.SPECIFIC,
        recipientIds.map((userId) => ({ userId })),
      ),
    );

    const result = await service.findOne(campaignId);

    expect(result.recipientUserIds).toEqual(recipientIds);
    expect(prisma.notificationCampaign.findUnique).toHaveBeenCalledWith({
      where: { id: campaignId },
      include: {
        creator: { select: { id: true, displayName: true, email: true } },
        recipients: { select: { userId: true } },
      },
    });
  });

  it("returns an empty recipient ID array for ALL campaigns", async () => {
    const { service } = setup(campaignRecord(NotificationTargetType.ALL, []));

    const result = await service.findOne(campaignId);

    expect(result.recipientUserIds).toEqual([]);
  });
  it("persists the edited SPECIFIC recipient set", async () => {
    const oldIds = [
      recipientIds[0],
      recipientIds[1],
      "44444444-4444-4444-a444-444444444444",
    ];
    const nextIds = [
      recipientIds[0],
      "44444444-4444-4444-a444-444444444444",
      "55555555-5555-4555-a555-555555555555",
    ];
    const current = campaignRecord(
      NotificationTargetType.SPECIFIC,
      oldIds.map((userId) => ({ userId })),
    );
    const updated = campaignRecord(
      NotificationTargetType.SPECIFIC,
      nextIds.map((userId) => ({ userId })),
    );
    const tx = {
      notificationCampaign: {
        findUnique: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notificationCampaignRecipient: {
        deleteMany: jest.fn().mockResolvedValue({ count: oldIds.length }),
        createMany: jest.fn().mockResolvedValue({ count: nextIds.length }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue(nextIds.map((id) => ({ id }))),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
      notificationCampaign: {
        findUnique: jest.fn().mockResolvedValue(updated),
      },
      notification: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = new NotificationCampaignsService(
      prisma as unknown as PrismaService,
      {} as RedisService,
      {} as NotificationsService,
    );

    const result = await service.update(campaignId, {
      recipientUserIds: nextIds,
    });

    expect(tx.notificationCampaignRecipient.deleteMany).toHaveBeenCalledWith({
      where: { campaignId },
    });
    expect(tx.notificationCampaignRecipient.createMany).toHaveBeenCalledWith({
      data: nextIds.map((userId) => ({ campaignId, userId })),
    });
  });
});
describe("NotificationCampaignsService.dispatchScheduledCampaigns", () => {
  const campaignId = "11111111-1111-4111-a111-111111111111";
  const failedCampaignId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const secondCampaignId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const cursor = "22222222-2222-4222-a222-222222222222";
  const nextRecipientId = "33333333-3333-4333-a333-333333333333";
  const lastRecipientId = "44444444-4444-4444-a444-444444444444";

  type ProcessingCampaign = {
    id: string;
    status: NotificationCampaignStatus;
    targetType: NotificationTargetType;
    lastProcessedUserId: string | null;
    category: NotificationType;
    title: string;
    message: string;
    actionUrl: string | null;
  };

  const makeCampaign = (
    id: string,
    targetType: NotificationTargetType = NotificationTargetType.ALL,
    lastProcessedUserId: string | null = cursor,
  ): ProcessingCampaign => ({
    id,
    status: NotificationCampaignStatus.PROCESSING,
    targetType,
    lastProcessedUserId,
    category: NotificationType.SYSTEM,
    title: "Maintenance",
    message: "Scheduled maintenance",
    actionUrl: null,
  });

  const setup = ({
    campaigns = [makeCampaign(campaignId)],
    recipientIds = [nextRecipientId, lastRecipientId],
    progressCount = 1,
    failedCampaignIds = [],
  }: {
    campaigns?: ProcessingCampaign[];
    recipientIds?: string[];
    progressCount?: number;
    failedCampaignIds?: string[];
  } = {}) => {
    const campaignById = new Map(
      campaigns.map((campaign) => [campaign.id, campaign]),
    );
    const tx = {
      notification: {
        createMany: jest
          .fn()
          .mockImplementation(({ data }: { data: unknown[] }) =>
            Promise.resolve({ count: data.length }),
          ),
        findMany: jest.fn().mockResolvedValue([]),
      },
      notificationCampaign: {
        updateMany: jest.fn().mockResolvedValue({ count: progressCount }),
      },
    };
    const prisma = {
      notificationCampaign: {
        findMany: jest.fn().mockResolvedValue(campaigns),
        findUnique: jest
          .fn()
          .mockImplementation(async ({ where }: { where: { id: string } }) => {
            if (failedCampaignIds.includes(where.id)) {
              throw new Error("simulated campaign failure");
            }
            return campaignById.get(where.id) ?? null;
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        findMany: jest
          .fn()
          .mockImplementation(
            async ({
              where,
              take,
            }: {
              where: { id: { gt: string } };
              take: number;
            }) =>
              recipientIds
                .filter((id) => id > where.id.gt)
                .slice(0, take)
                .map((id) => ({ id })),
          ),
      },
      notificationCampaignRecipient: {
        findMany: jest
          .fn()
          .mockImplementation(
            async ({
              where,
              take,
            }: {
              where: { userId: { gt: string } };
              take: number;
            }) =>
              recipientIds
                .filter((id) => id > where.userId.gt)
                .slice(0, take)
                .map((userId) => ({ userId })),
          ),
      },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const redis = {
      setNx: jest.fn().mockResolvedValue(true),
      compareAndDelete: jest.fn().mockResolvedValue(true),
    };
    const notifications = {
      syncCampaignNotifications: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NotificationCampaignsService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      notifications as unknown as NotificationsService,
    );
    return { service, prisma, redis, notifications, tx };
  };

  it.each([
    [NotificationTargetType.ALL, "userId"],
    [NotificationTargetType.SPECIFIC, "recipientUserId"],
  ] as const)("advances the %s recipient cursor", async (targetType, mode) => {
    const { service, prisma, tx } = setup({
      campaigns: [makeCampaign(campaignId, targetType)],
    });

    await service.dispatchScheduledCampaigns();

    if (mode === "userId") {
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { gt: cursor }, isActive: true, deletedAt: null },
        orderBy: { id: "asc" },
        take: 500,
        select: { id: true },
      });
    } else {
      expect(
        prisma.notificationCampaignRecipient.findMany,
      ).toHaveBeenCalledWith({
        where: {
          campaignId,
          userId: { gt: cursor },
          user: { isActive: true, deletedAt: null },
        },
        orderBy: { userId: "asc" },
        take: 500,
        select: { userId: true },
      });
    }
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [nextRecipientId, lastRecipientId].map((userId) => ({
        campaignId,
        userId,
        category: NotificationType.SYSTEM,
        title: "Maintenance",
        message: "Scheduled maintenance",
        actionUrl: null,
      })),
      skipDuplicates: true,
    });
    expect(tx.notificationCampaign.updateMany).toHaveBeenCalledWith({
      where: { id: campaignId, status: NotificationCampaignStatus.PROCESSING },
      data: {
        sentCount: { increment: 2 },
        lastProcessedUserId: lastRecipientId,
      },
    });
  });

  it("resumes a PROCESSING campaign after its persisted cursor", async () => {
    const { service, prisma, tx } = setup({
      campaigns: [
        makeCampaign(campaignId, NotificationTargetType.ALL, nextRecipientId),
      ],
      recipientIds: [cursor, nextRecipientId, lastRecipientId],
    });

    await service.dispatchScheduledCampaigns();

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: { gt: nextRecipientId },
        isActive: true,
        deletedAt: null,
      },
      orderBy: { id: "asc" },
      take: 500,
      select: { id: true },
    });
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [lastRecipientId].map((userId) => ({
        campaignId,
        userId,
        category: NotificationType.SYSTEM,
        title: "Maintenance",
        message: "Scheduled maintenance",
        actionUrl: null,
      })),
      skipDuplicates: true,
    });
    expect(tx.notificationCampaign.updateMany).toHaveBeenCalledWith({
      where: { id: campaignId, status: NotificationCampaignStatus.PROCESSING },
      data: {
        sentCount: { increment: 1 },
        lastProcessedUserId: lastRecipientId,
      },
    });
  });

  it("continues processing later campaigns after one campaign fails", async () => {
    const { service, prisma, tx } = setup({
      campaigns: [
        makeCampaign(failedCampaignId),
        makeCampaign(secondCampaignId),
      ],
      failedCampaignIds: [failedCampaignId],
      recipientIds: [nextRecipientId],
    });

    await service.dispatchScheduledCampaigns();

    expect(prisma.notificationCampaign.updateMany).toHaveBeenCalledWith({
      where: {
        id: failedCampaignId,
        status: NotificationCampaignStatus.PROCESSING,
      },
      data: {
        status: NotificationCampaignStatus.FAILED,
        failureReason: "simulated campaign failure",
        processingStartedAt: null,
      },
    });
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [nextRecipientId].map((userId) => ({
        campaignId: secondCampaignId,
        userId,
        category: NotificationType.SYSTEM,
        title: "Maintenance",
        message: "Scheduled maintenance",
        actionUrl: null,
      })),
      skipDuplicates: true,
    });
  });

  it("does not commit chunk progress when cancellation wins the race", async () => {
    const { service, notifications, tx } = setup({ progressCount: 0 });

    await service.dispatchScheduledCampaigns();

    expect(tx.notificationCampaign.updateMany).toHaveBeenCalledWith({
      where: { id: campaignId, status: NotificationCampaignStatus.PROCESSING },
      data: {
        sentCount: { increment: 2 },
        lastProcessedUserId: lastRecipientId,
      },
    });
    expect(notifications.syncCampaignNotifications).not.toHaveBeenCalled();
  });
});
