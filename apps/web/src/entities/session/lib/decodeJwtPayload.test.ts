import { describe, expect, it } from "vitest";
import { decodeJwtPayload } from "./decodeJwtPayload";
import { createAccessToken } from "./test-token";

describe("decodeJwtPayload", () => {
  it.each([
    0,
    6,
    Number.MAX_SAFE_INTEGER,
    "9007199254740993",
  ])("decodes server permissions %s without losing precision", (permissions) => {
    expect(decodeJwtPayload(createAccessToken({ permissions }))).toEqual({
      sub: "user-1",
      sid: "session-1",
      permissions: BigInt(permissions),
      iat: 1_800_000_000,
      exp: 1_800_000_900,
    });
  });
  it.each([
    "",
    "bad",
    "a.b.c",
    "a.e30.c",
    "a.bnVsbA.c",
    "a.W10.c",
  ])("rejects malformed JWT %s", (token) => {
    expect(decodeJwtPayload(token)).toBeNull();
  });
  it.each([
    { sub: "" },
    { sid: null },
    { typ: "refresh" },
    { permissions: undefined },
    { permissions: -1 },
    { permissions: 1.5 },
    { permissions: Number.MAX_SAFE_INTEGER + 1 },
    { permissions: "-1" },
    { permissions: "1.5" },
    { permissions: "0x10" },
    { permissions: {} },
    { exp: "1800000900" },
    { exp: 0 },
    { iat: -1 },
    { exp: 1 },
  ])("rejects invalid claims %j", (claims) => {
    expect(decodeJwtPayload(createAccessToken(claims))).toBeNull();
  });
  it("decodes expired claims without replacing server expiry validation", () => {
    expect(decodeJwtPayload(createAccessToken({ iat: 1, exp: 2 }))?.exp).toBe(
      2,
    );
  });
});
