"use client";

import dynamic from "next/dynamic";
import type { DeleteCardConfirmDialogProps } from "./DeleteCardConfirmDialog";

export const DeleteCardConfirmDialogLazy =
  dynamic<DeleteCardConfirmDialogProps>(
    () =>
      import("./DeleteCardConfirmDialog").then(
        (mod) => mod.DeleteCardConfirmDialog,
      ),
    {
      ssr: false,
    },
  );
