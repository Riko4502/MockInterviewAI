import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { CreateCardDialog } from "./CreateCardDialog";

const mockCreateCard = vi.fn();

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

describe("CreateCardDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage("ru");
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("должен отображать skeleton во время загрузки профиля в открытом диалоге", () => {
    mockCurrentUser.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<CreateCardDialog open={true} onOpenChange={vi.fn()} />);

    expect(
      screen.getByTestId("create-card-dialog-skeleton"),
    ).toBeInTheDocument();
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

    render(<CreateCardDialog open={true} onOpenChange={vi.fn()} />);

    expect(
      screen.getByText(
        /Для публикации анкеты необходимо указать имя и username в профиле/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Заполнить профиль/i }),
    ).toBeInTheDocument();
  });

  it("должен отображать форму, live preview и кнопку отправки", () => {
    mockCurrentUser.mockReturnValue({
      data: {
        id: "u-1",
        displayName: "Иван Петров",
        username: "ipetrov",
        avatarUrl: null,
      },
      isLoading: false,
    });

    render(<CreateCardDialog open={true} onOpenChange={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        name: "Создание анкеты на витрине",
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

  it("должен открываться по клику на триггер", async () => {
    mockCurrentUser.mockReturnValue({
      data: {
        id: "u-1",
        displayName: "Иван Петров",
        username: "ipetrov",
        avatarUrl: null,
      },
      isLoading: false,
    });

    const user = userEvent.setup();
    render(
      <CreateCardDialog
        trigger={<button type="button">Открыть диалог</button>}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: "Создание анкеты на витрине" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByText("Открыть диалог"));

    expect(
      screen.getByRole("heading", { name: "Создание анкеты на витрине" }),
    ).toBeInTheDocument();
  });
});
