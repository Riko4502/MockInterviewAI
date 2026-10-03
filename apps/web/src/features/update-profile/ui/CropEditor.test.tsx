import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import "@/shared/lib/i18n";
import { Dialog } from "@packages/ui";
import { CropEditor } from "./CropEditor";

let capturedMediaProps: { onError?: () => void } | undefined;

vi.mock("react-easy-crop", () => ({
  default: (props: { mediaProps?: { onError?: () => void } }) => {
    capturedMediaProps = props.mediaProps;
    return <div data-testid="mock-cropper">cropper</div>;
  },
}));

function renderEditor(props: Partial<ComponentProps<typeof CropEditor>> = {}) {
  return render(
    <Dialog open={true}>
      <CropEditor
        imageSrc="blob:test-image"
        isSubmitting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        {...props}
      />
    </Dialog>,
  );
}

describe("CropEditor", () => {
  it("показывает ошибку и блокирует зум при ошибке загрузки изображения через mediaProps.onError", () => {
    renderEditor();

    expect(
      screen.queryByText("Не удалось загрузить аватар."),
    ).not.toBeInTheDocument();

    act(() => {
      capturedMediaProps?.onError?.();
    });

    expect(
      screen.getByText("Не удалось загрузить аватар."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Масштаб")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Подтвердить" })).toBeDisabled();
  });

  it("вызывает onCancel при нажатии кнопки Отмена", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderEditor({ onCancel });

    await user.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
