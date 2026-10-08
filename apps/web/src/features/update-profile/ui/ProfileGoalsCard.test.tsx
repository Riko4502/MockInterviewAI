import "@testing-library/jest-dom/vitest";
import type { UserProfileDto } from "@packages/api";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@/shared/lib/i18n";
import { ProfileGoalsCard } from "./ProfileGoalsCard";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const mockUserWithGoals: UserProfileDto = {
  id: "user-1",
  email: "test@example.com",
  displayName: "Tester",
  username: "tester",
  avatarUrl: null,
  telegramUsername: null,
  gitUrl: null,
  theme: "dark",
  locale: "ru",
  role: "USER",
  permissions: "0",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  onboardingCompleted: true,
  targetRole: "FRONTEND",
  targetLevel: "MIDDLE",
  targetTimeline: "1_month",
  preferredFormat: "ai",
  targetCompanies: ["yandex", "sber"],
};

const mockUserWithoutGoals: UserProfileDto = {
  id: "user-2",
  email: "empty@example.com",
  displayName: "Empty",
  username: "empty",
  avatarUrl: null,
  telegramUsername: null,
  gitUrl: null,
  theme: "dark",
  locale: "ru",
  role: "USER",
  permissions: "0",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  onboardingCompleted: false,
};

describe("ProfileGoalsCard", () => {
  it("renders goals when user has configured targets", () => {
    render(<ProfileGoalsCard user={mockUserWithGoals} />);

    expect(screen.getByText("Цели подготовки")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/onboarding");
    expect(screen.getByText("Изменить цели")).toBeInTheDocument();
  });

  it("renders empty message and setup button when user has no goals", () => {
    render(<ProfileGoalsCard user={mockUserWithoutGoals} />);

    expect(screen.getByText("Цели подготовки")).toBeInTheDocument();
    expect(
      screen.getByText(/Цели подготовки пока не настроены/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Пройти онбординг")).toBeInTheDocument();
  });
});
