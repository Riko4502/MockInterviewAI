import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Track, TrackPublication } from "livekit-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MeetingParticipantState } from "../model/types";
import { VideoTile } from "./VideoTile";

function createMockTrack(): Track {
  return {
    attach: vi.fn((el: HTMLMediaElement) => el),
    detach: vi.fn((el?: HTMLMediaElement) => (el ? [el] : [])),
  } as unknown as Track;
}

function createMockPublication(track?: Track): TrackPublication {
  return {
    track: track || createMockTrack(),
  } as unknown as TrackPublication;
}

function createMockParticipant(
  overrides: Partial<MeetingParticipantState> = {},
): MeetingParticipantState {
  return {
    id: "part-123",
    identity: "user-123",
    name: "Иван Иванов",
    isLocal: false,
    role: "PARTICIPANT",
    isSpeaking: false,
    isMicrophoneEnabled: true,
    isCameraEnabled: true,
    isScreenSharing: false,
    isHandRaised: false,
    videoTrack: null,
    audioTrack: null,
    screenShareTrack: null,
    ...overrides,
  };
}

describe("VideoTile", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("рендерит имя участника и заглушку аватара, если камера выключена", () => {
    const participant = createMockParticipant({
      name: "Петр Сидоров",
      isCameraEnabled: false,
    });

    const { container } = render(<VideoTile participant={participant} />);

    expect(screen.getByText("Петр Сидоров")).toBeInTheDocument();
    expect(screen.getByText("ПС")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="camera-video"]')).toHaveClass(
      "hidden",
    );
    expect(screen.queryByLabelText("Рука поднята")).not.toBeInTheDocument();
  });

  it("отображает метку (Вы) для локального участника", () => {
    const participant = createMockParticipant({
      isLocal: true,
    });

    render(<VideoTile participant={participant} />);

    expect(screen.getByText("(Вы)")).toBeInTheDocument();
  });

  it("отображает бейдж Хост для участника с ролью HOST", () => {
    const participant = createMockParticipant({
      role: "HOST",
    });

    render(<VideoTile participant={participant} />);

    expect(screen.getByText("Хост")).toBeInTheDocument();
  });

  it("отображает индикатор выключенного микрофона, если микрофон отключен", () => {
    const participant = createMockParticipant({
      isMicrophoneEnabled: false,
    });

    render(<VideoTile participant={participant} />);

    expect(screen.getByLabelText("Микрофон выключен")).toBeInTheDocument();
  });

  it("отображает бейдж поднятой руки, если isHandRaised = true", () => {
    const participant = createMockParticipant({
      isHandRaised: true,
    });

    render(<VideoTile participant={participant} />);

    expect(screen.getByLabelText("Рука поднята")).toBeInTheDocument();
    expect(screen.getByText("✋")).toBeInTheDocument();
  });

  it("подсвечивает активного спикера атрибутом data-is-speaking", () => {
    const participant = createMockParticipant({
      isSpeaking: true,
    });

    const { container } = render(<VideoTile participant={participant} />);
    const rootEl = container.querySelector('[data-slot="video-tile"]');

    expect(rootEl).toHaveAttribute("data-is-speaking", "true");
  });

  it("подключает и отключает видеотрек через attach/detach", () => {
    const track = createMockTrack();
    const publication = createMockPublication(track);

    const participant = createMockParticipant({
      isCameraEnabled: true,
      videoTrack: publication,
    });

    const { unmount } = render(<VideoTile participant={participant} />);

    expect(track.attach).toHaveBeenCalledTimes(1);

    unmount();

    expect(track.detach).toHaveBeenCalledTimes(1);
  });

  it("подключает аудиотрек удаленного собеседника, но игнорирует локальный микрофон", () => {
    const remoteAudioTrack = createMockTrack();
    const remotePub = createMockPublication(remoteAudioTrack);

    const remoteParticipant = createMockParticipant({
      isLocal: false,
      audioTrack: remotePub,
    });

    const { unmount } = render(<VideoTile participant={remoteParticipant} />);

    expect(remoteAudioTrack.attach).toHaveBeenCalledTimes(1);

    unmount();
    expect(remoteAudioTrack.detach).toHaveBeenCalledTimes(1);

    // Для локального участника
    const localAudioTrack = createMockTrack();
    const localPub = createMockPublication(localAudioTrack);
    const localParticipant = createMockParticipant({
      isLocal: true,
      audioTrack: localPub,
    });

    render(<VideoTile participant={localParticipant} />);
    expect(localAudioTrack.attach).not.toHaveBeenCalled();
  });
});
