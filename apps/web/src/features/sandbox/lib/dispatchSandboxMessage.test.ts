import { describe, expect, it, vi } from "vitest";
import type { SandboxRealtimeMessage } from "../model/types";
import {
  dispatchSandboxMessage,
  type SandboxCallbacks,
} from "./dispatchSandboxMessage";

describe("dispatchSandboxMessage", () => {
  it("should dispatch 'task-change' to onRemoteTaskChange callback", () => {
    const callbacks: SandboxCallbacks = {
      onRemoteTaskChange: vi.fn(),
    };

    const msg: SandboxRealtimeMessage = {
      type: "task-change",
      roomId: "room-1",
      senderId: "user-1",
      senderName: "Alice",
      payload: {
        taskId: "valid-palindrome",
      },
    };

    dispatchSandboxMessage(msg, callbacks);

    expect(callbacks.onRemoteTaskChange).toHaveBeenCalledWith(
      "valid-palindrome",
    );
  });

  it("should dispatch 'webrtc-signal' to onRemoteWebRTCSignal callback", () => {
    const callbacks: SandboxCallbacks = {
      onRemoteWebRTCSignal: vi.fn(),
    };

    const msg: SandboxRealtimeMessage = {
      type: "webrtc-signal",
      roomId: "room-1",
      senderId: "user-1",
      senderName: "Alice",
      payload: {
        signal: {
          type: "call-started",
          senderId: "user-1",
        },
      },
    };

    dispatchSandboxMessage(msg, callbacks);

    expect(callbacks.onRemoteWebRTCSignal).toHaveBeenCalledWith({
      type: "call-started",
      senderId: "user-1",
    });
  });

  it("should dispatch 'run-result' to onRemoteRunResult callback", () => {
    const callbacks: SandboxCallbacks = {
      onRemoteRunResult: vi.fn(),
    };

    const runResult = {
      success: true,
      totalTests: 3,
      passedTests: 3,
      results: [],
      logs: [],
      totalTimeMs: 15,
    };

    const msg: SandboxRealtimeMessage = {
      type: "run-result",
      roomId: "room-1",
      senderId: "user-1",
      senderName: "Alice",
      payload: {
        runResult,
      },
    };

    dispatchSandboxMessage(msg, callbacks);

    expect(callbacks.onRemoteRunResult).toHaveBeenCalledWith(runResult);
  });
});
