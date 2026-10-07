"use client";

import dynamic from "next/dynamic";
import type { SandboxRoomProps } from "./SandboxRoom";
import { SandboxRoomLoading } from "./SandboxRoomLoading";

export const SandboxRoomLazy = dynamic<SandboxRoomProps>(
  () => import("./SandboxRoom").then((mod) => mod.SandboxRoom),
  {
    ssr: false,
    loading: () => <SandboxRoomLoading />,
  },
);
