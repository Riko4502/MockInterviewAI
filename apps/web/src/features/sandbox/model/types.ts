import type { CursorPosition, LanguageId } from "@packages/editor";

export type TaskDifficulty = "Easy" | "Medium" | "Hard";
export type TaskCategory =
  | "Algorithms"
  | "Data Structures"
  | "Strings"
  | "Design";

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  description?: string;
  /** Сырые параметры для вызова функции в JS/TS runner */
  args: unknown[];
  expected: unknown;
}

export interface TaskExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface InterviewTask {
  id: string;
  title: string;
  difficulty: TaskDifficulty;
  category: TaskCategory;
  description: string;
  examples: TaskExample[];
  constraints: string[];
  starterCode: Partial<Record<LanguageId, string>>;
  functionName: string;
  testCases: TestCase[];
  hints: string[];
}

export interface TestCaseResult {
  testCaseId: string;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTimeMs: number;
  error?: string;
}

export interface RunResult {
  success: boolean;
  totalTests: number;
  passedTests: number;
  results: TestCaseResult[];
  logs: string[];
  totalTimeMs: number;
}

export type WebRTCSignal =
  | { type: "offer"; sdp: RTCSessionDescriptionInit; senderId: string }
  | { type: "answer"; sdp: RTCSessionDescriptionInit; senderId: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit; senderId: string }
  | { type: "call-started"; senderId: string }
  | { type: "call-ended"; senderId: string }
  | {
      type: "media-state";
      isAudioMuted: boolean;
      isVideoOff: boolean;
      senderId: string;
    };

export type SandboxRealtimeMessageType =
  | "code-update"
  | "task-change"
  | "webrtc-signal"
  | "presence-ping"
  | "presence-leave"
  | "cursor-move"
  | "run-result";

export interface SandboxRealtimeMessagePayload {
  code?: string;
  language?: LanguageId;
  taskId?: string;
  signal?: WebRTCSignal;
  cursor?: CursorPosition;
  runResult?: RunResult;
}

export interface SandboxRealtimeMessage {
  type: SandboxRealtimeMessageType;
  roomId: string;
  senderId: string;
  senderName: string;
  payload: SandboxRealtimeMessagePayload;
}

export interface PeerInfo {
  id: string;
  name: string;
  role?: string;
  color: string;
  cursor?: CursorPosition;
  lastSeen: number;
}
