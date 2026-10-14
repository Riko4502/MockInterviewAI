import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateUserDialog } from "./CreateUserDialog";

const mockMutateAsync = vi.fn();
const mockToastPush = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock("@packages/api", () => ({
  useAdminUsersControllerCreateUser: () => ({
    mutateAsync: mockMutateAsync,
  }),
}));

vi.mock("@packages/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/ui")>();
  return {
    ...actual,
    useToast: () => ({
      push: mockToastPush,
    }),
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          "admin.users.createModal.title": "Добавить нового пользователя",
          "admin.users.createModal.submit": "Создать пользователя",
          "admin.users.createModal.successToast": "Пользователь успешно создан",
          "admin.users.createModal.conflictError":
            "Пользователь с таким email или username уже существует",
          "admin.users.createModal.errorToast":
            "Не удалось создать пользователя",
        };
        return translations[key] ?? key;
      },
    }),
  };
});

describe("CreateUserDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});
  });

  it("renders when open is true", () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Добавить нового пользователя")).toBeDefined();
    expect(screen.getByText("Создать пользователя")).toBeDefined();
  });

  it("submits valid form and normalizes empty strings to undefined", async () => {
    const onOpenChange = vi.fn();
    render(<CreateUserDialog open={true} onOpenChange={onOpenChange} />);

    const emailInput = screen.getByLabelText(/Email/i);
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });

    const submitBtn = screen.getByText("Создать пользователя");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "test@example.com",
          username: undefined,
          displayName: undefined,
          role: "USER",
          isActive: true,
        }),
      });
    });

    expect(mockToastPush).toHaveBeenCalledWith({
      status: "success",
      title: "Пользователь успешно создан",
    });
    expect(mockInvalidateQueries).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows conflict error toast when API returns 409", async () => {
    mockMutateAsync.mockRejectedValueOnce({ status: 409 });
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);

    const emailInput = screen.getByLabelText(/Email/i);
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });

    const submitBtn = screen.getByText("Создать пользователя");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockToastPush).toHaveBeenCalledWith({
        status: "error",
        title: "Пользователь с таким email или username уже существует",
      });
    });
  });

  it("shows generic error toast when API fails with non-409 error", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Network error"));
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);

    const emailInput = screen.getByLabelText(/Email/i);
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });

    const submitBtn = screen.getByText("Создать пользователя");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockToastPush).toHaveBeenCalledWith({
        status: "error",
        title: "Не удалось создать пользователя",
      });
    });
  });
});
