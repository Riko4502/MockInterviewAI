import { jwtDecode } from "jwt-decode";

export interface JwtPayload {
  sub: string;
  sid: string;
  permissions: bigint;
  exp: number;
  iat: number;
}

/** Decodes access-token claims for UI checks; signature verification belongs to the server. */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
      return null;
    const value = jwtDecode<Record<string, unknown>>(token);
    if (!value || typeof value !== "object") return null;
    const { sub, sid, permissions, exp, iat } = value;
    if (
      typeof sub !== "string" ||
      !sub ||
      typeof sid !== "string" ||
      !sid ||
      typeof exp !== "number" ||
      !Number.isSafeInteger(exp) ||
      exp <= 0 ||
      typeof iat !== "number" ||
      !Number.isSafeInteger(iat) ||
      iat < 0 ||
      exp <= iat ||
      value.typ !== "access"
    )
      return null;
    if (typeof permissions === "number") {
      if (!Number.isSafeInteger(permissions) || permissions < 0) return null;
    } else if (typeof permissions !== "string" || !/^\d+$/.test(permissions)) {
      return null;
    }
    return { sub, sid, permissions: BigInt(permissions), exp, iat };
  } catch {
    return null;
  }
}
