import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SandboxVideoWidgetScreen } from "./SandboxVideoWidgetScreen";

const mockUseSandboxMedia = vi.fn();

vi.mock("../model/SandboxMediaContext", () => ({
  useSandboxMedia: () => mockUseSandboxMedia(),
}));

vi.mock("../lib/useAudioVolumeMeter", () => ({
  useAudioVolumeMeter: () => 0,
}));

describe("SandboxVideoWidgetScreen autoplay recovery", () => {
  const fakeRemoteStream = { id: "remote-stream-1" } as unknown as MediaStream;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("не отображает кнопку разблокировки, если autoplay прошел успешно", async () => {
    const playSpy = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(
      playSpy,
    );

    mockUseSandboxMedia.mockReturnValue({
      localStream: null,
      remoteStream: fakeRemoteStream,
      connectionState: "connected",
      isInCall: true,
      isAudioMuted: false,
      isVideoOff: false,
      isRemoteVideoOff: false,
      isRemoteAudioMuted: false,
      callError: null,
      peerName: "Partner",
      hasPeerOnline: true,
      onCopyInvite: vi.fn(),
      isInviteCopied: false,
    });

    render(<SandboxVideoWidgetScreen />);

    await waitFor(() => {
      expect(playSpy).toHaveBeenCalled();
    });

    expect(
      screen.queryByTestId("unmute-autoplay-button"),
    ).not.toBeInTheDocument();
  });

  it("сохраняет состояние блокировки и отображает кнопку восстановления при отклонении play()", async () => {
    const playSpy = vi
      .fn()
      .mockRejectedValue(
        new DOMException(
          "play() failed because the user didn't interact first.",
          "NotAllowedError",
        ),
      );
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(
      playSpy,
    );

    mockUseSandboxMedia.mockReturnValue({
      localStream: null,
      remoteStream: fakeRemoteStream,
      connectionState: "connected",
      isInCall: true,
      isAudioMuted: false,
      isVideoOff: false,
      isRemoteVideoOff: false,
      isRemoteAudioMuted: false,
      callError: null,
      peerName: "Partner",
      hasPeerOnline: true,
      onCopyInvite: vi.fn(),
      isInviteCopied: false,
    });

    render(<SandboxVideoWidgetScreen />);

    const unmuteButton = await screen.findByTestId("unmute-autoplay-button");
    expect(unmuteButton).toBeInTheDocument();
    expect(unmuteButton).toHaveTextContent(
      /Включить звук собеседника|Enable peer audio/i,
    );
  });

  it("повторно вызывает play() из обработчика клика и скрывает кнопку после успешного воспроизведения", async () => {
    let playCallCount = 0;
    const playSpy = vi.fn().mockImplementation(() => {
      playCallCount++;
      if (playCallCount === 1) {
        return Promise.reject(
          new DOMException("Autoplay blocked", "NotAllowedError"),
        );
      }
      return Promise.resolve();
    });

    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(
      playSpy,
    );

    mockUseSandboxMedia.mockReturnValue({
      localStream: null,
      remoteStream: fakeRemoteStream,
      connectionState: "connected",
      isInCall: true,
      isAudioMuted: false,
      isVideoOff: false,
      isRemoteVideoOff: false,
      isRemoteAudioMuted: false,
      callError: null,
      peerName: "Partner",
      hasPeerOnline: true,
      onCopyInvite: vi.fn(),
      isInviteCopied: false,
    });

    render(<SandboxVideoWidgetScreen />);

    const unmuteButton = await screen.findByTestId("unmute-autoplay-button");
    expect(unmuteButton).toBeInTheDocument();

    // Кликаем по кнопке в рамках пользовательского жеста
    fireEvent.click(unmuteButton);

    await waitFor(() => {
      const audioPlays = playSpy.mock.instances.filter(
        (inst) => inst instanceof HTMLAudioElement,
      );
      expect(audioPlays).toHaveLength(2);
      expect(
        screen.queryByTestId("unmute-autoplay-button"),
      ).not.toBeInTheDocument();
    });
  });

  it("отображает локализованное сообщение об ошибке и не выводит техническую ошибку callError пользователю", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mockUseSandboxMedia.mockReturnValue({
      localStream: null,
      remoteStream: null,
      connectionState: "idle",
      isInCall: false,
      isAudioMuted: false,
      isVideoOff: false,
      isRemoteVideoOff: false,
      isRemoteAudioMuted: false,
      callError: "RTCPeerConnection: sdp malformed at line 42",
      peerName: "Partner",
      hasPeerOnline: true,
      onCopyInvite: vi.fn(),
      isInviteCopied: false,
    });

    render(<SandboxVideoWidgetScreen />);

    // Пользователю показывается только общее локализованное сообщение
    expect(
      screen.getByText(
        /Не удалось установить видеосвязь|Failed to establish call connection/i,
      ),
    ).toBeInTheDocument();

    // Техническая деталь не должна быть представлена в UI
    expect(
      screen.queryByText("RTCPeerConnection: sdp malformed at line 42"),
    ).not.toBeInTheDocument();

    // Техническая ошибка зафиксирована в журнале (console.error)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[SandboxVideoWidgetScreen] Call error occurred:",
      "RTCPeerConnection: sdp malformed at line 42",
    );

    consoleErrorSpy.mockRestore();
  });
});
