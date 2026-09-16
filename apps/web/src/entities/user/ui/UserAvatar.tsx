"use client";

import { Avatar, type AvatarProps } from "@packages/ui";
import { getUserInitials } from "../lib/get-user-initials";

type UserAvatarProps = {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: AvatarProps["size"];
};

export function UserAvatar({ src, name, email, size = "md" }: UserAvatarProps) {
  const initials = getUserInitials(name, email);
  const alt = name || email || initials;

  return (
    <Avatar size={size}>
      {src ? <Avatar.Image src={src} alt={alt} /> : null}
      <Avatar.Fallback>{initials}</Avatar.Fallback>
    </Avatar>
  );
}
