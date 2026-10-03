"use client";

import { DashboardPageError } from "@/widgets/dashboard";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardPageError reset={reset} />;
}
