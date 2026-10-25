import { describe, expect, it } from "vitest";
import type { MeetingParticipantState } from "./types";

describe("MeetingParticipantState", () => {
  it("should create a valid participant state object", () => {
    const participant: MeetingParticipantState = {
      id: "part-1",
      identity: "user-123",
      name: "Алексей",
      isLocal: true,
      role: "HOST",
      isSpeaking: false,
      isMicrophoneEnabled: true,
      isCameraEnabled: true,
      isScreenSharing: false,
      isHandRaised: false,
      videoTrack: null,
      audioTrack: null,
      screenShareTrack: null,
    };

    expect(participant.id).toBe("part-1");
    expect(participant.identity).toBe("user-123");
    expect(participant.name).toBe("Алексей");
    expect(participant.role).toBe("HOST");
    expect(participant.isLocal).toBe(true);
    expect(participant.isHandRaised).toBe(false);
    expect(participant.isScreenSharing).toBe(false);
  });
});
