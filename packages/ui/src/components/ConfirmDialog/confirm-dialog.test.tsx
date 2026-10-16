import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

function renderDialog(
  props: Partial<ComponentProps<typeof ConfirmDialog>> = {},
) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();

  const view = render(
    <ConfirmDialog
      open
      title="Отвязать Telegram?"
      description="Сессии будут завершены."
      confirmLabel="Подтвердить отвязку"
      cancelLabel="Отмена"
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      {...props}
    />,
  );

  return { view, onOpenChange, onConfirm };
}

describe("ConfirmDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("вызывает onConfirm только по нажатию кнопки подтверждения", () => {
    const { onConfirm } = renderDialog();

    expect(screen.getByRole("dialog")).toBeDefined();
    fireEvent.click(
      screen.getByRole("button", { name: "Подтвердить отвязку" }),
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("отмена закрывает диалог и не вызывает onConfirm", () => {
    const { onOpenChange, onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("во время выполнения блокирует закрытие и кнопки", () => {
    const { onOpenChange } = renderDialog({ isPending: true });

    expect(
      screen.getByRole("button", { name: "Подтвердить отвязку" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("ждёт завершения асинхронного onConfirm перед разблокировкой", async () => {
    let resolve: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolve = res;
        }),
    );
    renderDialog({ onConfirm });

    fireEvent.click(
      screen.getByRole("button", { name: "Подтвердить отвязку" }),
    );

    expect(
      screen.getByRole("button", { name: "Подтвердить отвязку" }),
    ).toBeDisabled();

    resolve();

    await vi.waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Подтвердить отвязку" }),
      ).toBeEnabled();
    });
  });
});
