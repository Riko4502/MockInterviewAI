import type React from "react";
import { AuthBoundary } from "@/features/auth";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthBoundary mode="guest">{children}</AuthBoundary>;
}
