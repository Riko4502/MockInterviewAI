import "@testing-library/jest-dom/vitest";
import {
  getDashboardControllerGetReadinessQueryKey,
  getDashboardControllerGetShowcaseStatusQueryKey,
  type RequestConfig,
  resetHttpTransport,
  setHttpTransport,
} from "@packages/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "@/shared/api";
import i18n from "@/shared/lib/i18n";
import { CreateShowcaseDialog } from "./CreateShowcaseDialog";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@packages/ui", async (original) => ({
  ...(await original<typeof import("@packages/ui")>()),
  useToast: () => ({ push }),
}));
let client: QueryClient;
let requests: RequestConfig[];
let respond: () => Promise<unknown>;

beforeEach(async () => {
  await i18n.changeLanguage("en");
  push.mockClear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  requests = [];
  respond = async () => ({ id: "new-card" });
  setHttpTransport(async <T,>(config: RequestConfig): Promise<T> => {
    requests.push(config);
    return (await respond()) as T;
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  resetHttpTransport();
  vi.unstubAllGlobals();
});

async function openForm() {
  render(
    <QueryClientProvider client={client}>
      <CreateShowcaseDialog />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Create profile card" }));
  return user;
}
async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: "Specialization" }));
  await user.click(screen.getByRole("option", { name: "Frontend" }));
  await user.click(screen.getByRole("combobox", { name: "Experience level" }));
  await user.click(screen.getByRole("option", { name: "Middle" }));
  await user.type(screen.getByLabelText("Skills"), "React, TypeScript");
}

it("does not publish invalid fields and focuses the first invalid field", async () => {
  const user = await openForm();
  await user.click(screen.getByRole("button", { name: "Publish" }));
  expect(requests).toHaveLength(0);
  expect(
    screen.getByRole("combobox", { name: "Specialization" }),
  ).toHaveFocus();
  expect(screen.getByLabelText("Skills")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

it("publishes normalized values once and invalidates dashboard caches", async () => {
  const readiness = getDashboardControllerGetReadinessQueryKey();
  const showcase = getDashboardControllerGetShowcaseStatusQueryKey();
  client.setQueryData(readiness, { totalPercentage: 0 });
  client.setQueryData(showcase, { hasActiveCard: false });
  let resolve!: (value: unknown) => void;
  respond = () =>
    new Promise((done) => {
      resolve = done;
    });
  const user = await openForm();
  await fillForm(user);
  await user.click(screen.getByLabelText("Automatically renew this profile"));
  await user.click(screen.getByRole("button", { name: "Publish" }));
  const form = screen.getByLabelText("Skills").closest("form");
  if (!form) throw new Error("Missing form");
  fireEvent.submit(form);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    url: "/api/v1/showcase",
    method: "POST",
    data: {
      specialization: "FRONTEND",
      level: "MIDDLE",
      language: "RU",
      skills: ["react", "typescript"],
      autoRenew: true,
      isUrgent: false,
    },
  });
  resolve({ id: "new-card" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(client.getQueryState(readiness)?.isInvalidated).toBe(true);
  expect(client.getQueryState(showcase)?.isInvalidated).toBe(true);
  expect(push).toHaveBeenCalledWith({
    status: "success",
    title: "Profile published",
  });
});

it("keeps entered values after a duplicate error and allows retry", async () => {
  respond = async () => {
    throw new HttpError("Duplicate", 409);
  };
  const user = await openForm();
  await fillForm(user);
  await user.click(screen.getByRole("button", { name: "Publish" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "already have an active profile",
  );
  expect(screen.getByLabelText("Skills")).toHaveValue("React, TypeScript");
  expect(requests).toHaveLength(1);
  respond = async () => ({ id: "new-card" });
  await user.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
});
