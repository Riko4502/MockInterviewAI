import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ShowcaseCardResponseDto } from "@/entities/showcase-card";
import { SendMatchRequestDialogLazy } from "./SendMatchRequestDialog.lazy";

vi.mock("./SendMatchRequestDialog", () => ({
  SendMatchRequestDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="send-match-dialog">Send Match Dialog</div> : null,
}));

describe("SendMatchRequestDialogLazy", () => {
  it("не отображает диалог при open={false}", () => {
    render(
      <SendMatchRequestDialogLazy
        card={null}
        open={false}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("send-match-dialog")).not.toBeInTheDocument();
  });

  it("рендерит диалог при open={true}", async () => {
    const mockCard = { id: "card-1" } as unknown as ShowcaseCardResponseDto;

    render(
      <SendMatchRequestDialogLazy
        card={mockCard}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(
      await screen.findByTestId("send-match-dialog", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});
