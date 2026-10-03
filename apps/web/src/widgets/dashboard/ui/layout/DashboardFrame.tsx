import type { ReactNode } from "react";

export function DashboardFrame({
  header,
  primary,
  secondary,
}: {
  header: ReactNode;
  primary: ReactNode;
  secondary: ReactNode;
}) {
  return (
    <div
      data-testid="dashboard"
      className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 [overflow-wrap:anywhere]"
    >
      {header}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div
          data-testid="dashboard-primary"
          className="flex min-w-0 flex-col gap-6 lg:col-span-8"
        >
          {primary}
        </div>
        <div
          data-testid="dashboard-secondary"
          className="flex min-w-0 flex-col gap-6 lg:col-span-4"
        >
          {secondary}
        </div>
      </div>
    </div>
  );
}
