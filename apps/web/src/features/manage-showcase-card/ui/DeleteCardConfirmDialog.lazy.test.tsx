import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteCardConfirmDialogLazy } from "./DeleteCardConfirmDialog.lazy";

vi.mock("./DeleteCardConfirmDialog", () => ({
  DeleteCardConfirmDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="delete-card-dialog">Delete Dialog</div> : null,
}));

describe("DeleteCardConfirmDialogLazy", () => {
  it("не отображает диалог при open={false}", () => {
    render(
      <DeleteCardConfirmDialogLazy
        cardId={null}
        open={false}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("delete-card-dialog")).not.toBeInTheDocument();
  });

  it("рендерит диалог при open={true}", async () => {
    render(
      <DeleteCardConfirmDialogLazy
        cardId="card-123"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(
      await screen.findByTestId("delete-card-dialog", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});
