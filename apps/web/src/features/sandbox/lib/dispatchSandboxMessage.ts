import type { LanguageId } from "@packages/editor";
import type {
  RunResult,
  SandboxRealtimeMessage,
  WebRTCSignal,
} from "../model/types";

export interface SandboxCallbacks {
  onRemoteTaskChange?: (taskId: string, language?: LanguageId) => void;
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
    case "task-change":
      if (msg.payload.taskId) {
        if (msg.payload.language) {
          callbacks.onRemoteTaskChange?.(
            msg.payload.taskId,
            msg.payload.language,
          );
        } else {
          callbacks.onRemoteTaskChange?.(msg.payload.taskId);
        }
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
