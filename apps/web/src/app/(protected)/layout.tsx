import type React from "react";
import { AuthBoundary } from "@/features/auth";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthBoundary mode="protected">{children}</AuthBoundary>;
}
