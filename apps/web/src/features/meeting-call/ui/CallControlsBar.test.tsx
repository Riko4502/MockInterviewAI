import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CallControlsBar } from "./CallControlsBar";

describe("CallControlsBar", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const defaultProps = {
    isMicrophoneEnabled: true,
    isCameraEnabled: true,
    isScreenSharing: false,
    isHandRaised: false,
    isChatOpen: false,
    unreadMessagesCount: 0,
    onToggleMicrophone: vi.fn(),
    onToggleCamera: vi.fn(),
    onToggleScreenShare: vi.fn(),
    onToggleHand: vi.fn(),
    onSendReaction: vi.fn(),
    onToggleChat: vi.fn(),
    onOpenSettings: vi.fn(),
    onLeaveCall: vi.fn(),
  };

  it("вызывает onToggleMicrophone при клике на микрофон", async () => {
    const user = userEvent.setup();
    render(<CallControlsBar {...defaultProps} />);

    const micBtn = screen.getByLabelText("Выключить микрофон");
    await user.click(micBtn);

    expect(defaultProps.onToggleMicrophone).toHaveBeenCalledTimes(1);
  });

  it("вызывает onToggleCamera при клике на камеру", async () => {
    const user = userEvent.setup();
    render(<CallControlsBar {...defaultProps} />);

    const cameraBtn = screen.getByLabelText("Выключить камеру");
    await user.click(cameraBtn);

    expect(defaultProps.onToggleCamera).toHaveBeenCalledTimes(1);
  });

  it("вызывает onToggleHand при клике на поднятие руки", async () => {
    const user = userEvent.setup();
    render(<CallControlsBar {...defaultProps} />);

    const handBtn = screen.getByLabelText("Поднять руку");
    await user.click(handBtn);

    expect(defaultProps.onToggleHand).toHaveBeenCalledTimes(1);
  });

  it("отображает бейдж с количеством непрочитанных сообщений", () => {
    render(<CallControlsBar {...defaultProps} unreadMessagesCount={5} />);

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("вызывает onLeaveCall при клике на кнопку выхода для обычного участника", async () => {
    const user = userEvent.setup();
    render(<CallControlsBar {...defaultProps} isHost={false} />);

    const leaveBtn = screen.getByLabelText("Покинуть встречу");
    await user.click(leaveBtn);

    expect(defaultProps.onLeaveCall).toHaveBeenCalledTimes(1);
  });
});
