"use client";

import { Label, Select } from "@packages/ui";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

// Черновые варианты только для интерфейса. Контракт создания ИИ-интервью пока отсутствует.
const topics = ["algorithms", "systemDesign", "frontend"] as const;
const difficulties = ["easy", "medium", "hard"] as const;

export default function QuickAiInterviewDialog() {
  const { t } = useTranslation("dashboard");
  const id = useId();
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${id}-topic`}>{t("aiDialog.topic")}</Label>
        <Select value={topic} onValueChange={setTopic}>
          <Select.Trigger id={`${id}-topic`} className="w-full">
            <Select.Value placeholder={t("aiDialog.chooseTopic")} />
          </Select.Trigger>
          <Select.Content>
            {topics.map((value) => (
              <Select.Item key={value} value={value}>
                {t(`aiDialog.topics.${value}`)}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-difficulty`}>{t("aiDialog.difficulty")}</Label>
        <Select value={difficulty} onValueChange={setDifficulty}>
          <Select.Trigger id={`${id}-difficulty`} className="w-full">
            <Select.Value placeholder={t("aiDialog.chooseDifficulty")} />
          </Select.Trigger>
          <Select.Content>
            {difficulties.map((value) => (
              <Select.Item key={value} value={value}>
                {t(`aiDialog.difficulties.${value}`)}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>
    </div>
  );
}
