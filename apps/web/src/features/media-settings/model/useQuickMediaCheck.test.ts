import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQuickMediaCheck } from "./useQuickMediaCheck";

function stream(kind: "camera" | "microphone") {
  const track = { label: kind, stop: vi.fn() };
  return {
    track,
    value: {
      getTracks: () => [track],
      getVideoTracks: () => (kind === "camera" ? [track] : []),
      getAudioTracks: () => (kind === "microphone" ? [track] : []),
    } as unknown as MediaStream,
  };
}
let original: PropertyDescriptor | undefined;
beforeEach(() => {
  original = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
});
afterEach(() => {
  cleanup();
  if (original) Object.defineProperty(navigator, "mediaDevices", original);
  else Reflect.deleteProperty(navigator, "mediaDevices");
});
function mockDevices(
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
}
describe("Жизненный цикл быстрой проверки устройств", () => {
  it("останавливает дорожки камеры и микрофона при закрытии", async () => {
    const camera = stream("camera");
    const mic = stream("microphone");
    mockDevices(async (constraints) =>
      constraints.video ? camera.value : mic.value,
    );
    const { result, rerender } = renderHook(
      ({ open }) => useQuickMediaCheck(open),
      { initialProps: { open: true } },
    );
    await waitFor(() =>
      expect(result.current.microphone.status).toBe("granted"),
    );
    expect(result.current.camera.status).toBe("granted");
    rerender({ open: false });
    expect(camera.track.stop).toHaveBeenCalledTimes(1);
    expect(mic.track.stop).toHaveBeenCalledTimes(1);
  });
  it("останавливает дорожки, полученные после размонтирования во время ожидания разрешения", async () => {
    const camera = stream("camera");
    const mic = stream("microphone");
    const pending = new Map<string, (value: MediaStream) => void>();
    mockDevices(
      (constraints) =>
        new Promise((resolve) => {
          pending.set(constraints.video ? "camera" : "microphone", resolve);
        }),
    );
    const { unmount } = renderHook(() => useQuickMediaCheck(true));
    unmount();
    await act(async () => {
      pending.get("camera")?.(camera.value);
      pending.get("microphone")?.(mic.value);
    });
    expect(camera.track.stop).toHaveBeenCalledTimes(1);
    expect(mic.track.stop).toHaveBeenCalledTimes(1);
  });
  it("различает отказ в доступе и отсутствие устройств", async () => {
    mockDevices(async (constraints) => {
      throw new DOMException(
        "Unavailable",
        constraints.video ? "NotAllowedError" : "NotFoundError",
      );
    });
    const { result } = renderHook(() => useQuickMediaCheck(true));
    await waitFor(() => expect(result.current.camera.status).toBe("denied"));
    expect(result.current.microphone.status).toBe("missing");
  });
  it("освобождает старые потоки при повторной проверке и новые при размонтировании", async () => {
    const created: ReturnType<typeof stream>[] = [];
    mockDevices(async (constraints) => {
      const next = stream(constraints.video ? "camera" : "microphone");
      created.push(next);
      return next.value;
    });
    const { result, unmount } = renderHook(() => useQuickMediaCheck(true));
    await waitFor(() =>
      expect(result.current.microphone.status).toBe("granted"),
    );
    act(() => result.current.retry());
    await waitFor(() => expect(created).toHaveLength(4));
    expect(created[0].track.stop).toHaveBeenCalledTimes(1);
    expect(created[1].track.stop).toHaveBeenCalledTimes(1);
    unmount();
    expect(created[2].track.stop).toHaveBeenCalledTimes(1);
    expect(created[3].track.stop).toHaveBeenCalledTimes(1);
  });
  it("обрабатывает неподдерживаемые браузеры без запроса доступа", () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useQuickMediaCheck(true));
    expect(result.current.camera.status).toBe("unsupported");
    expect(result.current.microphone.status).toBe("unsupported");
  });
});
