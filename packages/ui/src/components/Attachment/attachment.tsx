"use client";

import {
  CloseIcon,
  FileCodeIcon,
  FileIcon,
  PaperclipIcon,
} from "@packages/icons";
import { cn } from "@packages/utils";
import { createContext, useContext, useRef } from "react";
import { ATTACHMENT_STYLES, attachmentVariants } from "./constants";
import type {
  AttachmentInfoProps,
  AttachmentListProps,
  AttachmentNameProps,
  AttachmentPreviewProps,
  AttachmentProgressProps,
  AttachmentProps,
  AttachmentRemoveProps,
  AttachmentSizeProps,
  AttachmentTriggerProps,
  AttachmentVariant,
} from "./types";

interface AttachmentContextValue {
  variant?: AttachmentVariant;
}

const AttachmentContext = createContext<AttachmentContextValue>({
  variant: "default",
});

/**
 * Корневой контейнер прикрепленного файла (Attachment).
 */
function AttachmentRoot({
  className,
  variant = "default",
  status = "default",
  children,
  ...props
}: AttachmentProps) {
  return (
    <AttachmentContext.Provider value={{ variant }}>
      <div
        data-slot="attachment"
        data-variant={variant}
        data-status={status}
        className={cn(attachmentVariants({ variant, status }), className)}
        {...props}
      >
        {children}
      </div>
    </AttachmentContext.Provider>
  );
}

function getFileIcon(extension?: string) {
  if (!extension) return <FileIcon size="sm" />;
  const ext = extension.toLowerCase().replace(/^\./, "");
  if (
    [
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "go",
      "java",
      "cpp",
      "c",
      "html",
      "css",
      "json",
    ].includes(ext)
  ) {
    return <FileCodeIcon size="sm" />;
  }
  return <FileIcon size="sm" />;
}

/**
 * Превью прикрепленного файла (изображение или иконка типа файла).
 */
function AttachmentPreview({
  className,
  src,
  alt,
  extension,
  fallbackIcon,
  children,
  ...props
}: AttachmentPreviewProps) {
  const { variant = "default" } = useContext(AttachmentContext);

  const sizeClass = ATTACHMENT_STYLES.previewSizes[variant ?? "default"];

  return (
    <div
      data-slot="attachment-preview"
      className={cn(ATTACHMENT_STYLES.preview, sizeClass, className)}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={alt ?? "file preview"}
          className="size-full object-cover"
        />
      ) : (
        (children ?? fallbackIcon ?? getFileIcon(extension))
      )}
    </div>
  );
}

/**
 * Блок текстовой информации о файле.
 */
function AttachmentInfo({ className, ...props }: AttachmentInfoProps) {
  return (
    <div
      data-slot="attachment-info"
      className={cn(ATTACHMENT_STYLES.info, className)}
      {...props}
    />
  );
}

/**
 * Имя файла.
 */
function AttachmentName({ className, ...props }: AttachmentNameProps) {
  return (
    <span
      data-slot="attachment-name"
      className={cn(ATTACHMENT_STYLES.name, className)}
      {...props}
    />
  );
}

/**
 * Размер файла или статус.
 */
function AttachmentSize({ className, ...props }: AttachmentSizeProps) {
  return (
    <span
      data-slot="attachment-size"
      className={cn(ATTACHMENT_STYLES.size, className)}
      {...props}
    />
  );
}

/**
 * Индикатор прогресса загрузки файла.
 */
function AttachmentProgress({
  className,
  value = 0,
  ...props
}: AttachmentProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      data-slot="attachment-progress"
      className={cn(ATTACHMENT_STYLES.progress, className)}
      {...props}
    >
      <div
        className={ATTACHMENT_STYLES.progressBar}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}

/**
 * Кнопка удаления файла.
 */
function AttachmentRemove({
  className,
  onRemove,
  onClick,
  ...props
}: AttachmentRemoveProps) {
  return (
    <button
      type="button"
      data-slot="attachment-remove"
      aria-label="Удалить файл"
      className={cn(ATTACHMENT_STYLES.remove, className)}
      onClick={(e) => {
        onClick?.(e);
        onRemove?.();
      }}
      {...props}
    >
      <CloseIcon className="size-3.5" />
    </button>
  );
}

/**
 * Контейнер для списка прикрепленных файлов.
 */
function AttachmentList({ className, ...props }: AttachmentListProps) {
  return (
    <div
      data-slot="attachment-list"
      className={cn(ATTACHMENT_STYLES.list, className)}
      {...props}
    />
  );
}

/**
 * Кнопка вызова диалога выбора файлов (Trigger).
 */
function AttachmentTrigger({
  className,
  accept,
  multiple,
  onFilesSelected,
  children,
  onClick,
  ...props
}: AttachmentTriggerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) {
      onFilesSelected?.(files);
    }
    // Сбрасываем значение input, чтобы повторный выбор того же файла срабатывал
    e.target.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleChange}
      />
      <button
        type="button"
        data-slot="attachment-trigger"
        className={cn(ATTACHMENT_STYLES.trigger, className)}
        onClick={handleClick}
        {...props}
      >
        {children ?? (
          <>
            <PaperclipIcon size="sm" />
            <span>Прикрепить файл</span>
          </>
        )}
      </button>
    </>
  );
}

export const Attachment = Object.assign(AttachmentRoot, {
  Preview: AttachmentPreview,
  Info: AttachmentInfo,
  Name: AttachmentName,
  Size: AttachmentSize,
  Progress: AttachmentProgress,
  Remove: AttachmentRemove,
  List: AttachmentList,
  Trigger: AttachmentTrigger,
});
