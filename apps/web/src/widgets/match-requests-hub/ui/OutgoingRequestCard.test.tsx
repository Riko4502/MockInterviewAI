import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { createMatchRequest } from "./match-request.fixture";
import { OutgoingRequestCard } from "./OutgoingRequestCard";

vi.mock("@/entities/user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/user")>();
  return {
    ...actual,
    useViewerTimezone: () => "Europe/Moscow",
  };
});

const noop = () => {};

describe("OutgoingRequestCard", () => {
  beforeEach(() => {
    i18n.changeLanguage("ru");
  });

  afterEach(() => {
    cleanup();
  });

  it("показывает плашку слота в таймзоне смотрящего", () => {
    render(
      <OutgoingRequestCard
        req={createMatchRequest({
          slot: {
            id: "slot-1",
            startsAt: "2026-01-15T16:00:00.000Z",
            durationMinutes: 45,
            status: "OPEN",
          },
        })}
        onCancel={noop}
      />,
    );

    expect(screen.getByText("15 января 2026, 19:00")).toBeInTheDocument();
    expect(screen.getByText("45 мин")).toBeInTheDocument();
    expect(screen.getByText("Свободен")).toBeInTheDocument();
  });

  it("не рендерит плашку слота, если req.slot отсутствует", () => {
    render(<OutgoingRequestCard req={createMatchRequest()} onCancel={noop} />);

    expect(screen.queryByText("15 января 2026, 19:00")).not.toBeInTheDocument();
    expect(screen.queryByText("45 мин")).not.toBeInTheDocument();
  });

  it("при ACCEPTED показывает баннер с запланированной датой слота", () => {
    render(
      <OutgoingRequestCard
        req={createMatchRequest({
          status: "ACCEPTED",
          sessionId: "session-1",
          sessionStatus: "ACTIVE",
          slot: {
            id: "slot-1",
            startsAt: "2026-01-15T16:00:00.000Z",
            durationMinutes: 60,
            status: "BOOKED",
          },
        })}
        onCancel={noop}
      />,
    );

    expect(
      screen.getByText(/Интервью запланировано на 15 января 2026, 19:00/),
    ).toBeInTheDocument();
  });
});
