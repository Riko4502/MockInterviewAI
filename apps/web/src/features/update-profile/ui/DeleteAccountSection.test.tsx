import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import { DeleteAccountSection } from "./DeleteAccountSection";

const {
  deleteMutateMock,
  deleteMutationState,
  toastPushMock,
  clearSessionMock,
  replaceMock,
} = vi.hoisted(() => ({
  deleteMutateMock: vi.fn(),
  deleteMutationState: {
    isPending: false,
  },
  toastPushMock: vi.fn(),
  clearSessionMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("@packages/api", () => ({
  useProfileControllerDeleteMyProfile: () => ({
    mutate: deleteMutateMock,
    isPending: deleteMutationState.isPending,
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

vi.mock("@/entities/session", () => ({
  useSession: () => ({
    clearSession: clearSessionMock,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

describe("DeleteAccountSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteMutationState.isPending = false;
  });

  const renderSection = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <DeleteAccountSection />
      </QueryClientProvider>,
    );
  };

  it("рендерит секцию опасной зоны и кнопку удаления аккаунта", () => {
    renderSection();

    expect(
      screen.getByRole("button", { name: /удалить аккаунт|delete account/i }),
    ).toBeInTheDocument();
  });

  it("открывает диалог подтверждения при клике на кнопку удаления", async () => {
    const user = userEvent.setup();
    renderSection();

    const deleteBtn = screen.getByRole("button", {
      name: /удалить аккаунт|delete account/i,
    });
    await user.click(deleteBtn);

    expect(
      screen.getByRole("heading", {
        name: /удалить аккаунт\?|delete account\?/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /да, деактивировать аккаунт|yes, deactivate account/i,
      }),
    ).toBeInTheDocument();
  });

  it("закрывает диалог при клике на кнопку отмены", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(
      screen.getByRole("button", { name: /удалить аккаунт|delete account/i }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /отмена|cancel/i });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("вызывает мутацию удаления и очищает сессию при подтверждении", async () => {
    const user = userEvent.setup();
    deleteMutateMock.mockImplementation(
      (_args: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );

    renderSection();

    await user.click(
      screen.getByRole("button", { name: /удалить аккаунт|delete account/i }),
    );
    const confirmBtn = screen.getByRole("button", {
      name: /да, деактивировать аккаунт|yes, deactivate account/i,
    });
    await user.click(confirmBtn);

    expect(deleteMutateMock).toHaveBeenCalledTimes(1);
    expect(clearSessionMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(paths.login);
    expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
      }),
    );
  });

  it("показывает тост с ошибкой при сбое мутации", async () => {
    const user = userEvent.setup();
    deleteMutateMock.mockImplementation(
      (_args: unknown, options?: { onError?: () => void }) => {
        options?.onError?.();
      },
    );

    renderSection();

    await user.click(
      screen.getByRole("button", { name: /удалить аккаунт|delete account/i }),
    );
    const confirmBtn = screen.getByRole("button", {
      name: /да, деактивировать аккаунт|yes, deactivate account/i,
    });
    await user.click(confirmBtn);

    expect(deleteMutateMock).toHaveBeenCalledTimes(1);
    expect(clearSessionMock).not.toHaveBeenCalled();
    expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
      }),
    );
  });
});
