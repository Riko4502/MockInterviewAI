import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateProfileForm } from "./UpdateProfileForm";

const { mutateMock, profileMutation } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  profileMutation: {
    isPending: false,
    isError: false,
    isSuccess: false,
  },
}));

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
    profileMutation.isPending = false;
    profileMutation.isError = false;
    profileMutation.isSuccess = false;
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
          },
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });
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
  });
});
