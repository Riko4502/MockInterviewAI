import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Resizable } from "./resizable";

describe("Resizable Component", () => {
  beforeAll(() => {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(cleanup);

  it("renders horizontal group and handle with data-orientation='horizontal' by default", () => {
    const { container } = render(
      <Resizable>
        <Resizable.Panel defaultSize="50">
          <div>Panel 1</div>
        </Resizable.Panel>
        <Resizable.Handle withHandle />
        <Resizable.Panel defaultSize="50">
          <div>Panel 2</div>
        </Resizable.Panel>
      </Resizable>,
    );

    const group = container.querySelector(
      '[data-slot="resizable-panel-group"]',
    );
    expect(group).not.toBeNull();
    expect(group?.getAttribute("data-orientation")).toBe("horizontal");

    const handle = container.querySelector('[data-slot="resizable-handle"]');
    expect(handle).not.toBeNull();
    expect(handle?.getAttribute("data-orientation")).toBe("horizontal");

    // Grip should be rendered
    const grip = container.querySelector('[data-slot="resizable-handle-grip"]');
    expect(grip).not.toBeNull();
  });

  it("renders vertical group and handle with data-orientation='vertical' when orientation='vertical'", () => {
    const { container } = render(
      <Resizable orientation="vertical">
        <Resizable.Panel defaultSize="60">
          <div>Top</div>
        </Resizable.Panel>
        <Resizable.Handle />
        <Resizable.Panel defaultSize="40">
          <div>Bottom</div>
        </Resizable.Panel>
      </Resizable>,
    );

    const group = container.querySelector(
      '[data-slot="resizable-panel-group"]',
    );
    expect(group?.getAttribute("data-orientation")).toBe("vertical");

    const handle = container.querySelector('[data-slot="resizable-handle"]');
    expect(handle?.getAttribute("data-orientation")).toBe("vertical");
  });

  it("supports direction='vertical' as an alias for orientation='vertical'", () => {
    const { container } = render(
      <Resizable direction="vertical">
        <Resizable.Panel defaultSize="60">
          <div>Top</div>
        </Resizable.Panel>
        <Resizable.Handle />
        <Resizable.Panel defaultSize="40">
          <div>Bottom</div>
        </Resizable.Panel>
      </Resizable>,
    );

    const group = container.querySelector(
      '[data-slot="resizable-panel-group"]',
    );
    expect(group?.getAttribute("data-orientation")).toBe("vertical");

    const handle = container.querySelector('[data-slot="resizable-handle"]');
    expect(handle?.getAttribute("data-orientation")).toBe("vertical");
  });

  it("correctly scopes orientation in nested groups", () => {
    const { container } = render(
      <Resizable direction="horizontal">
        <Resizable.Panel defaultSize="30">
          <div>Left</div>
        </Resizable.Panel>
        <Resizable.Handle id="handle-horizontal" />
        <Resizable.Panel defaultSize="70">
          <Resizable direction="vertical">
            <Resizable.Panel defaultSize="50">
              <div>Top Right</div>
            </Resizable.Panel>
            <Resizable.Handle id="handle-vertical" />
            <Resizable.Panel defaultSize="50">
              <div>Bottom Right</div>
            </Resizable.Panel>
          </Resizable>
        </Resizable.Panel>
      </Resizable>,
    );

    const handles = container.querySelectorAll(
      '[data-slot="resizable-handle"]',
    );
    expect(handles.length).toBe(2);

    expect(handles[0].getAttribute("data-orientation")).toBe("horizontal");
    expect(handles[1].getAttribute("data-orientation")).toBe("vertical");
  });
});
