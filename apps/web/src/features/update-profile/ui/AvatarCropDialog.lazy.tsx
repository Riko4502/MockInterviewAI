"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { AvatarCropDialog } from "./AvatarCropDialog";

export const AvatarCropDialogLazy = dynamic<
  ComponentProps<typeof AvatarCropDialog>
>(() => import("./AvatarCropDialog").then((mod) => mod.AvatarCropDialog), {
  ssr: false,
});
