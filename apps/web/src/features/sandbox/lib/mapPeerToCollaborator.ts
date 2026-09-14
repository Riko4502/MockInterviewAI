import type { Collaborator } from "@packages/editor";
import type { PeerInfo } from "./useSandboxRealtime";

export const COLLABORATOR_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
];

/**
 * Генерирует детерминированный цвет для участника по его идентификатору.
 */
export function getColorForUser(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i)) | 0;
  }
  return COLLABORATOR_COLORS[Math.abs(hash) % COLLABORATOR_COLORS.length];
}

/**
 * Mapper: преобразует информацию об участнике комнаты (PeerInfo) в модель соавтора для Monaco Editor.
 */
export function mapPeerToCollaborator(peer: PeerInfo): Collaborator {
  return {
    id: peer.id,
    name: peer.name,
    color: peer.color || getColorForUser(peer.id),
    cursor: peer.cursor,
  };
}
