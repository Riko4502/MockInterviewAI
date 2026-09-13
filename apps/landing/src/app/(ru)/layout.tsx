import type { ReactNode } from "react";
import { BaseLayout } from "../BaseLayout";

export default function RuLayout({ children }: { children: ReactNode }) {
  return <BaseLayout lang="ru">{children}</BaseLayout>;
}
