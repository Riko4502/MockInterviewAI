import "@testing-library/jest-dom/vitest";
import {
  getProfileControllerGetDeviceSettingsQueryKey,
  type RequestConfig,
  resetHttpTransport,
  setHttpTransport,
} from "@packages/api";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/shared/api/query/query-client";
import i18n from "@/shared/lib/i18n";
import { getClientDeviceId } from "../model/mediaSettingsStorage";
import { QuickMediaCheckDialog } from "./QuickMediaCheckDialog";

let original: PropertyDescriptor | undefined;
let client: ReturnType<typeof createQueryClient>;
beforeEach(async () => {
  original = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
  client = createQueryClient();
  await i18n.changeLanguage("en");
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
});
afterEach(() => {
  cleanup();
  client.clear();
  resetHttpTransport();
  vi.restoreAllMocks();
  if (original) Object.defineProperty(navigator, "mediaDevices", original);
  else Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("Сохранение результатов быстрой проверки устройств", () => {
  it("показывает изображение камеры, сохраняет реальные названия устройств через существующий транспорт и освобождает дорожки", async () => {
    const user = userEvent.setup();
    const camera = { label: "Camera device", stop: vi.fn() };
    const mic = { label: "Microphone device", stop: vi.fn() };
    const cameraStream = {
      getTracks: () => [camera],
      getVideoTracks: () => [camera],
      getAudioTracks: () => [],
    } as unknown as MediaStream;
    const micStream = {
      getTracks: () => [mic],
      getVideoTracks: () => [],
      getAudioTracks: () => [mic],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async (constraints: MediaStreamConstraints) =>
          constraints.video ? cameraStream : micStream,
        ),
      },
    });
    const clientId = getClientDeviceId();
    const saved = {
      clientId,
      preferredAudioInputLabel: mic.label,
      preferredVideoInputLabel: camera.label,
    };
    const request = vi.fn(async (_config: RequestConfig) => saved);
    setHttpTransport(
      async <T,>(config: RequestConfig): Promise<T> =>
        (await request(config)) as T,
    );
    const onSaved = vi.fn();
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <QuickMediaCheckDialog open onOpenChange={vi.fn()} onSaved={onSaved} />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save checked devices" }),
      ).toBeEnabled(),
    );
    expect(
      screen.getByLabelText<HTMLVideoElement>("Camera preview").srcObject,
    ).toBe(cameraStream);
    await user.click(
      screen.getByRole("button", { name: "Save checked devices" }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/v1/profile/device-settings",
        method: "PUT",
        data: expect.objectContaining({
          clientId,
          preferredAudioInputLabel: mic.label,
          preferredVideoInputLabel: camera.label,
        }),
      }),
    );
    expect(
      client.getQueryData(
        getProfileControllerGetDeviceSettingsQueryKey({ clientId }),
      ),
    ).toEqual(saved);
    unmount();
    expect(camera.stop).toHaveBeenCalledTimes(1);
    expect(mic.stop).toHaveBeenCalledTimes(1);
  });

  it("не сохраняет настройки и не сообщает о завершении проверки при отказе в доступе", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          throw new DOMException("Denied", "NotAllowedError");
        }),
      },
    });
    const onSaved = vi.fn();
    render(
      <QueryClientProvider client={client}>
        <QuickMediaCheckDialog open onOpenChange={vi.fn()} onSaved={onSaved} />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getAllByText(/Access denied/)).toHaveLength(2),
    );
    expect(
      screen.getByRole("button", { name: "Save checked devices" }),
    ).toBeDisabled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
