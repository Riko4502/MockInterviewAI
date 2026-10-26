import { act, renderHook } from "@testing-library/react";
import { type Room, RoomEvent } from "livekit-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMeetingChat } from "./useMeetingChat";

interface MockTestRoom {
  localParticipant: {
    identity: string;
    name: string;
    publishData: ReturnType<typeof vi.fn>;
  };
  on: (event: string, callback: (payload: Uint8Array) => void) => void;
  off: (event: string) => void;
}

describe("useMeetingChat", () => {
  let eventListeners: Map<string, (payload: Uint8Array) => void>;
  let mockPublishData: ReturnType<typeof vi.fn>;
  let mockRoom: MockTestRoom;

  beforeEach(() => {
    vi.useFakeTimers();
    eventListeners = new Map();
    mockPublishData = vi.fn().mockResolvedValue(undefined);

    mockRoom = {
      localParticipant: {
        identity: "local-user",
        name: "Локальный Юзер",
        publishData: mockPublishData,
      },
      on: vi.fn((event: string, callback: (payload: Uint8Array) => void) => {
        eventListeners.set(event, callback);
      }),
      off: vi.fn((event: string) => {
        eventListeners.delete(event);
      }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize with empty messages and reactions", () => {
    const { result } = renderHook(() =>
      useMeetingChat({
        room: mockRoom as unknown as Room,
        localParticipantId: "local-user",
        localParticipantName: "Локальный Юзер",
      }),
    );

    expect(result.current.messages).toEqual([]);
    expect(result.current.reactions).toEqual([]);
    expect(result.current.isLocalHandRaised).toBe(false);
    expect(result.current.unreadCount).toBe(0);
  });

  it("should send message via publishData and update messages list", async () => {
    const { result } = renderHook(() =>
      useMeetingChat({
        room: mockRoom as unknown as Room,
        localParticipantId: "local-user",
        localParticipantName: "Локальный Юзер",
      }),
    );

    let success = false;
    await act(async () => {
      success = await result.current.sendMessage("Всем привет!");
    });

    expect(success).toBe(true);
    expect(mockPublishData).toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe("Всем привет!");
    expect(result.current.messages[0].senderId).toBe("local-user");
    // Локальное сообщение не увеличивает unreadCount
    expect(result.current.unreadCount).toBe(0);
  });

  it("should receive incoming chat message and increment unreadCount", () => {
    const { result } = renderHook(() =>
      useMeetingChat({
        room: mockRoom as unknown as Room,
        localParticipantId: "local-user",
        localParticipantName: "Локальный Юзер",
      }),
    );

    const onDataReceived = eventListeners.get(RoomEvent.DataReceived);
    expect(onDataReceived).toBeDefined();

    const incomingMessage = {
      type: "CHAT_MESSAGE",
      id: "msg-123",
      senderId: "remote-user",
      senderName: "Петр",
      text: "Привет от Петра!",
      timestamp: new Date().toISOString(),
    };

    act(() => {
      const payload = new TextEncoder().encode(JSON.stringify(incomingMessage));
      onDataReceived?.(payload);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe("Привет от Петра!");
    expect(result.current.unreadCount).toBe(1);

    act(() => {
      result.current.resetUnreadCount();
    });
    expect(result.current.unreadCount).toBe(0);
  });

  it("should toggle raise hand locally and via incoming data", async () => {
    const { result } = renderHook(() =>
      useMeetingChat({
        room: mockRoom as unknown as Room,
        localParticipantId: "local-user",
      }),
    );

    await act(async () => {
      await result.current.toggleRaiseHand();
    });

    expect(mockPublishData).toHaveBeenCalled();
    expect(result.current.isLocalHandRaised).toBe(true);
    expect(result.current.raisedHandParticipantIds.has("local-user")).toBe(
      true,
    );

    // Удаленный участник поднял руку
    const onDataReceived = eventListeners.get(RoomEvent.DataReceived);
    act(() => {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          type: "RAISE_HAND",
          participantId: "remote-user",
          raised: true,
        }),
      );
      onDataReceived?.(payload);
    });

    expect(result.current.raisedHandParticipantIds.has("remote-user")).toBe(
      true,
    );

    // Удаленный участник опустил руку
    act(() => {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          type: "RAISE_HAND",
          participantId: "remote-user",
          raised: false,
        }),
      );
      onDataReceived?.(payload);
    });

    expect(result.current.raisedHandParticipantIds.has("remote-user")).toBe(
      false,
    );
  });

  it("should handle reactions and auto-remove them after 3 seconds", async () => {
    const { result } = renderHook(() =>
      useMeetingChat({
        room: mockRoom as unknown as Room,
        localParticipantId: "local-user",
      }),
    );

    await act(async () => {
      await result.current.sendReaction("🎉");
    });

    expect(result.current.reactions).toHaveLength(1);
    expect(result.current.reactions[0].emoji).toBe("🎉");

    // Спустя 2.9 секунды реакция ещё на месте
    act(() => {
      vi.advanceTimersByTime(2900);
    });
    expect(result.current.reactions).toHaveLength(1);

    // Спустя 3 секунды реакция исчезает
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.reactions).toHaveLength(0);
  });

  it("should safely ignore malformed data", () => {
    const { result } = renderHook(() =>
      useMeetingChat({
        room: mockRoom as unknown as Room,
        localParticipantId: "local-user",
      }),
    );

    const onDataReceived = eventListeners.get(RoomEvent.DataReceived);
    act(() => {
      const badPayload = new TextEncoder().encode("NOT_JSON");
      onDataReceived?.(badPayload);
    });

    expect(result.current.messages).toEqual([]);
  });
});
