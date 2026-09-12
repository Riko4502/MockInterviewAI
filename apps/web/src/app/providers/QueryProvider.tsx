"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { type PropsWithChildren, useState } from "react";

import { createQueryClient } from "@/shared/api";

const ReactQueryDevtools =
  process.env.NODE_ENV === "production"
    ? () => null
    : dynamic(
        () =>
          import("@tanstack/react-query-devtools").then(
            (d) => d.ReactQueryDevtools,
          ),
        { ssr: false },
      );

export function QueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}

      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
