import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MeetingParticipantState } from "@/entities/meeting-participant";
import { VideoGrid } from "./VideoGrid";

function createMockParticipant(
  id: string,
  name: string,
): MeetingParticipantState {
  return {
    id,
    identity: id,
    name,
    isLocal: false,
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

describe("VideoGrid", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("рендерит всех переданных участников", () => {
    const participants = [
      createMockParticipant("part-1", "Алиса"),
      createMockParticipant("part-2", "Борис"),
    ];

    render(<VideoGrid participants={participants} />);

    expect(screen.getByText("Алиса")).toBeInTheDocument();
    expect(screen.getByText("Борис")).toBeInTheDocument();
  });

  it("отображает заглушку при пустом списке участников", () => {
    render(<VideoGrid participants={[]} />);

    expect(
      screen.getByText("В комнате пока нет участников"),
    ).toBeInTheDocument();
  });
});
