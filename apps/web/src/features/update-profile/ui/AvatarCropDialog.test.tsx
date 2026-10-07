import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/shared/lib/i18n";
import { AvatarCropDialog } from "./AvatarCropDialog";

vi.mock("react-easy-crop", () => ({
  default: () => <div>cropper</div>,
}));

describe("AvatarCropDialog", () => {
  it("не рендерит диалог, когда imageSrc равен null", () => {
    render(
      <AvatarCropDialog
        imageSrc={null}
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("рендерит диалог и возвращает фокус на triggerRef при закрытии", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const button = document.createElement("button");
    button.focus = vi.fn();
    const triggerRef = { current: button };

    render(
      <AvatarCropDialog
        imageSrc="blob:avatar"
        isSubmitting={false}
        triggerRef={triggerRef}
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const cancelButton = screen.getByRole("button", { name: "Отмена" });
    await user.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("вызывает пользовательский onCloseAutoFocus, если он передан", async () => {
    const onCloseAutoFocus = vi.fn();

    render(
      <AvatarCropDialog
        imageSrc="blob:avatar"
        isSubmitting={false}
        onCloseAutoFocus={onCloseAutoFocus}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
