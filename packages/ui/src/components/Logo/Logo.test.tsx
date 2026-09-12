// @vitest-environment jsdom

import { Link } from "@components/Link";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Logo } from "./Logo";

describe("Logo Component", () => {
  afterEach(cleanup);
  it("renders with default props (variant='full', size='md', href='/')", () => {
    render(<Logo />);

    const link = screen.getByRole("link");
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/");

    // Title and Subtitle should be present in full variant
    expect(screen.getByText("DEVSYNC")).toBeDefined();
    expect(screen.getByText("Interview AI")).toBeDefined();

    // Icon container size md (w-10 h-10)
    const iconContainer = link.querySelector(".w-10.h-10");
    expect(iconContainer).not.toBeNull();
  });

  it("renders variant='icon' without text and with accessible aria-label", () => {
    render(<Logo variant="icon" href="/app" />);

    const link = screen.getByRole("link", { name: "DEVSYNC Interview AI" });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/app");
    expect(link.getAttribute("aria-label")).toBe("DEVSYNC Interview AI");

    // Brand text should not be rendered
    expect(screen.queryByText("DEVSYNC")).toBeNull();
    expect(screen.queryByText("Interview AI")).toBeNull();
  });

  it("renders size='sm' with compact dimensions", () => {
    render(<Logo size="sm" />);

    const link = screen.getByRole("link");
    expect(link.className).toContain("gap-2");

    const iconContainer = link.querySelector(".w-8.h-8");
    expect(iconContainer).not.toBeNull();

    const title = screen.getByText("DEVSYNC");
    expect(title.className).toContain("text-lg");
  });

  it("renders size='lg' with large dimensions", () => {
    render(<Logo size="lg" />);

    const link = screen.getByRole("link");
    expect(link.className).toContain("gap-3.5");

    const iconContainer = link.querySelector(".w-12.h-12");
    expect(iconContainer).not.toBeNull();

    const title = screen.getByText("DEVSYNC");
    expect(title.className).toContain("text-2xl");
  });

  it("passes custom href and className correctly", () => {
    render(<Logo href="/custom-path" className="custom-class mb-4" />);

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/custom-path");
    expect(link.className).toContain("custom-class");
    expect(link.className).toContain("mb-4");
    expect(link.className).toContain("flex");
  });

  it("supports polymorphic rendering with asChild=true", () => {
    render(
      <Logo asChild variant="full" size="md">
        <Link data-testid="custom-link" href="/dashboard" />
      </Logo>,
    );

    const link = screen.getByTestId("custom-link");
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/dashboard");
    expect(link.className).toContain("group");
    expect(screen.getByText("DEVSYNC")).toBeDefined();
  });

  it("respects custom aria-label when provided in full variant", () => {
    render(<Logo aria-label="Custom Company Name" />);

    const link = screen.getByRole("link");
    expect(link.getAttribute("aria-label")).toBe("Custom Company Name");
  });

  it("supports keyboard focus accessibility attributes", () => {
    render(<Logo href="/login" tabIndex={0} target="_blank" rel="noopener" />);

    const link = screen.getByRole("link");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener");
    expect(link.getAttribute("tabindex")).toBe("0");
    expect(link.className).toContain("focus-visible:ring-violet-500");
  });
});
