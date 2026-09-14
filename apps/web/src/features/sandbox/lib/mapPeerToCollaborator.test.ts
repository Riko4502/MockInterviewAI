import { describe, expect, it } from "vitest";
import {
  COLLABORATOR_COLORS,
  getColorForUser,
  mapPeerToCollaborator,
} from "./mapPeerToCollaborator";
import type { PeerInfo } from "./useSandboxRealtime";

describe("mapPeerToCollaborator", () => {
  it("should generate deterministic colors for the same user ID", () => {
    const color1 = getColorForUser("user_abc123");
    const color2 = getColorForUser("user_abc123");
    const color3 = getColorForUser("user_xyz999");

    expect(color1).toBe(color2);
    expect(COLLABORATOR_COLORS).toContain(color1);
    expect(COLLABORATOR_COLORS).toContain(color3);
  });

  it("should map PeerInfo correctly to Monaco Collaborator model", () => {
    const peer: PeerInfo = {
      id: "peer-42",
      name: "Dmitry",
      color: "#10b981",
      cursor: {
        line: 5,
        column: 12,
      },
      lastSeen: Date.now(),
    };

    const collaborator = mapPeerToCollaborator(peer);

    expect(collaborator).toEqual({
      id: "peer-42",
      name: "Dmitry",
      color: "#10b981",
      cursor: {
        line: 5,
        column: 12,
      },
    });
  });

  it("should fallback to generated color if peer color is missing", () => {
    const peer: PeerInfo = {
      id: "peer-fallback",
      name: "Guest",
      color: "",
      lastSeen: Date.now(),
    };

    const collaborator = mapPeerToCollaborator(peer);

    expect(collaborator.color).toBe(getColorForUser("peer-fallback"));
    expect(collaborator.name).toBe("Guest");
  });
});
