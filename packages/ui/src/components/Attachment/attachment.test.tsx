// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Attachment } from "./attachment";

describe("Attachment Component", () => {
  afterEach(cleanup);

  it("renders attachment with name and size", () => {
    render(
      <Attachment>
        <Attachment.Preview extension="ts" />
        <Attachment.Info>
          <Attachment.Name>test-file.ts</Attachment.Name>
          <Attachment.Size>12 KB</Attachment.Size>
        </Attachment.Info>
      </Attachment>,
    );

    expect(screen.getByText("test-file.ts")).toBeDefined();
    expect(screen.getByText("12 KB")).toBeDefined();
  });

  it("calls onRemove when remove button is clicked", () => {
    const handleRemove = vi.fn();

    render(
      <Attachment>
        <Attachment.Info>
          <Attachment.Name>document.pdf</Attachment.Name>
        </Attachment.Info>
        <Attachment.Remove onRemove={handleRemove} />
      </Attachment>,
    );

    const removeBtn = screen.getByRole("button", { name: "Удалить файл" });
    fireEvent.click(removeBtn);

    expect(handleRemove).toHaveBeenCalledTimes(1);
  });

  it("renders progress bar when uploading", () => {
    const { container } = render(
      <Attachment status="uploading">
        <Attachment.Info>
          <Attachment.Name>uploading.zip</Attachment.Name>
        </Attachment.Info>
        <Attachment.Progress value={75} />
      </Attachment>,
    );

    const progressBar = container.querySelector(
      "[data-slot='attachment-progress'] > div",
    ) as HTMLElement;
    expect(progressBar).not.toBeNull();
    expect(progressBar.style.width).toBe("75%");
  });

  it("renders image preview when src is provided", () => {
    render(
      <Attachment>
        <Attachment.Preview
          src="https://example.com/image.png"
          alt="Preview Image"
        />
      </Attachment>,
    );

    const img = screen.getByRole("img", { name: "Preview Image" });
    expect(img).toBeDefined();
    expect(img.getAttribute("src")).toBe("https://example.com/image.png");
  });
});
