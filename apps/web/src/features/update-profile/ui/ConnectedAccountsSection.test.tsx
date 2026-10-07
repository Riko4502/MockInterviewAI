import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/shared/lib/i18n";
import type { UserProfileDto } from "@packages/api";
import { ConnectedAccountsSection } from "./ConnectedAccountsSection";

const { updateProfileMutateMock, linkTelegramMutateMock, toastPushMock } =
  vi.hoisted(() => ({
    updateProfileMutateMock: vi.fn(),
    linkTelegramMutateMock: vi.fn(),
    toastPushMock: vi.fn(),
  }));

vi.mock("@packages/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/api")>();
  return {
    ...actual,
    useAuthControllerTelegramLink: () => ({
      mutate: linkTelegramMutateMock,
      isPending: false,
    }),
    useAuthControllerOauthProviders: () => ({
      data: { github: true },
      isError: false,
    }),
  };
});

vi.mock("../model/use-profile-mutations", () => ({
  useUpdateProfile: () => ({
    mutate: updateProfileMutateMock,
    isPending: false,
  }),
}));

vi.mock("@packages/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/ui")>();
  return {
    ...actual,
    useToast: () => ({
      push: toastPushMock,
    }),
  };
});

const baseUser: UserProfileDto = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "dev@example.com",
  displayName: "Иван",
  username: "ivan",
  avatarUrl: null,
  telegramUsername: null,
  telegramLinkVerified: false,
  gitUrl: null,
  githubLinkVerified: false,
  theme: "dark",
  locale: "ru",
  role: "USER",
  permissions: "0",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ConnectedAccountsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSection = (user = baseUser) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <ConnectedAccountsSection user={user} />
      </QueryClientProvider>,
    );
  };

  it("отображает статус неподключенных аккаунтов и кнопки привязки", () => {
    renderSection();

    expect(screen.getByText("Telegram")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /привязать telegram/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /подключить github/i }),
    ).toBeInTheDocument();
  });

  it("отображает подключенные аккаунты со статусом и кнопками отвязки", () => {
    const connectedUser: UserProfileDto = {
      ...baseUser,
      telegramUsername: "testuser",
      telegramLinkVerified: true,
      gitUrl: "https://github.com/testuser",
      githubLinkVerified: true,
    };

    renderSection(connectedUser);

    expect(screen.getByText("@testuser")).toBeInTheDocument();
    expect(screen.getByText("https://github.com/testuser")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /отвязать/i })).toHaveLength(
      2,
    );
  });

  it("не считает Telegram подключенным, если telegramLinkVerified равен false, даже при наличии telegramUsername", () => {
    const unverifiedUser: UserProfileDto = {
      ...baseUser,
      telegramUsername: "unverified_tg",
      telegramLinkVerified: false,
    };

    renderSection(unverifiedUser);

    expect(
      screen.getByRole("button", { name: /привязать telegram/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/отвязать/i)).not.toBeInTheDocument();
  });

  it("не считает GitHub подключенным, если githubLinkVerified равен false, даже при наличии gitUrl", () => {
    const unverifiedUser: UserProfileDto = {
      ...baseUser,
      gitUrl: "https://github.com/unverified_git",
      githubLinkVerified: false,
    };

    renderSection(unverifiedUser);

    expect(
      screen.queryByText("https://github.com/unverified_git"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /подключить github/i }),
    ).toBeInTheDocument();
  });

  it("вызывает отвязку Telegram при клике на соответствующую кнопку", async () => {
    const user = userEvent.setup();
    const connectedUser: UserProfileDto = {
      ...baseUser,
      telegramUsername: "testuser",
      telegramLinkVerified: true,
    };

    updateProfileMutateMock.mockImplementation(
      (_args: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );

    renderSection(connectedUser);

    const unlinkBtn = screen.getByRole("button", { name: /отвязать/i });
    await user.click(unlinkBtn);

    expect(updateProfileMutateMock).toHaveBeenCalledWith(
      { data: { telegramUsername: null } },
      expect.anything(),
    );
    expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success" }),
    );
  });

  it("вызывает отвязку GitHub при клике на соответствующую кнопку", async () => {
    const user = userEvent.setup();
    const connectedUser: UserProfileDto = {
      ...baseUser,
      gitUrl: "https://github.com/testuser",
      githubLinkVerified: true,
    };

    updateProfileMutateMock.mockImplementation(
      (_args: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );

    renderSection(connectedUser);

    const unlinkBtn = screen.getByRole("button", { name: /отвязать/i });
    await user.click(unlinkBtn);

    expect(updateProfileMutateMock).toHaveBeenCalledWith(
      { data: { gitUrl: null } },
      expect.anything(),
    );
    expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success" }),
    );
  });

  it("открывает модалку привязки Telegram при клике на кнопку привязки", async () => {
    const user = userEvent.setup();
    renderSection();

    const linkBtn = screen.getByRole("button", { name: /привязать telegram/i });
    await user.click(linkBtn);

    expect(
      screen.getByRole("heading", { name: /привязка telegram/i }),
    ).toBeInTheDocument();
  });

  it("содержит ссылку на авторизацию GitHub с параметром action=link", () => {
    renderSection();

    const link = screen.getByRole("link", { name: /подключить github/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/api/v1/auth/github?action=link"),
    );
  });

  it("показывает ошибку, если в URL передан error=github_already_linked", () => {
    window.history.pushState({}, "", "/profile?error=github_already_linked");

    renderSection();

    expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        title: "Этот аккаунт GitHub уже привязан к другому пользователю.",
      }),
    );

    window.history.pushState({}, "", "/profile");
  });

  it("показывает успех, если в URL передан github=success", () => {
    window.history.pushState({}, "", "/profile?github=success");

    renderSection();

    expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        title: "GitHub успешно привязан!",
      }),
    );

    window.history.pushState({}, "", "/profile");
  });
});
