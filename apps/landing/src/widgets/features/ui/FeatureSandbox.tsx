"use client";

import { GlobeIcon } from "@packages/icons";
import { Badge, Card } from "@packages/ui";
import { useState } from "react";
import { useLandingTranslations } from "@/shared/lib";

export function FeatureSandbox() {
  const { landing } = useLandingTranslations();
  const [activeRegion, setActiveRegion] = useState("eu");

  const regions = [
    { id: "eu", name: "EU-Central", ping: "14ms", status: "Optimal" },
    { id: "us", name: "US-East", ping: "18ms", status: "Optimal" },
    { id: "ap", name: "AP-East", ping: "32ms", status: "Active" },
  ];

  return (
    <Card className="w-full h-full relative rounded-3xl p-8 border border-sky-500/20 bg-gradient-to-b from-sky-950/20 via-[#0c0e1a]/80 to-[#07080e]/90 backdrop-blur-xl flex flex-col justify-between group hover:border-sky-500/60 hover:shadow-2xl hover:shadow-sky-950/50 transition-all duration-300 overflow-hidden">
      {/* Corner Ambient Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-sky-600/15 blur-3xl pointer-events-none rounded-full" />

      <Card.Header className="p-0 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 border border-sky-400/40 flex items-center justify-center text-white mb-6 shadow-lg shadow-sky-600/30 group-hover:scale-110 group-hover:shadow-sky-500/50 transition-all">
          <GlobeIcon className="w-6 h-6" />
        </div>
        <Card.Title className="text-xl sm:text-2xl font-bold text-white mb-3">
          {landing.features.card3Title}
        </Card.Title>
        <Card.Description className="text-slate-300 text-sm leading-relaxed mb-6">
          {landing.features.card3Desc}
        </Card.Description>
      </Card.Header>

      <Card.Content className="p-0 relative z-10">
        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
          {regions.map((reg) => (
            <button
              type="button"
              key={reg.id}
              onClick={() => setActiveRegion(reg.id)}
              className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                activeRegion === reg.id
                  ? "bg-sky-950/60 border-sky-400 shadow-md shadow-sky-950/50"
                  : "bg-[#0a0c16]/90 border-white/10 hover:border-sky-500/30"
              }`}
            >
              <div className="text-[10px] text-sky-200">{reg.name}</div>
              <div className="text-emerald-400 font-bold mt-0.5">
                {reg.ping}
              </div>
              {activeRegion === reg.id && (
                <Badge
                  variant="statusSuccess"
                  className="mt-1 text-[9px] px-1 py-0 bg-sky-500/20 border-sky-500/40 text-sky-300"
                >
                  {reg.status}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}
