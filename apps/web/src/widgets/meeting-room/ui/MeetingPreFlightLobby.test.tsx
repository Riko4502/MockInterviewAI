import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MeetingPreFlightLobby } from "./MeetingPreFlightLobby";

describe("MeetingPreFlightLobby", () => {
  let mockStopTrack: ReturnType<typeof vi.fn>;
  let mockStream: MediaStream;

  beforeEach(() => {
    mockStopTrack = vi.fn();
    mockStream = {
      getTracks: () => [
        { stop: mockStopTrack, enabled: true },
        { stop: mockStopTrack, enabled: true },
      ],
      getVideoTracks: () => [{ enabled: true, stop: mockStopTrack }],
      getAudioTracks: () => [{ enabled: true, stop: mockStopTrack }],
    } as unknown as MediaStream;

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("требует имя для неавторизованного гостя перед входом", async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();

    render(
      <MeetingPreFlightLobby
        sessionId="sess-123"
        sessionTitle="System Design Mock"
        isAuthenticated={false}
        onJoin={onJoin}
      />,
    );

    const nameInput = screen.getByLabelText("Ваше имя для входа");
    await user.type(nameInput, "А");

    const submitBtn = screen.getByText("Присоединиться к встрече");
    await user.click(submitBtn);

    expect(onJoin).not.toHaveBeenCalled();
    expect(
      screen.getByText("Имя должно содержать минимум 2 символа"),
    ).toBeInTheDocument();
  });

  it("останавливает медиатреки предпросмотра при успешной отправке формы", async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();

    render(
      <MeetingPreFlightLobby
        sessionId="sess-123"
        sessionTitle="System Design Mock"
        isAuthenticated={false}
        onJoin={onJoin}
      />,
    );

    const nameInput = screen.getByLabelText("Ваше имя для входа");
    await user.type(nameInput, "Александр");

    const submitBtn = screen.getByText("Присоединиться к встрече");
    await user.click(submitBtn);

    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(mockStopTrack).toHaveBeenCalled();
  });
});
