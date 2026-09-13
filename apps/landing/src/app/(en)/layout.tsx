import type { ReactNode } from "react";
import { BaseLayout } from "../BaseLayout";

export default function EnLayout({ children }: { children: ReactNode }) {
  return <BaseLayout lang="en">{children}</BaseLayout>;
}
