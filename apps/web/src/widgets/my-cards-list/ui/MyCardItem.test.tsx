import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShowcaseCardResponseDto } from "@/entities/showcase-card";
import { paths } from "@/shared/config";
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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  bumpedAt: new Date().toISOString(),
  expiresAt: new Date().toISOString(),
  slots: [],
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

  afterEach(() => {
    vi.useRealTimers();
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

  it("показывает 0/0 при отсутствии слотов", () => {
    render(<MyCardItem card={mockCard} onDelete={vi.fn()} />);

    expect(screen.getByText("Свободно: 0")).toBeInTheDocument();
    expect(screen.getByText("Забронировано: 0")).toBeInTheDocument();
  });

  it("считает только будущие OPEN и все BOOKED, ведёт к редактированию", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const cardWithSlots: ShowcaseCardResponseDto = {
      ...mockCard,
      slots: [
        // Будущий OPEN → свободен
        {
          id: "slot-free",
          startsAt: "2026-01-02T10:00:00.000Z",
          durationMinutes: 60,
          status: "OPEN",
        },
        // Прошедший OPEN → не свободен
        {
          id: "slot-past",
          startsAt: "2025-12-31T10:00:00.000Z",
          durationMinutes: 60,
          status: "OPEN",
        },
        // BOOKED → считается всегда
        {
          id: "slot-booked",
          startsAt: "2026-01-03T10:00:00.000Z",
          durationMinutes: 60,
          status: "BOOKED",
        },
        // CANCELLED → не считается
        {
          id: "slot-cancelled",
          startsAt: "2026-01-04T10:00:00.000Z",
          durationMinutes: 60,
          status: "CANCELLED",
        },
      ],
    };

    render(<MyCardItem card={cardWithSlots} onDelete={vi.fn()} />);

    expect(screen.getByText("Свободно: 1")).toBeInTheDocument();
    expect(screen.getByText("Забронировано: 1")).toBeInTheDocument();

    const editLink = screen.getByRole("link", { name: /Свободно: 1/ });
    expect(editLink).toHaveAttribute("href", paths.partnersEdit("card-1"));
  });
});
