import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
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

  it("должен показывать предупреждение, если профиль не заполнен", () => {
    mockCurrentUser.mockReturnValue({
      data: {
        id: "u-1",
        displayName: "",
        username: null,
      },
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

  it("должен отображать поля формы и предпросмотр, если профиль заполнен", () => {
    mockCurrentUser.mockReturnValue({
      data: {
        id: "u-1",
        displayName: "Иван Петров",
        username: "ipetrov",
        avatarUrl: null,
      },
    });

    render(<CreateCardDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Создание анкеты на витрине")).toBeInTheDocument();
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
