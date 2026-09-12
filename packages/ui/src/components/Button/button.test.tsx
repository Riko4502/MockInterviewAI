// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./button";

describe("Button semantic color variants", () => {
  afterEach(cleanup);

  it("uses the primary foreground token for the default button", () => {
    render(<Button>Start interview</Button>);

    const button = screen.getByRole("button", { name: "Start interview" });
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("text-primary-foreground");
    expect(button.className).toContain("hover:bg-primary/90");
    expect(button.className).not.toContain("text-background");
  });

  it("applies the same tokens when the default variant is explicit", () => {
    const classes = buttonVariants({ variant: "default" });

    expect(classes).toContain("bg-primary");
    expect(classes).toContain("text-primary-foreground");
    expect(classes).not.toContain("text-background");
  });

  it("does not leak primary foreground styling into another variant", () => {
    const classes = buttonVariants({ variant: "outline" });

    expect(classes).toContain("bg-background");
    expect(classes).not.toContain("text-primary-foreground");
  });
});
