import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShowcaseCardResponseDto } from "@/entities/showcase-card";
import { MyCardItem } from "./MyCardItem";

const mockToggleStatus = vi.fn();
const mockRenewCard = vi.fn();

vi.mock("@/features/manage-showcase-card", () => ({
  BumpCardButton: () => <button type="button">Поднять в топ</button>,
  useShowcaseMutations: () => ({
    toggleStatus: mockToggleStatus,
    renewCard: mockRenewCard,
    isTogglingStatus: false,
    isRenewing: false,
  }),
}));

const mockCard: ShowcaseCardResponseDto = {
  id: "card-1",
  userId: "user-1",
  specialization: "FRONTEND",
  level: "MIDDLE",
  language: "RU",
  skills: ["React", "TypeScript"],
  title: "Frontend Developer",
  bio: "Looking for practice",
  scheduleInfo: "Evenings",
  isUrgent: false,
  autoRenew: false,
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date(),
  bumpedAt: new Date(),
  expiresAt: new Date(),
  user: {
    id: "user-1",
    displayName: "User One",
    username: "user1",
    avatarUrl: null,
    telegramUsername: null,
    gitUrl: null,
  },
};

describe("MyCardItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("отображает обычные кнопки управления для активной карточки", () => {
    render(<MyCardItem card={mockCard} onDelete={vi.fn()} />);

    expect(screen.getByText("Поднять в топ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скрыть" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Продлить на 15 дней" }),
    ).not.toBeInTheDocument();
  });

  it("отображает кнопку ручного продления для истёкшей карточки", () => {
    const expiredCard: ShowcaseCardResponseDto = {
      ...mockCard,
      status: "EXPIRED",
    };

    render(<MyCardItem card={expiredCard} onDelete={vi.fn()} />);

    const renewButton = screen.getByRole("button", {
      name: /Продлить на 15 дней/i,
    });
    expect(renewButton).toBeInTheDocument();
    expect(screen.queryByText("Поднять в топ")).not.toBeInTheDocument();

    fireEvent.click(renewButton);
    expect(mockRenewCard).toHaveBeenCalledWith("card-1");
  });
});
