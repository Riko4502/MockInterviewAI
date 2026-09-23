import { jwtDecode } from "jwt-decode";
import { authToken } from "@/shared/api";

interface JwtUserPayload {
  sub?: string;
  username?: string;
  email?: string;
}

export interface AuthUser {
  id: string | null;
  name: string | null;
}

/* TODO временное решение пока нету профиля */
export function getAuthUser(): AuthUser {
  const token = authToken.get();
  if (!token) return { id: null, name: null };

  try {
    const { sub, username, email } = jwtDecode<JwtUserPayload>(token);
    return {
      id: sub ?? null,
      name: username || email?.split("@")[0] || null,
    };
  } catch {
    return { id: null, name: null };
  }
}
