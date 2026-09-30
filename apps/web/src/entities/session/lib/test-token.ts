import { Buffer } from "node:buffer";

export function createAccessToken(overrides: Record<string, unknown> = {}) {
  const payload = {
    sub: "user-1",
    sid: "session-1",
    permissions: 0,
    typ: "access",
    iat: 1_800_000_000,
    exp: 1_800_000_900,
    ...overrides,
  };
  return `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}
