import {
  type NotificationCampaignDetailsDto,
  NotificationCampaignDtoCategory,
  NotificationCampaignDtoStatus,
  NotificationCampaignDtoTargetType,
} from "@packages/api";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCampaignFormHydration } from "./useCampaignFormHydration";

describe("useCampaignFormHydration", () => {
  const mockCampaign: NotificationCampaignDetailsDto = {
    id: "campaign-123",
    title: "Test Title",
    message: "Test Message",
    category: NotificationCampaignDtoCategory.SYSTEM,
    targetType: NotificationCampaignDtoTargetType.SPECIFIC,
    actionUrl: "https://example.com",
    status: NotificationCampaignDtoStatus.DRAFT,
    totalRecipients: 1,
    sentCount: 0,
    scheduledAt: "2026-05-01T12:00:00.000Z",
    sentAt: null,
    completedAt: null,
    failureReason: null,
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z",
    cancelledAt: null,
    cancellationReason: null,
    cancelledById: null,
    creator: null,
    recipientUserIds: ["user-1"],
    readCount: 0,
    lastProcessedUserId: null,
    createdById: null,
  };

  it("hydrates form on first load, but ignores background refetches with the same campaign id", async () => {
    const setState = vi.fn();
    const resolveRecipientIds = vi.fn().mockResolvedValue({
      users: [{ id: "user-1", email: "u1@test.com" }],
      unresolved: [],
    });

    const { rerender } = renderHook(
      ({ campaign, open }) =>
        useCampaignFormHydration({
          open,
          mode: "edit",
          campaign,
          resolveRecipientIds,
          setState,
        }),
      {
        initialProps: {
          campaign: mockCampaign,
          open: true,
        },
      },
    );

    expect(setState).toHaveBeenCalledTimes(1);
    expect(resolveRecipientIds).toHaveBeenCalledTimes(1);

    // Simulate background refetch by TanStack query returning a new object reference with identical ID
    const refetchedCampaign = {
      ...mockCampaign,
      updatedAt: "2026-05-01T10:05:00.000Z",
    };
    rerender({
      campaign: refetchedCampaign,
      open: true,
    });

    // Should NOT re-hydrate or call resolveRecipientIds again
    expect(setState).toHaveBeenCalledTimes(1);
    expect(resolveRecipientIds).toHaveBeenCalledTimes(1);
  });

  it("resets ref on dialog close and re-hydrates upon reopen", async () => {
    const setState = vi.fn();
    const resolveRecipientIds = vi.fn().mockResolvedValue({
      users: [{ id: "user-1", email: "u1@test.com" }],
      unresolved: [],
    });

    const { rerender } = renderHook(
      ({ campaign, open }) =>
        useCampaignFormHydration({
          open,
          mode: "edit",
          campaign,
          resolveRecipientIds,
          setState,
        }),
      {
        initialProps: {
          campaign: mockCampaign,
          open: true,
        },
      },
    );

    expect(setState).toHaveBeenCalledTimes(1);

    // Close dialog
    rerender({
      campaign: mockCampaign,
      open: false,
    });

    // Reopen dialog
    rerender({
      campaign: mockCampaign,
      open: true,
    });

    expect(setState).toHaveBeenCalledTimes(2);
    expect(resolveRecipientIds).toHaveBeenCalledTimes(2);
  });
});
