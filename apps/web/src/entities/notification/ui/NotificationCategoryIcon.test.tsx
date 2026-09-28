import { CalendarIcon, MessageSquareIcon, SettingsIcon } from "@packages/icons";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotificationCategoryIcon } from "./NotificationCategoryIcon";

const geometry = (element: React.ReactElement) => {
  const { container } = render(element);
  return container.querySelector("svg")?.innerHTML;
};

describe("NotificationCategoryIcon", () => {
  it.each([
    ["INTERVIEW", CalendarIcon],
    ["MESSAGE", MessageSquareIcon],
    ["SYSTEM", SettingsIcon],
  ] as const)("renders the %s icon", (category, Icon) => {
    expect(geometry(<NotificationCategoryIcon category={category} />)).toBe(
      geometry(<Icon />),
    );
  });

  it("stays decorative and carries its own category", () => {
    const { container } = render(
      <NotificationCategoryIcon category="MESSAGE" />,
    );
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.getAttribute("data-slot")).toBe("icon");
    expect(icon?.getAttribute("data-category")).toBe("MESSAGE");
  });

  it("forwards the class name", () => {
    const { container } = render(
      <NotificationCategoryIcon category="SYSTEM" className="size-4" />,
    );
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "size-4",
    );
  });
});
