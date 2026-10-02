import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import type { ShowcaseCardResponseDto } from "../model/types";
import { ShowcaseCard } from "./ShowcaseCard";

const mockCard: ShowcaseCardResponseDto = {
  id: "card-123",
  userId: "user-456",
  user: {
    id: "user-456",
    displayName: "Алексей Смирнов",
    username: "asmirnov",
    avatarUrl: null,
    telegramUsername: null,
    gitUrl: null,
  },
  title: "Подготовка к System Design & Live Coding",
  specialization: "FRONTEND",
  level: "SENIOR",
  language: "RU",
  skills: ["React", "TypeScript", "Next.js", "Zustand", "TailwindCSS"],
  bio: "Хочу потренировать решение задач на архитектуру фронтенда и мок-интервью.",
  scheduleInfo: "Будни после 19:00 МСК",
  isUrgent: true,
  status: "ACTIVE",
  autoRenew: false,
  bumpedAt: new Date("2026-09-30T10:00:00Z"),
  expiresAt: new Date("2026-10-15T10:00:00Z"),
  createdAt: new Date("2026-09-30T10:00:00Z"),
  updatedAt: new Date("2026-09-30T10:00:00Z"),
  stats: {
    pendingRequestsCount: 3,
    acceptedRequestsCount: 1,
  },
};

describe("ShowcaseCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage("ru");
  });

  it("должен отображать основные данные кандидата и навыки", () => {
    render(<ShowcaseCard card={mockCard} />);

    expect(screen.getByText("Алексей Смирнов")).toBeInTheDocument();
    expect(screen.getByText("@asmirnov")).toBeInTheDocument();
    expect(
      screen.getByText("Подготовка к System Design & Live Coding"),
    ).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(
      screen.getByText(/Хочу потренировать решение задач/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Будни после 19:00 МСК")).toBeInTheDocument();
  });

  it("должен отображать дефолтный заголовок, если кастомный не указан", () => {
    const cardWithoutTitle: ShowcaseCardResponseDto = {
      ...mockCard,
      title: null,
    };

    render(<ShowcaseCard card={cardWithoutTitle} />);
    expect(screen.getByText(/Senior Frontend/i)).toBeInTheDocument();
  });

  it("должен отображать бейдж срочности при isUrgent = true", () => {
    render(<ShowcaseCard card={mockCard} />);
    expect(screen.getByText(/Готов сегодня/i)).toBeInTheDocument();
  });

  it("должен отображать статус 'Скрыта' для неактивной карточки", () => {
    const inactiveCard: ShowcaseCardResponseDto = {
      ...mockCard,
      status: "INACTIVE",
    };

    render(<ShowcaseCard card={inactiveCard} />);
    expect(screen.getByText(/Скрыта/i)).toBeInTheDocument();
  });

  it("должен отображать кнопку 'Управлять' для владельца и вызывать onManage", () => {
    const handleManage = vi.fn();
    render(
      <ShowcaseCard card={mockCard} isOwner={true} onManage={handleManage} />,
    );

    const manageBtn = screen.getByRole("button", { name: /Управлять/i });
    expect(manageBtn).toBeInTheDocument();
    fireEvent.click(manageBtn);
    expect(handleManage).toHaveBeenCalledWith(mockCard);
  });

  it("должен отображать кнопку 'Предложить интервью' для гостя и вызывать onRespond", () => {
    const handleRespond = vi.fn();
    render(
      <ShowcaseCard
        card={mockCard}
        isOwner={false}
        onRespond={handleRespond}
      />,
    );

    const respondBtn = screen.getByRole("button", {
      name: /Предложить интервью/i,
    });
    expect(respondBtn).toBeInTheDocument();
    fireEvent.click(respondBtn);
    expect(handleRespond).toHaveBeenCalledWith(mockCard);
  });
});
