import { describe, expect, it } from "vitest";
import {
  selectContentVariants,
  selectItemVariants,
  selectTriggerVariants,
} from "./constants";

describe("Select semantic color variants", () => {
  it("uses primary foreground tokens throughout the primary variant", () => {
    const trigger = selectTriggerVariants({ variant: "primary" });
    const content = selectContentVariants({ variant: "primary" });
    const item = selectItemVariants({ variant: "primary" });

    expect(trigger).toContain("bg-primary");
    expect(trigger).toContain("text-primary-foreground");
    expect(content).toContain("bg-primary");
    expect(content).toContain("text-primary-foreground");
    expect(item).toContain("focus:bg-primary-foreground/20");
    expect(item).toContain("focus:text-primary-foreground");
  });

  it("does not retain the legacy background-based foreground classes", () => {
    const primaryClasses = [
      selectTriggerVariants({ variant: "primary" }),
      selectContentVariants({ variant: "primary" }),
      selectItemVariants({ variant: "primary" }),
    ];

    for (const classes of primaryClasses) {
      expect(classes).not.toMatch(/(?:^|:)text-background(?:\s|$)/);
      expect(classes).not.toContain("focus:bg-background/20");
    }
  });

  it("keeps default and secondary variants scoped to their own tokens", () => {
    expect(selectTriggerVariants()).toContain("border-input");
    expect(selectContentVariants()).toContain("bg-popover");
    expect(selectItemVariants()).toContain("focus:bg-accent");

    expect(selectTriggerVariants({ variant: "secondary" })).toContain(
      "text-secondary-foreground",
    );
    expect(selectContentVariants({ variant: "secondary" })).toContain(
      "text-secondary-foreground",
    );
    expect(selectItemVariants({ variant: "secondary" })).toContain(
      "focus:text-secondary-foreground",
    );
  });
});
