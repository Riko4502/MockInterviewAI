import { describe, expect, it } from "vitest";
import { cn } from "@/cn";

describe("cn", () => {
  it("should merge basic classes", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("should resolve tailwind class conflicts correctly", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });

  it("should handle conditional and falsy values", () => {
    expect(
      cn("base", false && "hidden", null, undefined, 0 && "zero", "active"),
    ).toBe("base active");
  });

  it("should handle array and object inputs", () => {
    expect(cn(["flex", { "items-center": true, hidden: false }])).toBe(
      "flex items-center",
    );
  });
});
