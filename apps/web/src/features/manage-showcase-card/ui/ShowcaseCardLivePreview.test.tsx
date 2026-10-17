import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { ShowcaseCardLivePreview } from "./ShowcaseCardLivePreview";

vi.mock("@/entities/user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/user")>();
  return {
    ...actual,
    useViewerTimezone: () => "Europe/Moscow",
    UserAvatar: ({ name }: { name: string }) => (
      <div data-testid="user-avatar">{name}</div>
    ),
  };
});

describe("ShowcaseCardLivePreview", () => {
  beforeEach(() => {
    i18n.changeLanguage("ru");
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("должен отображать добавленные слоты формы в превью", () => {
    render(
      <ShowcaseCardLivePreview
        authorTimezone="Europe/Moscow"
        values={{
          specialization: "FRONTEND",
          level: "MIDDLE",
          language: "RU",
          skills: ["React"],
          isUrgent: false,
          autoRenew: false,
          slots: [
            {
              id: "slot-1",
              startsAtLocal: "2999-01-01T10:00",
              durationMinutes: 60,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText(/10:00/)).toBeInTheDocument();
  });

  it("не должен показывать прошедшие открытые слоты", () => {
    render(
      <ShowcaseCardLivePreview
        authorTimezone="Europe/Moscow"
        values={{
          specialization: "FRONTEND",
          level: "MIDDLE",
          language: "RU",
          skills: ["React"],
          isUrgent: false,
          autoRenew: false,
          slots: [
            {
              id: "slot-1",
              startsAtLocal: "2000-01-01T10:00",
              durationMinutes: 60,
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText(/10:00/)).not.toBeInTheDocument();
  });
});
