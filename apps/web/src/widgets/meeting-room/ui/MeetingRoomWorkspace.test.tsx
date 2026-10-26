import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MeetingParticipantState } from "@/entities/meeting-participant";
import { MeetingRoomWorkspace } from "./MeetingRoomWorkspace";

function createMockParticipant(
  id: string,
  name: string,
  isLocal = false,
): MeetingParticipantState {
  return {
    id,
    identity: id,
    name,
    isLocal,
    role: "PARTICIPANT",
    isSpeaking: false,
    isMicrophoneEnabled: true,
    isCameraEnabled: false,
    isScreenSharing: false,
    isHandRaised: false,
    videoTrack: null,
    audioTrack: null,
    screenShareTrack: null,
  };
}

describe("MeetingRoomWorkspace", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const localPart = createMockParticipant("me", "Я", true);
  const remotePart = createMockParticipant("other", "Собеседник");

  const defaultProps = {
    roomTitle: "System Design Mock",
    participants: [localPart, remotePart],
    localParticipant: localPart,
    screenShareParticipant: null,
    messages: [],
    reactions: [],
    isMicrophoneEnabled: true,
    isCameraEnabled: true,
    isScreenSharing: false,
    isHandRaised: false,
    onToggleMicrophone: vi.fn(),
    onToggleCamera: vi.fn(),
    onToggleScreenShare: vi.fn(),
    onToggleHand: vi.fn(),
    onSendReaction: vi.fn(),
    onSendMessage: vi.fn(),
    onLeaveCall: vi.fn(),
  };

  it("рендерит шапку с названием встречи и счетчиком участников", () => {
    render(<MeetingRoomWorkspace {...defaultProps} />);

    expect(screen.getByText("System Design Mock")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("открывает сайдбар чата при клике на кнопку чата", async () => {
    const user = userEvent.setup();
    render(<MeetingRoomWorkspace {...defaultProps} />);

    expect(screen.queryByText("Чат встречи")).not.toBeInTheDocument();

    const chatBtn = screen.getByLabelText("Чат встречи");
    await user.click(chatBtn);

    expect(screen.getByText("Чат встречи")).toBeInTheDocument();
  });

  it("рендерит ScreenShareStage, когда активен показ экрана", () => {
    const sharingPart: MeetingParticipantState = {
      ...remotePart,
      isScreenSharing: true,
      screenShareTrack: {
        track: {
          attach: vi.fn(),
          detach: vi.fn(),
        },
      } as unknown as MeetingParticipantState["screenShareTrack"],
    };

    render(
      <MeetingRoomWorkspace
        {...defaultProps}
        screenShareParticipant={sharingPart}
      />,
    );

    expect(screen.getByText(/Демонстрация:/)).toBeInTheDocument();
  });
});
