import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { ResetPasswordPageClient } from "./ResetPasswordPageClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@packages/ui", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@packages/ui");
  return { ...actual, useToast: () => ({ push: vi.fn() }) };
});

const mockResetPasswordForm = vi.fn();
vi.mock("./ResetPasswordForm", () => ({
  ResetPasswordForm: (props: { token: string }) => {
    mockResetPasswordForm(props);
    return (
      <div data-testid="reset-password-form">
        <button type="submit">Сохранить новый пароль</button>
      </div>
    );
  },
}));

vi.mock("@packages/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useAuthControllerResetPassword: () => ({
      mutate: vi.fn(),
      isSuccess: false,
      isPending: false,
      isError: false,
      error: null,
    }),
  };
});

function renderWithClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("ResetPasswordPageClient — чтение токена из URL-фрагмента", () => {
  const replaceStateSpy = vi.spyOn(history, "replaceState");

  beforeEach(async () => {
    replaceStateSpy.mockClear();
    mockResetPasswordForm.mockClear();
    await i18n.changeLanguage("ru");
  });

  it("рендерит форму, когда фрагмент содержит #token=", async () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, hash: "#token=valid-token-abc" },
    });

    renderWithClient(<ResetPasswordPageClient />);

    await waitFor(() => {
      expect(mockResetPasswordForm).toHaveBeenCalledWith({
        token: "valid-token-abc",
      });
      expect(
        screen.getByRole("button", { name: "Сохранить новый пароль" }),
      ).toBeInTheDocument();
    });
  });

  it("очищает фрагмент из адресной строки после чтения", async () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...window.location,
        hash: "#token=valid-token-abc",
        pathname: "/reset-password",
      },
    });

    renderWithClient(<ResetPasswordPageClient />);

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/reset-password");
    });
  });

  it("рендерит InvalidTokenAlert, когда фрагмент пуст", async () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, hash: "" },
    });

    renderWithClient(<ResetPasswordPageClient />);

    await waitFor(() => {
      expect(
        screen.getByText("Срок действия ссылки истек"),
      ).toBeInTheDocument();
    });
    expect(mockResetPasswordForm).not.toHaveBeenCalled();
  });

  it("рендерит InvalidTokenAlert при произвольном фрагменте без token=", async () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, hash: "#something=else" },
    });

    renderWithClient(<ResetPasswordPageClient />);

    await waitFor(() => {
      expect(
        screen.getByText("Срок действия ссылки истек"),
      ).toBeInTheDocument();
    });
    expect(mockResetPasswordForm).not.toHaveBeenCalled();
  });

  it("рендерит InvalidTokenAlert при некорректно закодированном фрагменте (URIError)", async () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, hash: "#token=%" },
    });

    renderWithClient(<ResetPasswordPageClient />);

    await waitFor(() => {
      expect(
        screen.getByText("Срок действия ссылки истек"),
      ).toBeInTheDocument();
    });
    expect(mockResetPasswordForm).not.toHaveBeenCalled();
  });

  it("передаёт декодированный токен в форму", async () => {
    const rawToken = "abc+def/ghi==";
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...window.location,
        hash: `#token=${encodeURIComponent(rawToken)}`,
      },
    });

    renderWithClient(<ResetPasswordPageClient />);

    await waitFor(() => {
      expect(mockResetPasswordForm).toHaveBeenCalledWith({
        token: rawToken,
      });
    });
  });

  it("новый экземпляр компонента читает новый fragment после повторного монтирования", async () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...window.location,
        hash: "#token=first-token",
        pathname: "/reset-password",
      },
    });

    const { unmount } = renderWithClient(<ResetPasswordPageClient />);

    await waitFor(() => {
      expect(mockResetPasswordForm).toHaveBeenCalledWith({
        token: "first-token",
      });
    });

    unmount();
    mockResetPasswordForm.mockClear();

    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...window.location,
        hash: "#token=second-token",
        pathname: "/reset-password",
      },
    });

    renderWithClient(<ResetPasswordPageClient />);

    await waitFor(() => {
      expect(mockResetPasswordForm).toHaveBeenCalledWith({
        token: "second-token",
      });
    });
  });
});
