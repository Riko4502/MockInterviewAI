"use client";

import { ChangePasswordSection } from "./ChangePasswordSection";
import { DeleteAccountSection } from "./DeleteAccountSection";

export function SecurityTab() {
  return (
    <div className="flex flex-col gap-6">
      <ChangePasswordSection />
      <DeleteAccountSection />
    </div>
  );
}
