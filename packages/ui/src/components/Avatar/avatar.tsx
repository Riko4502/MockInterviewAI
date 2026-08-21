"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "radix-ui"
import {cn} from "@lib/utils"
import {avatarVariants} from "./constants"
import {
  type AvatarProps,
  type AvatarImageProps,
  type AvatarFallbackProps
} from "./types"

function AvatarRoot({className, size, ...props}: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(avatarVariants({size, className}))}
      {...props}
    />
  )
}

function AvatarImage({className, ...props}: AvatarImageProps) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  )
}

function AvatarFallback({className, ...props}: AvatarFallbackProps) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("flex size-full items-center justify-center rounded-full bg-muted font-medium", className)}
      {...props}
    />
  )
}

export const Avatar = Object.assign(AvatarRoot, {
  Image: AvatarImage,
  Fallback: AvatarFallback,
})

export { AvatarImage, AvatarFallback }