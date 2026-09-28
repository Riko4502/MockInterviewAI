import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { SandboxVideoWidgetControls } from "./SandboxVideoWidgetControls";

const {
  setIsSettingsOpenMock,
  onStartCallMock,
  onEndCallMock,
  onToggleAudioMock,
  onToggleVideoMock,
} = vi.hoisted(() => ({
  setIsSettingsOpenMock: vi.fn(),
  onStartCallMock: vi.fn(),
  onEndCallMock: vi.fn(),
  onToggleAudioMock: vi.fn(),
  onToggleVideoMock: vi.fn(),
}));

let mockIsInCall = false;
let mockLocalStream: MediaStream | null = null;
let mockIsAudioMuted = true;
let mockIsVideoOff = true;

vi.mock("../model/SandboxMediaContext", () => ({
  useSandboxMedia: () => ({
    localStream: mockLocalStream,
    isInCall: mockIsInCall,
    isAudioMuted: mockIsAudioMuted,
    isVideoOff: mockIsVideoOff,
    isScreenSharing: false,
    connectionState: mockIsInCall ? "connected" : "idle",
    hasPeerOnline: true,
    setIsSettingsOpen: setIsSettingsOpenMock,
    onStartCall: onStartCallMock,
    onEndCall: onEndCallMock,
    onToggleAudio: onToggleAudioMock,
    onToggleVideo: onToggleVideoMock,
    onToggleScreenShare: vi.fn(),
  }),
}));

describe("SandboxVideoWidgetControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage("ru");
    mockIsInCall = false;
    mockLocalStream = null;
    mockIsAudioMuted = true;
    mockIsVideoOff = true;
  });

  it("renders start call and settings button when idle", () => {
    render(<SandboxVideoWidgetControls />);

    expect(
      screen.getByRole("button", { name: /Позвонить|Call/i }),
    ).toBeInTheDocument();

    const settingsBtn = screen.getByLabelText(
      /Настройки звука и видео|Audio & Video settings/i,
    );
    expect(settingsBtn).toBeInTheDocument();

    fireEvent.click(settingsBtn);
    expect(setIsSettingsOpenMock).toHaveBeenCalledWith(true);
  });

  it("renders call controls and settings button during an active call", () => {
    mockIsInCall = true;
    mockLocalStream = {
      getTracks: () => [],
      getAudioTracks: () => [],
      getVideoTracks: () => [],
    } as unknown as MediaStream;

    render(<SandboxVideoWidgetControls />);

    expect(
      screen.getByRole("button", { name: /Завершить|End/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Мут|Muted/i }),
    ).toBeInTheDocument();

    const settingsBtn = screen.getByLabelText(
      /Настройки звука и видео|Audio & Video settings/i,
    );
    expect(settingsBtn).toBeInTheDocument();

    fireEvent.click(settingsBtn);
    expect(setIsSettingsOpenMock).toHaveBeenCalledWith(true);
  });
});
