"use client";

import { useAuthControllerOauthProviders } from "@packages/api";
import { GithubIcon } from "@packages/icons";
import { Button } from "@packages/ui";
import { useTranslation } from "react-i18next";
import { getApiUrl } from "@/shared/api/config/endpoints";
import "@/shared/lib/i18n";

export function GithubLoginButton() {
  const { t } = useTranslation("auth");
  const { data, isError } = useAuthControllerOauthProviders({
    query: { retry: false },
  });
  if (isError || data?.github !== true) return null;

  const href = `${getApiUrl().replace(/\/+$/, "")}/api/v1/auth/github`;

  return (
    <Button asChild variant="outline" size="lg" className="w-full">
      <a href={href}>
        <GithubIcon />
        {t("oauth.github")}
      </a>
    </Button>
  );
}
