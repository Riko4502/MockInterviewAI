"use client";

import { Button } from "@packages/ui";
import { type ChangeEvent, useRef } from "react";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/entities/user";
import { useUploadAvatar } from "../model/use-profile-mutations";

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

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    uploadAvatar.mutate({ data: { file } });
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
          onClick={() => inputRef.current?.click()}
        >
          {t("profile.uploadAvatar")}
        </Button>
        {uploadAvatar.isError ? (
          <p className="text-sm text-destructive">{t("profile.avatarError")}</p>
        ) : null}
      </div>
    </div>
  );
}
