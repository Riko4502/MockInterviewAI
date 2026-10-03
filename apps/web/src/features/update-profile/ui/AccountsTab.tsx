"use client";

import type { UserProfileDto } from "@packages/api";
import { ConnectedAccountsSection } from "./ConnectedAccountsSection";

type AccountsTabProps = {
  user: UserProfileDto;
};

export function AccountsTab({ user }: AccountsTabProps) {
  return <ConnectedAccountsSection user={user} />;
}
