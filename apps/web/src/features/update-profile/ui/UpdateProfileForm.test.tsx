import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

let mockUserData = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "dev@example.com",
  displayName: "Иван",
  username: "ivan",
  avatarUrl: null,
  telegramUsername: null,
  gitUrl: null,
  theme: "dark",
  locale: "ru",
};

const setPreferenceCookiesMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: refreshMock,
  }),
  usePathname: () => "/dashboard/profile",
}));

vi.mock("@/entities/user", () => ({
  useCurrentUser: () => ({
    data: mockUserData,
    isLoading: false,
    isError: false,
  }),
  UserAvatar: ({ name }: { name?: string | null }) => (
    <div>{name ?? "avatar"}</div>
  ),
  setPreferenceCookies: (args: unknown) => setPreferenceCookiesMock(args),
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
    toastPushMock.mockClear();
    setPreferenceCookiesMock.mockClear();
    refreshMock.mockClear();
    mockUserData = {
      id: "11111111-1111-1111-1111-111111111111",
      email: "dev@example.com",
      displayName: "Иван",
      username: "ivan",
      avatarUrl: null,
      telegramUsername: null,
      gitUrl: null,
      theme: "dark",
      locale: "ru",
    };
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

    // Проверяем вызов toast при onSuccess
    const lastCall = mutateMock.mock.calls[0];
    const options = lastCall[1];
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

  it("синхронизирует значения формы при обновлении профиля и не отправляет устаревшие предпочтения", async () => {
    const user = userEvent.setup();
    const { rerender } = renderForm();

    // Симулируем обновление темы в другой вкладке (в кэше профиля)
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

    // Пользователь меняет только имя
    const nameInput = screen.getByDisplayValue("Иван");
    await user.clear(nameInput);
    await user.type(nameInput, "Иван Сидоров");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    // Отправляется только измененное поле displayName, устаревшие предпочтения не перезаписываются
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

  it("не отправляет запрос, если ни одно поле не было изменено", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(mutateMock).not.toHaveBeenCalled();
    expect(toastPushMock).toHaveBeenCalledWith({
      status: "success",
      title: "Профиль сохранён.",
    });
  });

  it("обновляет язык интерфейса, куки и вызывает router.refresh() при сохранении нового языка", async () => {
    window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup();
    renderForm();

    const comboboxes = screen.getAllByRole("combobox");
    // comboboxes[0] is theme, comboboxes[1] is locale
    const localeTrigger = comboboxes[1];
    expect(localeTrigger).toHaveTextContent("Русский");

    fireEvent.keyDown(localeTrigger, { key: "ArrowDown" });
    const englishOption = await screen.findByRole("option", {
      name: /English/i,
    });
    await user.click(englishOption);

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        {
          data: {
            locale: "en",
          },
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });

    const lastCall = mutateMock.mock.calls[0];
    const options = lastCall[1];
    act(() => {
      options.onSuccess({
        ...mockUserData,
        locale: "en",
      });
    });

    expect(setPreferenceCookiesMock).toHaveBeenCalledWith({ locale: "en" });
    expect(document.documentElement.lang).toBe("en");
    expect(refreshMock).toHaveBeenCalled();
    expect(toastPushMock).toHaveBeenCalledWith({
      status: "success",
      title: "Profile saved.",
    });
  });
});
