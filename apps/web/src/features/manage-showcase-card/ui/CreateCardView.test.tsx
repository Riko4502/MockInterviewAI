import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { CreateCardView } from "./CreateCardView";

const mockCreateCard = vi.fn();
const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  usePathname: () => "/dashboard/partners/new",
}));

vi.mock("../model/use-showcase-mutations", () => ({
  useShowcaseMutations: () => ({
    createCard: mockCreateCard,
    isCreating: false,
  }),
}));

const mockCurrentUser = vi.fn();
vi.mock("@/entities/user", () => ({
  useCurrentUser: () => mockCurrentUser(),
  UserAvatar: ({ name }: { name: string }) => (
    <div data-testid="user-avatar">{name}</div>
  ),
}));

describe("CreateCardView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage("ru");
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("должен отображать skeleton во время загрузки профиля без предупреждения о неполном профиле", () => {
    mockCurrentUser.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<CreateCardView />);

    expect(screen.getByTestId("create-card-skeleton")).toBeInTheDocument();
    expect(
      screen.queryByText(
        /Для публикации анкеты необходимо указать имя и username в профиле/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("должен отображать предупреждение о неполном профиле", () => {
    mockCurrentUser.mockReturnValue({
      data: {
        id: "u-1",
        displayName: "",
        username: null,
      },
      isLoading: false,
    });

    render(<CreateCardView />);

    expect(
      screen.getByText(
        /Для публикации анкеты необходимо указать имя и username в профиле/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Заполнить профиль/i }),
    ).toBeInTheDocument();
  });

  it("должен отображать страницу создания анкеты, поля формы и live preview", () => {
    mockCurrentUser.mockReturnValue({
      data: {
        id: "u-1",
        displayName: "Иван Петров",
        username: "ipetrov",
        avatarUrl: null,
      },
    });

    render(<CreateCardView />);

    expect(
      screen.getByRole("heading", {
        name: "Создание анкеты на витрине",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Специализация")).toBeInTheDocument();
    expect(screen.getByText("Уровень (грейд)")).toBeInTheDocument();
    expect(screen.getByText("Язык собеседования")).toBeInTheDocument();
    expect(screen.getByText("Ключевые навыки и стек")).toBeInTheDocument();
    expect(screen.getByText("Предпросмотр на витрине")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Опубликовать анкету/i }),
    ).toBeInTheDocument();
  });
});
