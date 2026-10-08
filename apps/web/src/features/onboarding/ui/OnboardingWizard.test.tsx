import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { paths } from "@/shared/config";
import { OnboardingWizard } from "./OnboardingWizard";

const replaceMock = vi.fn();
const mockMutate = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("@packages/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/ui")>();
  return {
    ...actual,
    useToast: () => ({
      push: vi.fn(),
      dismiss: vi.fn(),
    }),
  };
});

vi.mock("@packages/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/api")>();
  return {
    ...actual,
    useProfileControllerCompleteOnboarding: () => ({
      mutate: mockMutate.mockImplementation(
        (_variables: unknown, options?: { onSuccess?: () => void }) => {
          options?.onSuccess?.();
        },
      ),
      isPending: false,
    }),
  };
});

const mockCurrentUser = vi.fn();

vi.mock("@/entities/user", () => ({
  useCurrentUser: () => mockCurrentUser(),
}));

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <OnboardingWizard />
    </QueryClientProvider>,
  );
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.mockReturnValue({
      data: {
        id: "test-user-id",
        targetRole: null,
        targetLevel: null,
        onboardingCompleted: false,
      },
      isLoading: false,
      isSuccess: true,
    });
  });

  it("renders Step 1 with role selection and progress bar", () => {
    renderWizard();

    // Step counter
    expect(screen.getByText(/Шаг 1 из 3/i)).toBeInTheDocument();
    // Step 1 Title
    expect(
      screen.getByText(/Выберите вашу специализацию/i),
    ).toBeInTheDocument();

    // Roles present
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("System Design")).toBeInTheDocument();

    // Skip button
    expect(screen.getByText(/Пропустить/i)).toBeInTheDocument();
    // Continue button
    expect(screen.getByText(/Продолжить/i)).toBeInTheDocument();
  });

  it("navigates through Step 1 -> Step 2 -> Step 3 and finishes onboarding", async () => {
    renderWizard();

    // Step 1: Select Backend
    fireEvent.click(screen.getByText("Backend"));

    // Click Next
    fireEvent.click(screen.getByText(/Продолжить/i));

    // Now on Step 2
    expect(screen.getByText(/Шаг 2 из 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Грейд и целевые компании/i)).toBeInTheDocument();

    // Select Senior level
    fireEvent.click(screen.getByText("Senior"));

    // Toggle a company
    const startupBtn = screen.getByText(/Быстрорастущие стартапы/i);
    fireEvent.click(startupBtn);

    // Select timeline
    fireEvent.click(screen.getByText(/Ищу работу прямо сейчас/i));

    // Click Next to Step 3
    fireEvent.click(screen.getByText(/Продолжить/i));

    // Now on Step 3
    expect(screen.getByText(/Шаг 3 из 3/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Предпочитаемый формат тренировок/i),
    ).toBeInTheDocument();

    // Check preview reflects selection
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("Senior")).toBeInTheDocument();

    // Select Sandbox format
    fireEvent.click(screen.getByText(/Песочница и банк задач/i));

    // Finish button
    const finishBtn = screen.getByText(/Завершить и перейти к платформе/i);
    expect(finishBtn).toBeInTheDocument();
    fireEvent.click(finishBtn);

    // Check backend mutation was called
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: "BACKEND",
          level: "SENIOR",
          format: "sandbox",
          isSkipped: false,
        }),
      }),
      expect.anything(),
    );

    // Redirect to sandbox since format was "sandbox"
    expect(replaceMock).toHaveBeenCalledWith(paths.sandbox);
  });

  it("allows going back from Step 2 to Step 1", () => {
    renderWizard();

    // Go to step 2
    fireEvent.click(screen.getByText(/Продолжить/i));
    expect(screen.getByText(/Шаг 2 из 3/i)).toBeInTheDocument();

    // Click Back
    fireEvent.click(screen.getByText(/Назад/i));
    expect(screen.getByText(/Шаг 1 из 3/i)).toBeInTheDocument();
  });

  it("skips onboarding and redirects to dashboard with backend mutation", () => {
    renderWizard();

    const skipBtn = screen.getByText(/Пропустить/i);
    fireEvent.click(skipBtn);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isSkipped: true,
          companies: [],
        }),
      }),
      expect.anything(),
    );

    expect(replaceMock).toHaveBeenCalledWith(paths.dashboard);
  });

  it("renders loading spinner while profile is loading without cached user", () => {
    mockCurrentUser.mockReturnValue({
      data: undefined,
      isLoading: true,
      isSuccess: false,
    });

    const { container } = renderWizard();
    expect(container.querySelector('[data-slot="spin"]')).toBeInTheDocument();
  });
});
