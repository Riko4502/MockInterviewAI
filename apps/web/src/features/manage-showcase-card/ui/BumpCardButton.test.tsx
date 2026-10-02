import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BumpCardButton, formatCooldown } from "./BumpCardButton";

const mockBumpCard = vi.fn();
vi.mock("../model/use-showcase-mutations", () => ({
  useShowcaseMutations: () => ({
    bumpCard: mockBumpCard,
    isBumping: false,
  }),
}));

const mockT = vi.fn((key: string, options?: Record<string, unknown>) => {
  if (key === "card.cooldownHours") {
    return `${options?.hours}h ${options?.minutes}m`;
  }
  if (key === "card.cooldownMinutes") {
    return `${options?.minutes}m`;
  }
  if (key === "card.bumpCooldown") {
    return `Bump in ${options?.time}`;
  }
  if (key === "card.bump") {
    return "Bump to top";
  }
  return key;
});

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: mockT,
    }),
  };
});

describe("BumpCardButton and formatCooldown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("formatCooldown", () => {
    it("форматирует часы и минуты через i18n", () => {
      const ms = 2 * 60 * 60 * 1000 + 15 * 60 * 1000; // 2h 15m
      const result = formatCooldown(
        ms,
        mockT as unknown as Parameters<typeof formatCooldown>[1],
      );

      expect(mockT).toHaveBeenCalledWith("card.cooldownHours", {
        hours: 2,
        minutes: 15,
      });
      expect(result).toBe("2h 15m");
    });

    it("форматирует только минуты через i18n, если часов 0", () => {
      const ms = 45 * 60 * 1000; // 45m
      const result = formatCooldown(
        ms,
        mockT as unknown as Parameters<typeof formatCooldown>[1],
      );

      expect(mockT).toHaveBeenCalledWith("card.cooldownMinutes", {
        minutes: 45,
      });
      expect(result).toBe("45m");
    });
  });

  describe("BumpCardButton", () => {
    it("отображает обычную кнопку поднятия, если кулдаун не активен", () => {
      render(<BumpCardButton cardId="card-1" />);

      const button = screen.getByRole("button");
      expect(button).toBeEnabled();
      expect(button).toHaveTextContent("Bump to top");
    });

    it("отображает заблокированную кнопку с таймером, если кулдаун активен", () => {
      const recentBump = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      render(<BumpCardButton cardId="card-1" bumpedAt={recentBump} />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(/Bump in/);
    });
  });
});
