import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/shared/lib/i18n";
import { AvatarUploadField } from "./AvatarUploadField";

const { uploadMutate, uploadState, getCroppedImageFile } = vi.hoisted(() => ({
  uploadMutate: vi.fn(),
  uploadState: {
    isPending: false,
    isError: false,
  },
  getCroppedImageFile: vi.fn(
    async () => new File(["cropped"], "avatar.jpg", { type: "image/jpeg" }),
  ),
}));

vi.mock("@/entities/user", () => ({
  UserAvatar: () => <div>avatar</div>,
}));

vi.mock("../model/use-profile-mutations", () => ({
  useUploadAvatar: () => ({
    mutate: uploadMutate,
    reset: vi.fn(),
    isPending: uploadState.isPending,
    isError: uploadState.isError,
  }),
}));

vi.mock("../lib/get-cropped-image", () => ({
  getCroppedImageFile,
}));

vi.mock("react-easy-crop", () => ({
  default: function MockCropper({
    onCropComplete,
  }: {
    onCropComplete?: (
      area: { x: number; y: number; width: number; height: number },
      pixels: { x: number; y: number; width: number; height: number },
    ) => void;
  }) {
    const onCropCompleteRef = useRef(onCropComplete);
    onCropCompleteRef.current = onCropComplete;

    useEffect(() => {
      onCropCompleteRef.current?.(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 1, y: 2, width: 40, height: 40 },
      );
    }, []);

    return <div>cropper</div>;
  },
}));

function renderField() {
  return render(
    <AvatarUploadField src={null} name="Иван" email="dev@example.com" />,
  );
}

describe("AvatarUploadField", () => {
  beforeEach(() => {
    uploadMutate.mockClear();
    getCroppedImageFile.mockClear();
    uploadState.isPending = false;
    uploadState.isError = false;
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:avatar");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  it("открывает кроппер и загружает подтверждённую область", async () => {
    const user = userEvent.setup();
    renderField();

    const input = screen.getByLabelText("Загрузить фото");
    await user.upload(
      input,
      new File(["avatar"], "photo.png", { type: "image/png" }),
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Обрезка фото")).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "Подтвердить" });
    await waitFor(() => {
      expect(confirm).toBeEnabled();
    });
    await user.click(confirm);

    await waitFor(() => {
      expect(uploadMutate).toHaveBeenCalledWith(
        {
          data: {
            file: expect.objectContaining({
              name: "avatar.jpg",
              type: "image/jpeg",
            }),
          },
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });
  });

  it("не загружает файл, если обрезку отменили", async () => {
    const user = userEvent.setup();
    renderField();

    await user.upload(
      screen.getByLabelText("Загрузить фото"),
      new File(["avatar"], "photo.png", { type: "image/png" }),
    );

    await user.click(await screen.findByRole("button", { name: "Отмена" }));

    expect(uploadMutate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("не открывает кроппер для неподдерживаемого формата", () => {
    renderField();

    fireEvent.change(screen.getByLabelText("Загрузить фото"), {
      target: {
        files: [new File(["gif"], "photo.gif", { type: "image/gif" })],
      },
    });

    expect(
      screen.getByText("Можно загрузить только JPEG, PNG или WebP."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
