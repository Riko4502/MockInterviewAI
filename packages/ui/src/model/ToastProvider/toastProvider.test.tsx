import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components";
import { ToastProvider, useToast } from "./toastProvider";

function TestComponent({
  onInit,
}: {
  onInit?: (controller: ReturnType<typeof useToast>) => void;
}) {
  const toast = useToast();
  if (onInit) {
    onInit(toast);
  }

  return (
    <div>
      <Button
        type="button"
        onClick={() => {
          toast.push({
            id: "toast-1",
            title: "First Notification",
            description: "Description 1",
          });
        }}
      >
        Push 1
      </Button>
      <Button
        type="button"
        onClick={() => {
          toast.push({
            id: "toast-2",
            title: "Second Notification",
            description: "Description 2",
          });
        }}
      >
        Push 2
      </Button>
      <Button type="button" onClick={() => toast.dismiss("toast-1")}>
        Dismiss 1
      </Button>
      <Button type="button" onClick={() => toast.dismiss("toast-2")}>
        Dismiss 2
      </Button>
      <Button type="button" onClick={() => toast.allDismiss()}>
        Dismiss All
      </Button>
    </div>
  );
}

describe("ToastProvider and useToast", () => {
  afterEach(cleanup);

  it("throws error when useToast is used outside ToastProvider", () => {
    // Suppress console.error for expected thrown error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow(
      "useToast должен использоваться внутри ToastProvider или UIProvider",
    );
    spy.mockRestore();
  });

  it("renders pushed toasts with title and description", () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByText("Push 1"));
    });

    expect(screen.getByText("First Notification")).toBeDefined();
    expect(screen.getByText("Description 1")).toBeDefined();
  });

  it("handles individual dismissal via dismiss(id) and triggers onClose exactly once", () => {
    const onClose1 = vi.fn();
    const onClose2 = vi.fn();

    let controller!: ReturnType<typeof useToast>;

    render(
      <ToastProvider>
        <TestComponent
          onInit={(c) => {
            controller = c;
          }}
        />
      </ToastProvider>,
    );

    act(() => {
      controller.push({
        id: "toast-a",
        title: "Toast A",
        onClose: onClose1,
      });

      controller.push({
        id: "toast-b",
        title: "Toast B",
        onClose: onClose2,
      });
    });

    expect(screen.getByText("Toast A")).toBeDefined();
    expect(screen.getByText("Toast B")).toBeDefined();

    // Dismiss only toast-a
    act(() => {
      controller.dismiss("toast-a");
    });

    expect(onClose1).toHaveBeenCalledTimes(1);
    expect(onClose2).not.toHaveBeenCalled();
    expect(screen.queryByText("Toast A")).toBeNull();
    expect(screen.getByText("Toast B")).toBeDefined();

    // Dismissing non-existent or already dismissed id does not re-trigger onClose
    act(() => {
      controller.dismiss("toast-a");
      controller.dismiss("non-existent-id");
    });
    expect(onClose1).toHaveBeenCalledTimes(1);
  });

  it("handles mass dismissal via allDismiss() and triggers onClose for all active toasts", () => {
    const onClose1 = vi.fn();
    const onClose2 = vi.fn();
    const onClose3 = vi.fn();

    let controller!: ReturnType<typeof useToast>;

    render(
      <ToastProvider>
        <TestComponent
          onInit={(c) => {
            controller = c;
          }}
        />
      </ToastProvider>,
    );

    act(() => {
      controller.push({ id: "t-1", title: "Toast 1", onClose: onClose1 });
      controller.push({ id: "t-2", title: "Toast 2", onClose: onClose2 });
      controller.push({ id: "t-3", title: "Toast 3", onClose: onClose3 });
    });

    expect(screen.getByText("Toast 1")).toBeDefined();
    expect(screen.getByText("Toast 2")).toBeDefined();
    expect(screen.getByText("Toast 3")).toBeDefined();

    // Dismiss all
    act(() => {
      controller.allDismiss();
    });

    expect(onClose1).toHaveBeenCalledTimes(1);
    expect(onClose2).toHaveBeenCalledTimes(1);
    expect(onClose3).toHaveBeenCalledTimes(1);

    expect(screen.queryByText("Toast 1")).toBeNull();
    expect(screen.queryByText("Toast 2")).toBeNull();
    expect(screen.queryByText("Toast 3")).toBeNull();
  });

  it("handles dismiss() without arguments to dismiss all active toasts", () => {
    const onClose1 = vi.fn();
    const onClose2 = vi.fn();

    let controller!: ReturnType<typeof useToast>;

    render(
      <ToastProvider>
        <TestComponent
          onInit={(c) => {
            controller = c;
          }}
        />
      </ToastProvider>,
    );

    act(() => {
      controller.push({ id: "t-1", title: "Toast 1", onClose: onClose1 });
      controller.push({ id: "t-2", title: "Toast 2", onClose: onClose2 });
    });

    act(() => {
      controller.dismiss();
    });

    expect(onClose1).toHaveBeenCalledTimes(1);
    expect(onClose2).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Toast 1")).toBeNull();
    expect(screen.queryByText("Toast 2")).toBeNull();
  });

  it("triggers onClose and removes toast when close button is clicked", () => {
    const onClose = vi.fn();

    let controller!: ReturnType<typeof useToast>;

    render(
      <ToastProvider>
        <TestComponent
          onInit={(c) => {
            controller = c;
          }}
        />
      </ToastProvider>,
    );

    act(() => {
      controller.push({
        id: "toast-close-btn",
        title: "Closable Toast",
        showCloseButton: true,
        onClose,
      });
    });

    expect(screen.getByText("Closable Toast")).toBeDefined();

    const closeButton = screen.getByRole("button", {
      name: "Закрыть уведомление",
    });

    act(() => {
      fireEvent.click(closeButton);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Closable Toast")).toBeNull();
  });

  it("supports action button callback", () => {
    const onActionClick = vi.fn();

    let controller!: ReturnType<typeof useToast>;

    render(
      <ToastProvider>
        <TestComponent
          onInit={(c) => {
            controller = c;
          }}
        />
      </ToastProvider>,
    );

    act(() => {
      controller.push({
        id: "toast-action",
        title: "Action Toast",
        action: {
          label: "Retry",
          onClick: onActionClick,
        },
      });
    });

    const actionButton = screen.getByRole("button", { name: "Retry" });

    act(() => {
      fireEvent.click(actionButton);
    });

    expect(onActionClick).toHaveBeenCalledTimes(1);
  });

  it("calls onClose exactly once when rendered in React.StrictMode", () => {
    const onClose1 = vi.fn();
    const onClose2 = vi.fn();

    let controller!: ReturnType<typeof useToast>;

    render(
      <StrictMode>
        <ToastProvider>
          <TestComponent
            onInit={(c) => {
              controller = c;
            }}
          />
        </ToastProvider>
      </StrictMode>,
    );

    act(() => {
      controller.push({
        id: "strict-toast-1",
        title: "Strict Toast 1",
        onClose: onClose1,
      });
      controller.push({
        id: "strict-toast-2",
        title: "Strict Toast 2",
        onClose: onClose2,
      });
    });

    expect(screen.getByText("Strict Toast 1")).toBeDefined();
    expect(screen.getByText("Strict Toast 2")).toBeDefined();

    // Dismiss one toast
    act(() => {
      controller.dismiss("strict-toast-1");
    });

    expect(onClose1).toHaveBeenCalledTimes(1);
    expect(onClose2).not.toHaveBeenCalled();

    // Dismiss all remaining
    act(() => {
      controller.allDismiss();
    });

    expect(onClose2).toHaveBeenCalledTimes(1);
  });

  it("handles push and dismiss within the same batch without leaving toast open", () => {
    let controller!: ReturnType<typeof useToast>;

    render(
      <ToastProvider>
        <TestComponent
          onInit={(c) => {
            controller = c;
          }}
        />
      </ToastProvider>,
    );

    act(() => {
      const id = controller.push({
        id: "batch-toast",
        title: "Batch Toast",
      });
      controller.dismiss(id);
    });

    expect(screen.queryByText("Batch Toast")).toBeNull();
  });

  it("handles dismiss and allDismiss in the same batch without calling onClose twice", () => {
    const onClose1 = vi.fn();
    const onClose2 = vi.fn();
    let controller!: ReturnType<typeof useToast>;

    render(
      <ToastProvider>
        <TestComponent
          onInit={(c) => {
            controller = c;
          }}
        />
      </ToastProvider>,
    );

    act(() => {
      controller.push({ id: "t-1", title: "Toast 1", onClose: onClose1 });
      controller.push({ id: "t-2", title: "Toast 2", onClose: onClose2 });
    });

    act(() => {
      controller.dismiss("t-1");
      controller.allDismiss();
    });

    expect(onClose1).toHaveBeenCalledTimes(1);
    expect(onClose2).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Toast 1")).toBeNull();
    expect(screen.queryByText("Toast 2")).toBeNull();
  });

  it("sets inert and aria-hidden on hidden toasts (offset >= 3) and removes them when visible", () => {
    let controller!: ReturnType<typeof useToast>;

    const { container } = render(
      <ToastProvider>
        <TestComponent
          onInit={(c) => {
            controller = c;
          }}
        />
      </ToastProvider>,
    );

    act(() => {
      controller.push({ id: "t1", title: "Toast 1", showCloseButton: true });
      controller.push({ id: "t2", title: "Toast 2", showCloseButton: true });
      controller.push({ id: "t3", title: "Toast 3", showCloseButton: true });
      controller.push({ id: "t4", title: "Toast 4", showCloseButton: true });
    });

    const toastElements = container.querySelectorAll<HTMLElement>(
      "[data-slot='toast']",
    );
    expect(toastElements.length).toBe(4);

    const hiddenToast = toastElements[0]; // t1 (offset = 3)
    const visibleToast3 = toastElements[1]; // t2 (offset = 2)
    const visibleToast2 = toastElements[2]; // t3 (offset = 1)
    const visibleToast1 = toastElements[3]; // t4 (offset = 0)

    expect(hiddenToast.getAttribute("aria-hidden")).toBe("true");
    expect(
      hiddenToast.hasAttribute("inert") || hiddenToast.inert === true,
    ).toBe(true);

    expect(visibleToast1.getAttribute("aria-hidden")).toBeNull();
    expect(visibleToast1.hasAttribute("inert")).toBe(false);
    expect(visibleToast2.getAttribute("aria-hidden")).toBeNull();
    expect(visibleToast2.hasAttribute("inert")).toBe(false);
    expect(visibleToast3.getAttribute("aria-hidden")).toBeNull();
    expect(visibleToast3.hasAttribute("inert")).toBe(false);

    // Dismiss top toast so t1 becomes visible (offset = 2)
    act(() => {
      controller.dismiss("t4");
    });

    expect(hiddenToast.getAttribute("aria-hidden")).toBeNull();
    expect(hiddenToast.hasAttribute("inert")).toBe(false);
  });
});
