import "@testing-library/jest-dom/vitest";
import type { AvailabilitySlot } from "@packages/types";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { ShowcaseSlotsList } from "./ShowcaseSlotsList";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function slot(
  overrides: Partial<AvailabilitySlot> & { startsAt: string },
): AvailabilitySlot {
  return {
    id: overrides.id ?? overrides.startsAt,
    startsAt: overrides.startsAt,
    durationMinutes: overrides.durationMinutes ?? 60,
    status: overrides.status ?? "OPEN",
  };
}

describe("ShowcaseSlotsList", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    i18n.changeLanguage("en");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("рендерит только будущие OPEN-слоты", () => {
    render(
      <ShowcaseSlotsList
        viewerTimezone="UTC"
        slots={[
          slot({ startsAt: "2026-01-15T16:00:00.000Z" }),
          slot({ startsAt: "2025-12-20T16:00:00.000Z" }),
          slot({ startsAt: "2026-01-16T16:00:00.000Z", status: "BOOKED" }),
          slot({ startsAt: "2026-01-17T16:00:00.000Z", status: "CANCELLED" }),
        ]}
      />,
    );

    expect(screen.getByText("Thu, 15 Jan 16:00")).toBeInTheDocument();
    expect(screen.queryByText(/20 Dec/)).not.toBeInTheDocument();
    expect(screen.queryByText(/16 Jan/)).not.toBeInTheDocument();
    expect(screen.queryByText(/17 Jan/)).not.toBeInTheDocument();
  });

  it("сортирует слоты по возрастанию startsAt", () => {
    render(
      <ShowcaseSlotsList
        viewerTimezone="UTC"
        slots={[
          slot({ startsAt: "2026-01-17T08:00:00.000Z" }),
          slot({ startsAt: "2026-01-15T16:00:00.000Z" }),
          slot({ startsAt: "2026-01-16T10:00:00.000Z" }),
        ]}
      />,
    );

    const badges = screen
      .getAllByText(/^\w{3}, \d{2} Jan \d{2}:\d{2}$/)
      .map((node) => node.textContent);

    expect(badges).toEqual([
      "Thu, 15 Jan 16:00",
      "Fri, 16 Jan 10:00",
      "Sat, 17 Jan 08:00",
    ]);
  });

  it("показывает максимум 3 бейджа и счётчик скрытых", () => {
    render(
      <ShowcaseSlotsList
        viewerTimezone="UTC"
        slots={[
          slot({ startsAt: "2026-01-15T16:00:00.000Z" }),
          slot({ startsAt: "2026-01-16T10:00:00.000Z" }),
          slot({ startsAt: "2026-01-17T08:00:00.000Z" }),
          slot({ startsAt: "2026-01-18T12:00:00.000Z" }),
        ]}
      />,
    );

    expect(screen.getByText("Thu, 15 Jan 16:00")).toBeInTheDocument();
    expect(screen.getByText("Fri, 16 Jan 10:00")).toBeInTheDocument();
    expect(screen.getByText("Sat, 17 Jan 08:00")).toBeInTheDocument();
    expect(screen.queryByText("Sun, 18 Jan 12:00")).not.toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();
  });

  it("уважает кастомный maxVisible", () => {
    render(
      <ShowcaseSlotsList
        viewerTimezone="UTC"
        maxVisible={1}
        slots={[
          slot({ startsAt: "2026-01-15T16:00:00.000Z" }),
          slot({ startsAt: "2026-01-16T10:00:00.000Z" }),
        ]}
      />,
    );

    expect(screen.getByText("Thu, 15 Jan 16:00")).toBeInTheDocument();
    expect(screen.queryByText("Fri, 16 Jan 10:00")).not.toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();
  });

  it("не рендерит блок, если нет актуальных слотов", () => {
    const { container } = render(
      <ShowcaseSlotsList
        viewerTimezone="UTC"
        slots={[
          slot({ startsAt: "2025-12-20T16:00:00.000Z" }),
          slot({ startsAt: "2026-01-16T16:00:00.000Z", status: "BOOKED" }),
        ]}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
