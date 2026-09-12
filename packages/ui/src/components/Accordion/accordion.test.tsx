// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Accordion } from "./accordion";

function renderAccordion({ disabled = false } = {}) {
  render(
    <Accordion type="single" collapsible disabled={disabled}>
      <Accordion.Item value="details" data-testid="item">
        <Accordion.Trigger>Interview details</Accordion.Trigger>
        <Accordion.Content>Technical interview content</Accordion.Content>
      </Accordion.Item>
    </Accordion>,
  );
}

describe("Accordion semantic colors", () => {
  afterEach(cleanup);

  it("applies semantic border and text tokens to each accordion part", () => {
    renderAccordion();

    expect(screen.getByTestId("item").className).toContain("border-border");

    const trigger = screen.getByRole("button", { name: "Interview details" });
    expect(trigger.className).toContain("text-foreground");

    const content = document.querySelector('[data-slot="accordion-content"]');
    expect(content).not.toBeNull();
    expect(content?.className).toContain("text-muted-foreground");
  });

  it("preserves the accessible open and closed states", () => {
    renderAccordion();

    const trigger = screen.getByRole("button", { name: "Interview details" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Technical interview content")).toBeDefined();

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("does not open when the accordion is disabled", () => {
    renderAccordion({ disabled: true });

    const trigger = screen.getByRole("button", { name: "Interview details" });
    expect(trigger.hasAttribute("disabled")).toBe(true);

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
