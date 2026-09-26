import { useContext } from "react";
import { SessionContext, type SessionContextValue } from "./context";

export interface UseSessionOptions {
  optional?: boolean;
}

export function useSession(options: {
  optional: true;
}): SessionContextValue | null;
export function useSession(options?: { optional?: false }): SessionContextValue;
export function useSession(
  options?: UseSessionOptions,
): SessionContextValue | null {
  const context = useContext(SessionContext);

  if (!context && !options?.optional) {
    throw new Error("useSession must be used within SessionProvider");
  }

  return context;
}
