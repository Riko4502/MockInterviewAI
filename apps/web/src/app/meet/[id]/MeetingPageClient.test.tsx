import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MeetingPageClient } from "./MeetingPageClient";

const mockGetMeetingLobby = vi.fn();
const mockJoinMeeting = vi.fn();

vi.mock("@packages/api", () => ({
  useSessionsControllerGetMeetingLobby: () => mockGetMeetingLobby(),
  useSessionsControllerJoinMeeting: () => ({
    mutateAsync: mockJoinMeeting,
    isPending: false,
  }),
  useSessionsControllerEndMeeting: () => ({
    mutateAsync: vi.fn(),
  }),
  useProfileControllerGetMyProfile: () => ({
    data: { displayName: "Иван Иванов" },
  }),
}));

vi.mock("@/entities/session", () => ({
  useSession: () => ({
    isAuthenticated: true,
    userId: "user-123",
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("MeetingPageClient", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [],
          getVideoTracks: () => [],
          getAudioTracks: () => [],
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("показывает спиннер в процессе загрузки лобби", () => {
    mockGetMeetingLobby.mockReturnValue({
      isLoading: true,
      data: null,
      error: null,
    });

    const { container } = render(<MeetingPageClient sessionId="sess-1" />);

    expect(container.querySelector('[data-slot="spin"]')).toBeInTheDocument();
  });

  it("показывает ошибку, если встреча не найдена", () => {
    mockGetMeetingLobby.mockReturnValue({
      isLoading: false,
      data: null,
      error: new Error("Not found"),
    });

    render(<MeetingPageClient sessionId="sess-1" />);

    expect(screen.getByText("Встреча не найдена")).toBeInTheDocument();
  });

  it("показывает статус завершенной встречи, если статус CLOSED", () => {
    mockGetMeetingLobby.mockReturnValue({
      isLoading: false,
      data: {
        id: "sess-1",
        title: "Завершенная встреча",
        status: "CLOSED",
      },
      error: null,
    });

    render(<MeetingPageClient sessionId="sess-1" />);

    expect(screen.getByText("Встреча завершена")).toBeInTheDocument();
  });

  it("рендерит лобби перед входом для активной встречи", () => {
    mockGetMeetingLobby.mockReturnValue({
      isLoading: false,
      data: {
        id: "sess-1",
        title: "Архитектурный созвон",
        status: "ACTIVE",
        hostName: "Пётр",
        isPasswordRequired: false,
      },
      error: null,
    });

    render(<MeetingPageClient sessionId="sess-1" />);

    expect(screen.getByText("Архитектурный созвон")).toBeInTheDocument();
    expect(screen.getByText("Присоединиться к встрече")).toBeInTheDocument();
  });
});
