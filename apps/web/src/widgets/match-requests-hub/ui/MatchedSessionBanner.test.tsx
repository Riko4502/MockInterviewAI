import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/shared/lib/i18n";
import { MatchedSessionBanner } from "./MatchedSessionBanner";

describe("MatchedSessionBanner", () => {
  beforeEach(() => {
    i18n.changeLanguage("ru");
  });

  afterEach(() => {
    cleanup();
  });

  it("показывает запланированную дату, если передан scheduledAt", () => {
    render(
      <MatchedSessionBanner
        sessionId="session-1"
        sessionStatus="ACTIVE"
        scheduledAt="2026-01-15T16:00:00.000Z"
        viewerTimezone="Europe/Moscow"
      />,
    );

    expect(
      screen.getByText(/Интервью запланировано на 15 января 2026, 19:00/),
    ).toBeInTheDocument();
  });

  it("без scheduledAt показывает стандартное описание", () => {
    render(
      <MatchedSessionBanner sessionId="session-1" sessionStatus="ACTIVE" />,
    );

    expect(
      screen.getByText(/Перейдите в интерактивную песочницу/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Интервью запланировано на/),
    ).not.toBeInTheDocument();
  });

  it("для завершённой сессии показывает статус завершения вместо даты", () => {
    render(
      <MatchedSessionBanner
        sessionStatus="CLOSED"
        scheduledAt="2026-01-15T16:00:00.000Z"
        viewerTimezone="Europe/Moscow"
      />,
    );

    expect(screen.getAllByText("Интервью завершено").length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/Интервью запланировано на/),
    ).not.toBeInTheDocument();
  });
});
