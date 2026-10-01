import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCroppedImageFile } from "./get-cropped-image";

class MockImage {
  private listeners = new Map<string, Array<() => void>>();

  addEventListener(type: string, listener: () => void) {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  set src(_value: string) {
    for (const listener of this.listeners.get("load") ?? []) {
      listener();
    }
  }
}

describe("getCroppedImageFile", () => {
  const drawImage = vi.fn();
  const fillRect = vi.fn();

  let mockContext: {
    drawImage: typeof drawImage;
    fillRect: typeof fillRect;
    fillStyle: string;
  };

  beforeEach(() => {
    drawImage.mockClear();
    fillRect.mockClear();
    vi.stubGlobal("Image", MockImage);
    mockContext = {
      drawImage,
      fillRect,
      fillStyle: "",
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      mockContext as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => {
        callback?.(new Blob(["jpeg"], { type: "image/jpeg" }));
      },
    );
  });

  it("возвращает квадратный jpeg выбранной области", async () => {
    const file = await getCroppedImageFile("blob:avatar", {
      x: 10,
      y: 20,
      width: 80,
      height: 80,
    });

    expect(mockContext.fillStyle).toBe("#ffffff");
    expect(fillRect).toHaveBeenCalledWith(0, 0, 400, 400);
    expect(drawImage).toHaveBeenCalledWith(
      expect.any(MockImage),
      10,
      20,
      80,
      80,
      0,
      0,
      400,
      400,
    );
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("avatar.jpg");
    expect(file.type).toBe("image/jpeg");
  });
});
