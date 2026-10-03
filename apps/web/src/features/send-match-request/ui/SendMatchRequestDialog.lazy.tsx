"use client";

import dynamic from "next/dynamic";
import type { SendMatchRequestDialogProps } from "./SendMatchRequestDialog";

export const SendMatchRequestDialogLazy = dynamic<SendMatchRequestDialogProps>(
  () =>
    import("./SendMatchRequestDialog").then(
      (mod) => mod.SendMatchRequestDialog,
    ),
  {
    ssr: false,
  },
);
