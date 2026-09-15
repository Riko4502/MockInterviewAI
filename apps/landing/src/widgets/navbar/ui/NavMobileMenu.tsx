import { Button } from "@packages/ui";
import NextLink from "next/link";
import { useTranslation } from "react-i18next";
import { getAuthUrl, getRegisterUrl } from "@/shared/config";
import { NAV_LINKS } from "../constants";

interface NavMobileMenuProps {
  isOpen: boolean;
  onClose?: () => void;
}

export function NavMobileMenu({ isOpen, onClose }: NavMobileMenuProps) {
  const { t } = useTranslation("landing");
  const authUrl = getAuthUrl();
  const registerUrl = getRegisterUrl();

  if (!isOpen) return null;

  return (
    <div className="md:hidden mt-2 max-w-5xl mx-auto rounded-3xl border border-black/[0.08] dark:border-white/[0.08] bg-white/95 dark:bg-[#07080e]/95 backdrop-blur-2xl p-5 shadow-2xl space-y-4 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex flex-col space-y-1">
        {NAV_LINKS.map((link) => (
          <NextLink
            key={link.href}
            href={link.href}
            onClick={onClose}
            className="text-sm font-medium text-foreground hover:text-violet-500 py-2.5 px-3 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-all"
          >
            {t(link.labelKey)}
          </NextLink>
        ))}
        <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex flex-col gap-2">
          <a
            href={authUrl}
            onClick={onClose}
            className="text-sm font-medium text-center text-muted-foreground hover:text-foreground py-2 px-3 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-all"
          >
            {t("nav.signIn")}
          </a>
          <Button
            asChild
            size="sm"
            className="w-full rounded-full bg-foreground text-background font-semibold h-9"
          >
            <a href={registerUrl} onClick={onClose}>
              {t("nav.getStarted")}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
