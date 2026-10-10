"use client";

import { cn } from "@packages/utils";
import { UserAvatar } from "@/entities/user";

export interface UserAvatarCellProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
  className?: string;
}

export function UserAvatarCell({
  avatarUrl,
  displayName,
  username,
  email,
  className,
}: UserAvatarCellProps) {
  const primaryName = displayName || username || email || "—";
  const showUsername = Boolean(username && username !== displayName);

  return (
    <div className={cn("flex items-center gap-3 min-w-0", className)}>
      <UserAvatar
        src={avatarUrl}
        name={displayName || username}
        email={email}
        size="md"
        className="shrink-0"
      />
      <div className="flex flex-col min-w-0 truncate">
        <span className="font-medium text-foreground truncate text-sm">
          {primaryName}
        </span>
        {showUsername && (
          <span className="text-xs text-muted-foreground font-mono truncate">
            @{username}
          </span>
        )}
      </div>
    </div>
  );
}
