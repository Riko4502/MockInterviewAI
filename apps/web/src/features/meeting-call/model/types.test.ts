import { describe, expect, it } from "vitest";
import {
  type ChatMessageData,
  isDataChannelPayload,
  type RaiseHandData,
  type ReactionData,
} from "./types";

describe("DataChannel types and guards", () => {
  it("should validate CHAT_MESSAGE payload correctly", () => {
    const validChat: ChatMessageData = {
      type: "CHAT_MESSAGE",
      id: "msg-1",
      senderId: "user-1",
      senderName: "Алексей",
      text: "Привет всем!",
      timestamp: new Date().toISOString(),
    };

    expect(isDataChannelPayload(validChat)).toBe(true);
    expect(isDataChannelPayload({ type: "CHAT_MESSAGE", id: "1" })).toBe(false);
  });

  it("should validate RAISE_HAND payload correctly", () => {
    const validRaiseHand: RaiseHandData = {
      type: "RAISE_HAND",
      participantId: "part-1",
      raised: true,
    };

    expect(isDataChannelPayload(validRaiseHand)).toBe(true);
    expect(
      isDataChannelPayload({ type: "RAISE_HAND", participantId: "part-1" }),
    ).toBe(false);
  });

  it("should validate REACTION payload correctly", () => {
    const validReaction: ReactionData = {
      type: "REACTION",
      id: "react-1",
      participantId: "part-1",
      emoji: "👏",
    };

    expect(isDataChannelPayload(validReaction)).toBe(true);
    expect(isDataChannelPayload({ type: "REACTION", emoji: "👏" })).toBe(false);
  });

  it("should reject invalid or unknown payloads", () => {
    expect(isDataChannelPayload(null)).toBe(false);
    expect(isDataChannelPayload(undefined)).toBe(false);
    expect(isDataChannelPayload("string")).toBe(false);
    expect(isDataChannelPayload({ type: "UNKNOWN_TYPE" })).toBe(false);
  });
});
