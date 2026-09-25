import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateProfileForm } from "./UpdateProfileForm";

const mutateMock = vi.fn();
const toastPushMock = vi.fn();

vi.mock("@packages/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/ui")>();
  return {
    ...actual,
    useToast: () => ({
      push: toastPushMock,
    }),
  };
});

vi.mock("@/entities/user", () => ({
  useCurrentUser: () => ({
    data: {
      id: "11111111-1111-1111-1111-111111111111",
      email: "dev@example.com",
      displayName: "Иван",
      username: "ivan",
      avatarUrl: null,
      telegramUsername: null,
      gitUrl: null,
      theme: "dark",
      locale: "ru",
    },
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
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
  useUploadAvatar: () => ({
    mutate: vi.fn(),
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
  });

  it("заполняет форму текущим профилем и отправляет изменения", async () => {
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
            username: "ivan",
            telegramUsername: null,
            gitUrl: null,
            theme: "dark",
            locale: "ru",
          },
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });

    // Проверяем вызов toast при onSuccess
    const lastCall = mutateMock.mock.calls[0];
    const options = lastCall[1];
    options.onSuccess();
    expect(toastPushMock).toHaveBeenCalledWith({
      status: "success",
      title: "Профиль сохранён.",
    });
  });
});
