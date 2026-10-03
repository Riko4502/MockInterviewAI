import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaSettingsDialogLazy } from "./MediaSettingsDialog.lazy";

vi.mock("./MediaSettingsDialog", () => ({
  MediaSettingsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="media-settings-dialog">Media Settings</div> : null,
}));

describe("MediaSettingsDialogLazy", () => {
  it("renders lazy loaded MediaSettingsDialog when open={true}", async () => {
    render(<MediaSettingsDialogLazy open={true} onOpenChange={vi.fn()} />);

    expect(
      await screen.findByTestId("media-settings-dialog", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it("does not render dialog content when open={false}", () => {
    render(<MediaSettingsDialogLazy open={false} onOpenChange={vi.fn()} />);

    expect(
      screen.queryByTestId("media-settings-dialog"),
    ).not.toBeInTheDocument();
  });
});
