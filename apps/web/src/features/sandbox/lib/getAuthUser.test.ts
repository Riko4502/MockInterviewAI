import { beforeEach, describe, expect, it, vi } from "vitest";
import { authToken } from "@/shared/api";
import { getAuthUser } from "./getAuthUser";

vi.mock("@/shared/api", () => ({
  authToken: {
    get: vi.fn(),
  },
}));

describe("getAuthUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null values when no token exists", () => {
    vi.mocked(authToken.get).mockReturnValue(null);
    expect(getAuthUser()).toEqual({ id: null, name: null });
  });

  it("decodes token with username correctly", () => {
    // header: {"alg":"HS256","typ":"JWT"}, payload: {"sub":"usr_123","username":"alex"}
    const token =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfMTIzIiwidXNlcm5hbWUiOiJhbGV4In0.signature";
    vi.mocked(authToken.get).mockReturnValue(token);
    expect(getAuthUser()).toEqual({ id: "usr_123", name: "alex" });
  });

  it("falls back to email prefix if username is missing", () => {
    // payload: {"sub":"usr_456","email":"dev@example.com"}
    const token =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfNDU2IiwiZW1haWwiOiJkZXZAZXhhbXBsZS5jb20ifQ.signature";
    vi.mocked(authToken.get).mockReturnValue(token);
    expect(getAuthUser()).toEqual({ id: "usr_456", name: "dev" });
  });

  it("returns null values on invalid token", () => {
    vi.mocked(authToken.get).mockReturnValue("invalid-token");
    expect(getAuthUser()).toEqual({ id: null, name: null });
  });
});
