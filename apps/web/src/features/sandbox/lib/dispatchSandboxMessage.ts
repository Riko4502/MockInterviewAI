import type { LanguageId } from "@packages/editor";
import type { RunResult } from "../model/types";
import type { SandboxRealtimeMessage } from "./useSandboxRealtime";
import type { WebRTCSignal } from "./useWebRTC";

export interface SandboxCallbacks {
  onRemoteCodeUpdate?: (code: string, language?: LanguageId) => void;
  onRemoteTaskChange?: (taskId: string) => void;
  onRemoteWebRTCSignal?: (signal: WebRTCSignal) => void;
  onRemoteRunResult?: (result: RunResult) => void;
  onPeerJoined?: (peerId: string) => void;
}

/**
 * Dispatcher: маршрутизирует событие песочницы в соответствующие колбэки через switch.
 */
export function dispatchSandboxMessage(
  msg: SandboxRealtimeMessage,
  callbacks: SandboxCallbacks,
): void {
  switch (msg.type) {
    case "code-update":
      if (msg.payload.code !== undefined) {
        callbacks.onRemoteCodeUpdate?.(msg.payload.code, msg.payload.language);
      }
      break;

    case "task-change":
      if (msg.payload.taskId) {
        callbacks.onRemoteTaskChange?.(msg.payload.taskId);
      }
      break;

    case "webrtc-signal":
      if (msg.payload.signal) {
        callbacks.onRemoteWebRTCSignal?.(msg.payload.signal);
      }
      break;

    case "run-result":
      if (msg.payload.runResult) {
        callbacks.onRemoteRunResult?.(msg.payload.runResult);
      }
      break;
  }
}
