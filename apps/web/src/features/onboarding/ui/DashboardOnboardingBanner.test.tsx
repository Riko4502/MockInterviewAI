import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/shared/lib/i18n";
import { DashboardOnboardingBanner } from "./DashboardOnboardingBanner";

const mockMutate = vi.fn();
const mockCurrentUser = vi.fn();

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

vi.mock("@/entities/user", () => ({
  useCurrentUser: () => mockCurrentUser(),
}));

function renderBanner() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardOnboardingBanner />
    </QueryClientProvider>,
  );
}

describe("DashboardOnboardingBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when user has completed onboarding", () => {
    mockCurrentUser.mockReturnValue({
      data: { id: "u-1", onboardingCompleted: true },
      isLoading: false,
      isSuccess: true,
    });

    renderBanner();
    expect(
      screen.queryByText(/План вашей подготовки сформирован/i),
    ).not.toBeInTheDocument();
  });

  it("renders when user has not completed onboarding and local state is incomplete", () => {
    mockCurrentUser.mockReturnValue({
      data: { id: "u-1", onboardingCompleted: false },
      isLoading: false,
      isSuccess: true,
    });

    renderBanner();
    expect(
      screen.getByText(/План вашей подготовки сформирован/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/actions\.continue|Продолжить/i),
    ).toBeInTheDocument();
  });

  it("dismisses banner and calls skip mutation", () => {
    mockCurrentUser.mockReturnValue({
      data: { id: "u-1", onboardingCompleted: false },
      isLoading: false,
      isSuccess: true,
    });

    renderBanner();
    const closeBtn = screen.getByRole("button", {
      name: /actions\.cancel|Отмена/i,
    });
    fireEvent.click(closeBtn);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isSkipped: true,
          companies: [],
        }),
      }),
      expect.anything(),
    );
    expect(
      screen.queryByText(/План вашей подготовки сформирован/i),
    ).not.toBeInTheDocument();
  });
});
