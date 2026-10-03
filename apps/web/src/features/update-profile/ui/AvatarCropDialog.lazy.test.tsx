import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AvatarCropDialogLazy } from "./AvatarCropDialog.lazy";

vi.mock("./AvatarCropDialog", () => ({
  AvatarCropDialog: ({ imageSrc }: { imageSrc: string | null }) =>
    imageSrc ? (
      <div data-testid="avatar-crop-dialog">Avatar Cropper</div>
    ) : null,
}));

describe("AvatarCropDialogLazy", () => {
  it("не рендерит диалог, когда imageSrc равен null", () => {
    render(
      <AvatarCropDialogLazy
        imageSrc={null}
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("avatar-crop-dialog")).not.toBeInTheDocument();
  });

  it("рендерит диалог, когда передан imageSrc", async () => {
    render(
      <AvatarCropDialogLazy
        imageSrc="blob:avatar"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      await screen.findByTestId("avatar-crop-dialog", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});
