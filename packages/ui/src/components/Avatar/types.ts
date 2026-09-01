import type { VariantProps } from "@packages/utils";
import type { Avatar as AvatarPrimitive } from "radix-ui";
import type * as React from "react";
import type { avatarVariants } from "./constants";

export type AvatarProps = React.ComponentPropsWithoutRef<
  typeof AvatarPrimitive.Root
> &
  VariantProps<typeof avatarVariants>;

export type AvatarImageProps = React.ComponentPropsWithoutRef<
  typeof AvatarPrimitive.Image
>;

export type AvatarFallbackProps = React.ComponentPropsWithoutRef<
  typeof AvatarPrimitive.Fallback
>;
