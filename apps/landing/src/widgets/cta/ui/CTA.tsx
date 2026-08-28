"use client";

import { ArrowRightIcon } from "@packages/icons";
import { Badge, Button, Card } from "@packages/ui";
import { getRegisterUrl } from "@/shared/config";
import { useLandingTranslations } from "@/shared/lib";
import { CtaBenefits } from "./CtaBenefits";

export function CTA() {
  const { landing } = useLandingTranslations();
  const registerUrl = getRegisterUrl();

  return (
    <section
      id="cta"
      className="relative py-20 md:py-28 overflow-hidden bg-[#07080e]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* CTA Card Box */}
        <Card className="relative rounded-3xl p-8 sm:p-12 md:p-16 border-violet-500/30 overflow-hidden shadow-2xl glow-card text-center bg-gradient-to-b from-[#121424] to-[#0a0c16]">
          {/* Ambient Glow Behind CTA */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-r from-violet-600/30 via-indigo-600/30 to-purple-600/30 blur-[120px] pointer-events-none -z-10" />

          <Card.Header className="p-0 text-center">
            {/* Badge */}
            <div className="flex justify-center">
              <Badge
                variant="statusInfo"
                className="mb-6 bg-violet-500/10 border-violet-500/30 text-violet-300 font-semibold tracking-wider uppercase px-3.5 py-1.5"
              >
                {landing.cta.badge}
              </Badge>
            </div>

            {/* Title */}
            <Card.Title className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight max-w-3xl mx-auto mb-6 leading-tight">
              {landing.cta.title}
            </Card.Title>

            {/* Subtitle */}
            <Card.Description className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
              {landing.cta.subtitle}
            </Card.Description>
          </Card.Header>

          <Card.Content className="p-0">
            {/* Action Button */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xl shadow-violet-600/40 hover:shadow-violet-500/60 hover:scale-[1.03] active:scale-[0.98] transition-all px-9 py-4 h-auto text-base font-semibold group gap-2.5"
              >
                <a href={registerUrl}>
                  <span>{landing.cta.button}</span>
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
