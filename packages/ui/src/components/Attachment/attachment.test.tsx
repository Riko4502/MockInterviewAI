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

  it("renders progress bar with progressbar accessibility semantics when uploading", () => {
    const { container } = render(
      <Attachment status="uploading">
        <Attachment.Info>
          <Attachment.Name>uploading.zip</Attachment.Name>
        </Attachment.Info>
        <Attachment.Progress value={75} />
      </Attachment>,
    );

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeDefined();
    expect(progressbar.getAttribute("aria-valuenow")).toBe("75");
    expect(progressbar.getAttribute("aria-valuemin")).toBe("0");
    expect(progressbar.getAttribute("aria-valuemax")).toBe("100");
    expect(progressbar.getAttribute("aria-label")).toBe("Прогресс загрузки");

    const progressBarInner = container.querySelector(
      "[data-slot='attachment-progress'] > div",
    ) as HTMLElement;
    expect(progressBarInner).not.toBeNull();
    expect(progressBarInner.style.width).toBe("75%");
  });

  it("does not allow custom props to override computed progressbar ARIA attributes", () => {
    render(
      <Attachment status="uploading">
        <Attachment.Progress
          value={75}
          role="button"
          aria-valuenow={200}
          aria-valuemin={50}
          aria-valuemax={500}
        />
      </Attachment>,
    );

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeDefined();
    expect(progressbar.getAttribute("aria-valuenow")).toBe("75");
    expect(progressbar.getAttribute("aria-valuemin")).toBe("0");
    expect(progressbar.getAttribute("aria-valuemax")).toBe("100");
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

  describe("Attachment.Trigger", () => {
    it("calls onFilesSelected with selected files when files are chosen", () => {
      const handleFilesSelected = vi.fn();
      const { container } = render(
        <Attachment.Trigger onFilesSelected={handleFilesSelected} />,
      );

      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(input).not.toBeNull();

      const file = new File(["hello world"], "test.txt", {
        type: "text/plain",
      });

      fireEvent.change(input, { target: { files: [file] } });

      expect(handleFilesSelected).toHaveBeenCalledTimes(1);
      expect(handleFilesSelected).toHaveBeenCalledWith([file]);
    });

    it("ignores empty file selection and does not call onFilesSelected", () => {
      const handleFilesSelected = vi.fn();
      const { container } = render(
        <Attachment.Trigger onFilesSelected={handleFilesSelected} />,
      );

      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(input).not.toBeNull();

      fireEvent.change(input, { target: { files: [] } });

      expect(handleFilesSelected).not.toHaveBeenCalled();
    });

    it("resets input.value to empty string after processing", () => {
      const handleFilesSelected = vi.fn();
      const { container } = render(
        <Attachment.Trigger onFilesSelected={handleFilesSelected} />,
      );

      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      let valueSet = "initial";
      const valueSetter = vi.fn((val: string) => {
        valueSet = val;
      });

      Object.defineProperty(input, "value", {
        set: valueSetter,
        get: () => valueSet,
        configurable: true,
      });

      const file = new File(["content"], "example.pdf", {
        type: "application/pdf",
      });

      fireEvent.change(input, { target: { files: [file] } });

      expect(valueSetter).toHaveBeenCalledWith("");
    });

    it("triggers file input click when trigger button is clicked", () => {
      const handleClick = vi.fn();
      const { container } = render(
        <Attachment.Trigger onClick={handleClick} />,
      );

      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const inputClickSpy = vi.spyOn(input, "click");

      const button = screen.getByRole("button", { name: "Прикрепить файл" });
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(inputClickSpy).toHaveBeenCalledTimes(1);
    });
  });
});
