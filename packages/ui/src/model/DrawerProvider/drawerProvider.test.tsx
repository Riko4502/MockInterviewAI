// @vitest-environment jsdom

import { Drawer } from "@components/Drawer";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawerProvider, useDrawer } from "./drawerProvider";

interface TestPayload {
  title: string;
  info: string;
}

function TestDrawerConsumer({
  onInit,
  explicitOpen,
  explicitOnOpenChange,
}: {
  onInit?: (controller: ReturnType<typeof useDrawer<TestPayload>>) => void;
  explicitOpen?: boolean;
  explicitOnOpenChange?: (open: boolean) => void;
}) {
  const drawer = useDrawer<TestPayload>();
  if (onInit) {
    onInit(drawer);
  }

  const payload = drawer.get("test-drawer");

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          drawer.open("test-drawer", {
            title: "Drawer Title",
            info: "Detailed Information",
          })
        }
      >
        Open Test Drawer
      </button>
      <button type="button" onClick={() => drawer.close("test-drawer")}>
        Close Test Drawer
      </button>
      <button type="button" onClick={() => drawer.allClose()}>
        Close All Drawers
      </button>

      <Drawer
        name="test-drawer"
        open={explicitOpen}
        onOpenChange={explicitOnOpenChange}
      >
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{payload?.title ?? "Default Title"}</Drawer.Title>
            <Drawer.Description>
              {payload?.info ?? "Default Description"}
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <button type="button">Custom Close</button>
            </Drawer.Close>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  );
}

describe("DrawerProvider and Drawer name binding", () => {
  afterEach(cleanup);

  it("throws error when useDrawer is used outside DrawerProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestDrawerConsumer />)).toThrow(
      "useDrawer должен использоваться внутри DrawerProvider или UIProvider",
    );
    spy.mockRestore();
  });

  it("opens and closes Drawer bound by name using drawer.open and drawer.close", () => {
    let controller!: ReturnType<typeof useDrawer<TestPayload>>;

    render(
      <DrawerProvider>
        <TestDrawerConsumer
          onInit={(c) => {
            controller = c;
          }}
        />
      </DrawerProvider>,
    );

    expect(screen.queryByText("Drawer Title")).toBeNull();
    expect(controller.isOpen("test-drawer")).toBe(false);

    // Open via hook
    act(() => {
      controller.open("test-drawer", {
        title: "Drawer Title",
        info: "Detailed Information",
      });
    });

    expect(controller.isOpen("test-drawer")).toBe(true);
    expect(screen.getByText("Drawer Title")).toBeDefined();
    expect(screen.getByText("Detailed Information")).toBeDefined();

    // Close via hook
    act(() => {
      controller.close("test-drawer");
    });

    expect(controller.isOpen("test-drawer")).toBe(false);
    expect(screen.queryByText("Drawer Title")).toBeNull();
  });

  it("closes Drawer bound by name via drawer.allClose()", () => {
    let controller!: ReturnType<typeof useDrawer<TestPayload>>;

    render(
      <DrawerProvider>
        <TestDrawerConsumer
          onInit={(c) => {
            controller = c;
          }}
        />
      </DrawerProvider>,
    );

    act(() => {
      controller.open("test-drawer", {
        title: "Drawer Title",
        info: "Detailed Information",
      });
    });

    expect(screen.getByText("Drawer Title")).toBeDefined();

    act(() => {
      controller.allClose();
    });

    expect(controller.isOpen("test-drawer")).toBe(false);
    expect(screen.queryByText("Drawer Title")).toBeNull();
  });

  it("syncs state to DrawerProvider when closed via Drawer.Close button", () => {
    let controller!: ReturnType<typeof useDrawer<TestPayload>>;

    render(
      <DrawerProvider>
        <TestDrawerConsumer
          onInit={(c) => {
            controller = c;
          }}
        />
      </DrawerProvider>,
    );

    act(() => {
      controller.open("test-drawer", {
        title: "Drawer Title",
        info: "Detailed Information",
      });
    });

    expect(controller.isOpen("test-drawer")).toBe(true);
    expect(screen.getByText("Drawer Title")).toBeDefined();

    const closeBtn = screen.getByText("Custom Close");
    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(controller.isOpen("test-drawer")).toBe(false);
    expect(screen.queryByText("Drawer Title")).toBeNull();
  });

  it("prioritizes explicit open prop over name binding", () => {
    let controller!: ReturnType<typeof useDrawer<TestPayload>>;

    render(
      <DrawerProvider>
        <TestDrawerConsumer
          explicitOpen={false}
          onInit={(c) => {
            controller = c;
          }}
        />
      </DrawerProvider>,
    );

    act(() => {
      controller.open("test-drawer", {
        title: "Drawer Title",
        info: "Detailed Information",
      });
    });

    // Despite controller having isOpen("test-drawer") === true, explicitOpen={false} keeps it closed
    expect(controller.isOpen("test-drawer")).toBe(true);
    expect(screen.queryByText("Drawer Title")).toBeNull();
  });

  it("prioritizes explicit onOpenChange prop over name binding", () => {
    const explicitOnOpenChange = vi.fn();
    let controller!: ReturnType<typeof useDrawer<TestPayload>>;

    render(
      <DrawerProvider>
        <TestDrawerConsumer
          explicitOnOpenChange={explicitOnOpenChange}
          onInit={(c) => {
            controller = c;
          }}
        />
      </DrawerProvider>,
    );

    act(() => {
      controller.open("test-drawer", {
        title: "Drawer Title",
        info: "Detailed Information",
      });
    });

    const closeBtn = screen.getByText("Custom Close");
    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(explicitOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders Drawer without name or provider without error", () => {
    render(
      <Drawer defaultOpen>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Standalone Drawer</Drawer.Title>
          </Drawer.Header>
        </Drawer.Content>
      </Drawer>,
    );

    expect(screen.getByText("Standalone Drawer")).toBeDefined();
  });
});
