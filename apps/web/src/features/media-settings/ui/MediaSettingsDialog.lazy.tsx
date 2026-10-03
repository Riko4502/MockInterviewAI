"use client";

import dynamic from "next/dynamic";
import type { MediaSettingsDialogProps } from "./MediaSettingsDialog";

export const MediaSettingsDialogLazy = dynamic<MediaSettingsDialogProps>(
  () => import("./MediaSettingsDialog").then((mod) => mod.MediaSettingsDialog),
  {
    ssr: false,
  },
);
