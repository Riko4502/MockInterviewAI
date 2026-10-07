import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShowcaseFeed } from "./ShowcaseFeed";

// Mocks
const mockFindOutgoing = vi.fn();
const mockUseShowcaseCatalog = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@packages/api", () => ({
  useMatchmakingControllerFindOutgoing: (...args: unknown[]) =>
    mockFindOutgoing(...args),
}));

vi.mock("@/entities/user", () => ({
  useCurrentUser: () => ({
    data: { id: "user-1", displayName: "Tester", username: "tester" },
  }),
}));

vi.mock("@/entities/showcase-card", () => ({
  ShowcaseCard: ({ card }: { card: { id: string; title?: string } }) => (
    <div data-testid={`card-${card.id}`}>{card.title ?? card.id}</div>
  ),
  ShowcaseCardSkeleton: () => <div data-testid="card-skeleton" />,
  useShowcaseCatalog: (params: unknown) => mockUseShowcaseCatalog(params),
}));

vi.mock("@/features/send-match-request", () => ({
  SendMatchRequestDialog: () => <div data-testid="send-dialog" />,
  SendMatchRequestDialogLazy: () => <div data-testid="send-dialog" />,
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) => {
        if (opts?.page && opts?.totalPages) {
          return `Страница ${opts.page} из ${opts.totalPages}`;
        }
        return key;
      },
    }),
  };
});

describe("ShowcaseFeed", () => {
  it("requests outgoing match requests with limit: 50", () => {
    mockFindOutgoing.mockReturnValue({ data: { data: [] } });
    mockUseShowcaseCatalog.mockReturnValue({
      data: {
        data: [],
        meta: {
          page: 1,
          limit: 24,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<ShowcaseFeed />);

    expect(mockFindOutgoing).toHaveBeenCalledWith(
      { limit: 50 },
      expect.objectContaining({ query: { enabled: true } }),
    );
  });

  it("renders pagination and handles page navigation", () => {
    mockFindOutgoing.mockReturnValue({ data: { data: [] } });
    mockUseShowcaseCatalog.mockImplementation((params: { page: number }) => {
      const page = params.page ?? 1;
      return {
        data: {
          data: [{ id: `card-p${page}`, userId: "user-2", status: "ACTIVE" }],
          meta: {
            page,
            limit: 24,
            totalPages: 3,
            hasNextPage: page < 3,
            hasPrevPage: page > 1,
          },
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      };
    });

    render(<ShowcaseFeed />);

    expect(screen.getByTestId("card-card-p1")).toBeInTheDocument();
    expect(screen.getByText("Страница 1 из 3")).toBeInTheDocument();

    const nextBtn = screen.getByLabelText("Перейти на следующую страницу");
    fireEvent.click(nextBtn);

    expect(mockUseShowcaseCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });
});
