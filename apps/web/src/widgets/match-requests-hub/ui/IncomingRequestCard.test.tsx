import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { IncomingRequestCard } from "./IncomingRequestCard";
import { createMatchRequest } from "./match-request.fixture";

vi.mock("@/entities/user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/user")>();
  return {
    ...actual,
    useViewerTimezone: () => "Europe/Moscow",
  };
});

const noop = () => {};

describe("IncomingRequestCard", () => {
  beforeEach(() => {
    i18n.changeLanguage("ru");
  });

  afterEach(() => {
    cleanup();
  });

  it("показывает плашку слота в таймзоне смотрящего", () => {
    render(
      <IncomingRequestCard
        req={createMatchRequest({
          slot: {
            id: "slot-1",
            startsAt: "2026-01-15T16:00:00.000Z",
            durationMinutes: 60,
            status: "BOOKED",
          },
        })}
        onAccept={noop}
        onReject={noop}
      />,
    );

    // 16:00 UTC → 19:00 Europe/Moscow
    expect(screen.getByText("15 января 2026, 19:00")).toBeInTheDocument();
    expect(screen.getByText("60 мин")).toBeInTheDocument();
    expect(screen.getByText("Забронирован")).toBeInTheDocument();
  });

  it("не рендерит плашку слота, если req.slot отсутствует", () => {
    render(
      <IncomingRequestCard
        req={createMatchRequest()}
        onAccept={noop}
        onReject={noop}
      />,
    );

    expect(screen.queryByText("15 января 2026, 19:00")).not.toBeInTheDocument();
    expect(screen.queryByText("60 мин")).not.toBeInTheDocument();
    expect(screen.queryByText("Забронирован")).not.toBeInTheDocument();
  });

  it("при ACCEPTED показывает баннер с запланированной датой слота", () => {
    render(
      <IncomingRequestCard
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
        onAccept={noop}
        onReject={noop}
      />,
    );

    expect(
      screen.getByText(/Интервью запланировано на 15 января 2026, 19:00/),
    ).toBeInTheDocument();
  });
});
