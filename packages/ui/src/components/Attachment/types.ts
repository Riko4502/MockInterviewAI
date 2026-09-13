import type { VariantProps } from "@packages/utils";
import type * as React from "react";
import type { attachmentVariants } from "./constants";

export type AttachmentStatus = "default" | "uploading" | "error" | "success";
export type AttachmentVariant = "default" | "compact" | "card";

export interface AttachmentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof attachmentVariants> {
  status?: AttachmentStatus;
  variant?: AttachmentVariant;
}

export interface AttachmentPreviewProps
  extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  extension?: string;
  fallbackIcon?: React.ReactNode;
}

export type AttachmentInfoProps = React.HTMLAttributes<HTMLDivElement>;

export interface AttachmentNameProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
}

export interface AttachmentSizeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
}

export interface AttachmentProgressProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

export interface AttachmentRemoveProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onRemove?: () => void;
}

export type AttachmentListProps = React.HTMLAttributes<HTMLDivElement>;

export interface AttachmentTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  accept?: string;
  multiple?: boolean;
  onFilesSelected?: (files: File[]) => void;
}
