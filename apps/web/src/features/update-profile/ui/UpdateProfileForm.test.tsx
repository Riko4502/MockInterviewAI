import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateProfileForm } from "./UpdateProfileForm";

const { mutateMock, profileMutation, toastPushMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  toastPushMock: vi.fn(),
  profileMutation: {
    isPending: false,
    isError: false,
    isSuccess: false,
  },
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

const initialUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "dev@example.com",
  displayName: "Иван",
  username: "ivan",
  avatarUrl: null as string | null,
  telegramUsername: null as string | null,
  gitUrl: null as string | null,
  theme: "dark" as "dark" | "light" | "system",
  locale: "ru" as "ru" | "en",
};

let mockUserData = { ...initialUser };

vi.mock("@/entities/user", () => ({
  useCurrentUser: () => ({
    data: mockUserData,
    isLoading: false,
    isError: false,
  }),
  UserAvatar: ({ name }: { name?: string | null }) => (
    <div>{name ?? "avatar"}</div>
  ),
}));

vi.mock("../model/use-profile-mutations", () => ({
  useUpdateProfile: () => ({
    mutate: mutateMock,
    isPending: profileMutation.isPending,
    isError: profileMutation.isError,
    isSuccess: profileMutation.isSuccess,
  }),
  useUploadAvatar: () => ({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
  }),
}));

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UpdateProfileForm />
    </QueryClientProvider>,
  );
}

describe("UpdateProfileForm", () => {
  beforeEach(() => {
    mutateMock.mockClear();
    toastPushMock.mockClear();
    profileMutation.isPending = false;
    profileMutation.isError = false;
    profileMutation.isSuccess = false;
    mockUserData = { ...initialUser };
  });

  it("заполняет форму текущим профилем и отправляет только измененные поля", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(
      screen.getByRole("heading", { name: "Профиль" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("dev@example.com")).toBeDisabled();
    expect(screen.getByDisplayValue("Иван")).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue("Иван");
    await user.clear(nameInput);
    await user.type(nameInput, "Иван Петров");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        {
          data: {
            displayName: "Иван Петров",
          },
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });

    const options = mutateMock.mock.calls[0]?.[1] as {
      onSuccess: (profile: typeof initialUser) => void;
    };
    act(() => {
      options.onSuccess({
        ...mockUserData,
        displayName: "Иван Петров",
      });
    });
    expect(toastPushMock).toHaveBeenCalledWith({
      status: "success",
      title: "Профиль сохранён.",
    });
  });

  it("после сохранения показывает значения сервера и снова блокирует кнопку", async () => {
    const user = userEvent.setup();
    renderForm();

    const nameInput = screen.getByDisplayValue("Иван");
    await user.clear(nameInput);
    await user.type(nameInput, "  Иван Петров  ");
    const usernameInput = screen.getByDisplayValue("ivan");
    await user.clear(usernameInput);
    await user.type(usernameInput, "IVAN");
    await user.type(screen.getByPlaceholderText("@username"), "@ivan_dev");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalled();
    });

    const onSuccess = mutateMock.mock.calls[0]?.[1]?.onSuccess as (profile: {
      displayName: string | null;
      username: string | null;
      telegramUsername: string | null;
      gitUrl: string | null;
      theme: "dark";
      locale: "ru";
    }) => void;

    act(() => {
      onSuccess({
        displayName: "Иван Петров",
        username: "ivan",
        telegramUsername: "ivan_dev",
        gitUrl: null,
        theme: "dark",
        locale: "ru",
      });
    });

    expect(screen.getByRole("textbox", { name: "Имя" })).toHaveValue(
      "Иван Петров",
    );
    expect(
      screen.getByRole("textbox", { name: "Имя пользователя" }),
    ).toHaveValue("ivan");
    expect(screen.getByRole("textbox", { name: "Telegram" })).toHaveValue(
      "ivan_dev",
    );
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  });

  it("синхронизирует значения формы при обновлении профиля и не отправляет устаревшие предпочтения", async () => {
    const user = userEvent.setup();
    const { rerender } = renderForm();

    mockUserData = {
      ...mockUserData,
      theme: "light",
      locale: "en",
    };
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <UpdateProfileForm />
      </QueryClientProvider>,
    );

    const nameInput = screen.getByDisplayValue("Иван");
    await user.clear(nameInput);
    await user.type(nameInput, "Иван Сидоров");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        {
          data: {
            displayName: "Иван Сидоров",
          },
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });
  });

  it("не отправляет запрос, если ни одно поле не было изменено", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("блокирует сохранение, пока поля не изменились", async () => {
    const user = userEvent.setup();
    renderForm();

    const saveButton = screen.getByRole("button", { name: "Сохранить" });
    expect(saveButton).toBeDisabled();

    const nameInput = screen.getByDisplayValue("Иван");
    await user.type(nameInput, "а");
    expect(saveButton).toBeEnabled();

    await user.type(nameInput, "{backspace}");
    expect(saveButton).toBeDisabled();
  });

  it("показывает лоадер на кнопке сохранения во время обновления", () => {
    profileMutation.isPending = true;
    renderForm();

    const saveButton = screen.getByRole("button", { name: "Сохранение..." });
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Иван")).toBeDisabled();
    expect(screen.getByDisplayValue("ivan")).toBeDisabled();
  });
});
