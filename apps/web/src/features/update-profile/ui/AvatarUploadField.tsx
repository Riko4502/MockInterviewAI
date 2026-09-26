"use client";

import { Button, Spin } from "@packages/ui";
import dynamic from "next/dynamic";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/entities/user";
import { useUploadAvatar } from "../model/use-profile-mutations";

const AvatarCropDialog = dynamic(
  () => import("./AvatarCropDialog").then((module) => module.AvatarCropDialog),
  { ssr: false },
);

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type AvatarUploadFieldProps = {
  src?: string | null;
  name?: string | null;
  email?: string | null;
};

export function AvatarUploadField({
  src,
  name,
  email,
}: AvatarUploadFieldProps) {
  const { t } = useTranslation("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadAvatar = useUploadAvatar();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [typeError, setTypeError] = useState(false);

  useEffect(() => {
    if (!imageFile) {
      setImageSrc(null);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setImageSrc(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || uploadAvatar.isPending) {
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setTypeError(true);
      return;
    }

    setTypeError(false);
    uploadAvatar.reset();
    setImageFile(file);
  };

  return (
    <div className="flex items-center gap-4">
      <UserAvatar src={src} name={name} email={email} size="lg" />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("profile.avatar")}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={t("profile.uploadAvatar")}
          disabled={uploadAvatar.isPending}
          onChange={onFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploadAvatar.isPending}
          aria-busy={uploadAvatar.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {uploadAvatar.isPending ? <Spin size="sm" variant="current" /> : null}
          {t("profile.uploadAvatar")}
        </Button>
        {typeError ? (
          <p className="text-sm text-destructive">
            {t("profile.avatarTypeError")}
          </p>
        ) : null}
        {uploadAvatar.isError && !imageSrc ? (
          <p className="text-sm text-destructive">{t("profile.avatarError")}</p>
        ) : null}
      </div>

      {imageFile ? (
        <AvatarCropDialog
          imageSrc={imageSrc}
          isSubmitting={uploadAvatar.isPending}
          errorMessage={uploadAvatar.isError ? t("profile.avatarError") : null}
          onOpenChange={(open) => {
            if (!open) {
              setImageFile(null);
            }
          }}
          onConfirm={(file) => {
            uploadAvatar.mutate(
              { data: { file } },
              {
                onSuccess: () => {
                  setImageFile(null);
                },
              },
            );
          }}
        />
      ) : null}
    </div>
  );
}
