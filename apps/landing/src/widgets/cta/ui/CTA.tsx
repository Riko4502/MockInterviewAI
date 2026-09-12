"use client";

import { ArrowRightIcon } from "@packages/icons";
import { Badge, Button, Card, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import { getRegisterUrl } from "@/shared/config";
import { CtaBenefits } from "./CtaBenefits";

export function CTA() {
  const { t } = useTranslation("landing");
  const registerUrl = getRegisterUrl();

  return (
    <section
      id="cta"
      className="relative py-20 md:py-28 overflow-hidden bg-transparent"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* CTA Card Box with Aurora Theme */}
        <Card className="relative rounded-3xl p-8 sm:p-12 md:p-16 border border-violet-500/40 overflow-hidden shadow-2xl glow-card text-center bg-gradient-to-b from-[#141226]/80 via-[#0d1022]/80 to-[#070914]/90 backdrop-blur-xl">
          {/* Ambient Multi-Color Aurora Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[750px] h-[350px] bg-gradient-to-r from-violet-600/30 via-fuchsia-600/25 to-cyan-500/30 blur-[130px] pointer-events-none -z-10" />

          <Card.Header className="p-0 text-center">
            {/* Badge */}
            <div className="flex justify-center">
              <Badge
                variant="statusInfo"
                className="mb-6 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border-violet-500/40 text-violet-200 font-semibold tracking-wider uppercase px-3.5 py-1.5 shadow-sm shadow-violet-500/20"
              >
                {t("cta.badge")}
              </Badge>
            </div>

            {/* Title */}
            <Typography.H2 className="border-b-0 pb-0 text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight max-w-3xl mx-auto mb-6 leading-tight">
              {t("cta.title")}
            </Typography.H2>

            {/* Subtitle */}
            <Typography.Lead className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
              {t("cta.subtitle")}
            </Typography.Lead>
          </Card.Header>

          <Card.Content className="p-0">
            {/* Action Button */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:via-indigo-500 hover:to-cyan-500 text-white shadow-xl shadow-violet-600/40 hover:shadow-cyan-500/50 hover:scale-[1.03] active:scale-[0.98] transition-all px-9 py-4 h-auto text-base font-semibold group gap-2.5"
              >
                <a href={registerUrl}>
                  <span>{t("cta.button")}</span>
                  <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
            </div>

            {/* Key Benefits List */}
            <CtaBenefits />
          </Card.Content>
        </Card>
      </div>
    </section>
  );
}
