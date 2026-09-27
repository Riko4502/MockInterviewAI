import { NotFoundException } from "@nestjs/common";
import { InterviewSessionStatus } from "@packages/dto";
import type { PrismaService } from "../../prisma/prisma.service";
import { DashboardReadinessService } from "./dashboard-readiness.service";

describe("DashboardReadinessService", () => {
  let service: DashboardReadinessService;
  let prismaMock: {
    user: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
      },
    };
    service = new DashboardReadinessService(
      prismaMock as unknown as PrismaService,
    );
  });

  it("should throw NotFoundException if user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(service.getReadiness("non-existent-id")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should return EMAIL_PROVIDED step with true when email is present", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      deviceSettings: [],
      telegramLinkVerified: false,
      telegramId: null,
      telegramUsername: null,
      showcaseCards: [],
      sessions: [],
      participations: [],
    });

    const result = await service.getReadiness("user-1");

    const emailStep = result.steps.find((s) => s.key === "EMAIL_PROVIDED");
    expect(emailStep).toBeDefined();
    expect(emailStep?.title).toBe("Указать адрес электронной почты");
    expect(emailStep?.isCompleted).toBe(true);
    expect(result.totalPercentage).toBe(20);
    expect(result.isFullyReady).toBe(false);
  });

  it("should return EMAIL_PROVIDED step with false when email is empty", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "",
      deviceSettings: [],
      telegramLinkVerified: false,
      telegramId: null,
      telegramUsername: null,
      showcaseCards: [],
      sessions: [],
      participations: [],
    });

    const result = await service.getReadiness("user-1");

    const emailStep = result.steps.find((s) => s.key === "EMAIL_PROVIDED");
    expect(emailStep).toBeDefined();
    expect(emailStep?.isCompleted).toBe(false);
    expect(result.totalPercentage).toBe(0);
    expect(result.isFullyReady).toBe(false);
  });

  it("should return 100% and isFullyReady=true when all readiness conditions are met", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      deviceSettings: [
        {
          preferredAudioInputLabel: "Default Mic",
          preferredVideoInputLabel: null,
        },
      ],
      telegramLinkVerified: true,
      telegramId: BigInt(123456789),
      telegramUsername: "testuser",
      showcaseCards: [{ id: "card-1", status: "ACTIVE" }],
      sessions: [{ id: "session-1" }],
      participations: [],
    });

    const result = await service.getReadiness("user-1");

    expect(result.totalPercentage).toBe(100);
    expect(result.isFullyReady).toBe(true);
    expect(result.steps.every((s) => s.isCompleted)).toBe(true);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      include: {
        deviceSettings: { take: 1 },
        showcaseCards: { select: { id: true, status: true }, take: 1 },
        sessions: {
          where: { status: InterviewSessionStatus.CLOSED },
          select: { id: true },
          take: 1,
        },
        participations: {
          where: { session: { status: InterviewSessionStatus.CLOSED } },
          select: { sessionId: true },
          take: 1,
        },
      },
    });
  });
});
