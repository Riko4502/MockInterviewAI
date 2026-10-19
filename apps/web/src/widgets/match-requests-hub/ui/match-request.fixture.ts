import type {
  MatchRequestResponseDto,
  MatchRequestResponseDtoTargetCard,
} from "@packages/api";

const ISO = "2026-01-01T00:00:00.000Z";

function participant(id: string, name: string) {
  return {
    id,
    displayName: name,
    username: id,
    avatarUrl: null,
    telegramUsername: null,
    gitUrl: null,
  };
}

function buildCard(
  id: string,
  ownerId: string,
  ownerName: string,
): MatchRequestResponseDtoTargetCard {
  return {
    id,
    userId: ownerId,
    user: participant(ownerId, ownerName),
    title: "Frontend Developer",
    specialization: "FRONTEND",
    level: "MIDDLE",
    language: "RU",
    skills: ["React"],
    bio: null,
    scheduleInfo: null,
    slots: [],
    isUrgent: false,
    status: "ACTIVE",
    autoRenew: false,
    bumpedAt: ISO,
    expiresAt: ISO,
    createdAt: ISO,
    updatedAt: ISO,
  };
}

/** Фабрика заявки для тестов центра заявок. */
export function createMatchRequest(
  overrides: Partial<MatchRequestResponseDto> = {},
): MatchRequestResponseDto {
  return {
    id: "req-1",
    senderId: "sender-1",
    receiverId: "receiver-1",
    sender: participant("sender-1", "Sender One"),
    receiver: participant("receiver-1", "Receiver One"),
    targetCard: buildCard("target-card", "receiver-1", "Receiver One"),
    senderCard: null,
    slot: null,
    sessionId: null,
    sessionStatus: null,
    status: "PENDING",
    message: null,
    preferredTopic: null,
    rejectReason: null,
    createdAt: ISO,
    updatedAt: ISO,
    expiresAt: ISO,
    ...overrides,
  };
}
