"use client";

import { useAuthControllerLogout } from "@packages/api";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "@/entities/session";
import { paths } from "@/shared/config";

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { clearSession } = useSession();

  const finishLogout = () => {
    clearSession();
    queryClient.clear();
    router.replace(paths.login);
  };

  const logoutMutation = useAuthControllerLogout({
    mutation: {
      onSettled: finishLogout,
    },
  });

  return {
    logout: () => logoutMutation.mutate(),
    isPending: logoutMutation.isPending,
  };
}
