import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { EditCardView } from "./EditCardView";

const mockUpdateCard = vi.fn();
const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  usePathname: () => "/dashboard/partners/card-1/edit",
}));

vi.mock("../model/use-showcase-mutations", () => ({
  useShowcaseMutations: () => ({
    updateCard: mockUpdateCard,
    isUpdating: false,
  }),
}));

const mockCurrentUser = vi.fn();
vi.mock("@/entities/user", () => ({
  useCurrentUser: () => mockCurrentUser(),
  useViewerTimezone: () => "Europe/Moscow",
  UserAvatar: ({ name }: { name: string }) => (
    <div data-testid="user-avatar">{name}</div>
  ),
}));

const mockShowcaseCard = vi.fn();
vi.mock("@/entities/showcase-card", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/entities/showcase-card")>();
  return {
    ...actual,
    useShowcaseCard: () => mockShowcaseCard(),
  };
});

describe("EditCardView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage("ru");
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    mockCurrentUser.mockReturnValue({
      data: {
        id: "u-1",
        displayName: "Иван Петров",
        username: "ipetrov",
        avatarUrl: null,
        timezone: "Europe/Moscow",
      },
    });
  });

  it("должен отображать состояние 'Анкета не найдена', если карточка отсутствует", () => {
    mockShowcaseCard.mockReturnValue({
      data: null,
      isLoading: false,
    });

    render(<EditCardView cardId="not-found-id" />);

    expect(screen.getByText("Анкета не найдена")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /К моим анкетам/i }),
    ).toBeInTheDocument();
  });

  it("должен отображать 'Анкета не найдена', если текущий пользователь не является владельцем", () => {
    mockShowcaseCard.mockReturnValue({
      data: {
        id: "card-1",
        userId: "another-user-id",
        specialization: "FRONTEND",
        level: "MIDDLE",
      },
      isLoading: false,
    });

    render(<EditCardView cardId="card-1" />);

    expect(screen.getByText("Анкета не найдена")).toBeInTheDocument();
  });

  it("должен отображать форму редактирования с заполненными данными анкеты", () => {
    mockShowcaseCard.mockReturnValue({
      data: {
        id: "card-1",
        userId: "u-1",
        specialization: "FRONTEND",
        level: "SENIOR",
        language: "RU",
        skills: ["React", "TypeScript"],
        title: "Senior Frontend Engineer",
        bio: "Готовлюсь к интервью",
        status: "ACTIVE",
        isUrgent: false,
        autoRenew: false,
        user: {
          id: "u-1",
          displayName: "Иван Петров",
          username: "ipetrov",
          avatarUrl: null,
        },
      },
      isLoading: false,
    });

    render(<EditCardView cardId="card-1" />);

    expect(
      screen.getByRole("heading", {
        name: "Редактирование анкеты",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Senior Frontend Engineer"),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Готовлюсь к интервью"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Сохранить изменения/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Специализацию нельзя изменить после создания анкеты"),
    ).toBeInTheDocument();
  });

  it("должен маппить UTC-слоты карточки в локальное время автора и сохранять BOOKED", () => {
    mockShowcaseCard.mockReturnValue({
      data: {
        id: "card-1",
        userId: "u-1",
        specialization: "FRONTEND",
        level: "MIDDLE",
        language: "RU",
        skills: ["React"],
        status: "ACTIVE",
        isUrgent: false,
        autoRenew: false,
        user: {
          id: "u-1",
          displayName: "Иван Петров",
          username: "ipetrov",
          avatarUrl: null,
        },
        slots: [
          {
            id: "s1",
            startsAt: "2999-01-01T07:00:00.000Z",
            durationMinutes: 60,
            status: "OPEN",
          },
          {
            id: "s2",
            startsAt: "2000-01-01T06:15:00.000Z",
            durationMinutes: 45,
            status: "OPEN",
          },
          {
            id: "s3",
            startsAt: "2999-02-01T07:30:00.000Z",
            durationMinutes: 30,
            status: "BOOKED",
          },
        ],
      },
      isLoading: false,
    });

    render(<EditCardView cardId="card-1" />);

    // Europe/Moscow = UTC+3: 07:00Z → 10:00, 07:30Z → 10:30
    expect(screen.getAllByText(/10:00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/10:30/).length).toBeGreaterThan(0);
    expect(screen.getByText("Забронирован")).toBeInTheDocument();
    // Прошедший открытый слот (06:15Z → 09:15) отфильтрован
    expect(screen.queryByText(/09:15/)).not.toBeInTheDocument();
  });

  it("должен перенаправлять на список анкет при нажатии кнопки 'Отмена'", () => {
    mockShowcaseCard.mockReturnValue({
      data: {
        id: "card-1",
        userId: "u-1",
        specialization: "FRONTEND",
        level: "MIDDLE",
        skills: ["React"],
      },
      isLoading: false,
    });

    render(<EditCardView cardId="card-1" />);

    const cancelButton = screen.getByRole("button", { name: /Отмена/i });
    fireEvent.click(cancelButton);

    expect(mockPush).toHaveBeenCalledWith("/dashboard/partners/my");
  });
});
