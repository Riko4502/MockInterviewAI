"use client";

import {
  type ExperienceLevel,
  experienceLevelEnum,
  type InterviewLanguage,
  interviewLanguageEnum,
  type ShowcaseSortBy,
  type Specialization,
  showcaseSortByEnum,
  specializationEnum,
} from "@packages/dto";
import { ZapIcon } from "@packages/icons";
import { Button, Select } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

export interface ShowcaseFiltersState {
  specialization?: Specialization;
  level?: ExperienceLevel;
  language?: InterviewLanguage;
  isUrgent?: boolean;
  sortBy?: ShowcaseSortBy;
}

export interface ShowcaseFiltersBarProps {
  filters: ShowcaseFiltersState;
  onChange: (filters: ShowcaseFiltersState) => void;
  onReset: () => void;
  className?: string;
}

export function ShowcaseFiltersBar({
  filters,
  onChange,
  onReset,
  className,
}: ShowcaseFiltersBarProps) {
  const { t } = useTranslation("showcase");

  const isAnyFilterActive =
    !!filters.specialization ||
    !!filters.level ||
    !!filters.language ||
    !!filters.isUrgent ||
    (filters.sortBy && filters.sortBy !== "BUMPED");

  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className || ""}`}>
      {/* Фильтр: Специализация */}
      <Select
        value={filters.specialization || "ALL"}
        onValueChange={(val: string) =>
          onChange({
            ...filters,
            specialization: val === "ALL" ? undefined : (val as Specialization),
          })
        }
      >
        <Select.Trigger className="w-[170px] h-9 text-xs rounded-xl bg-card border-border/70">
          <Select.Value placeholder={t("filters.allSpecializations")} />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="ALL">
            {t("filters.allSpecializations")}
          </Select.Item>
          {specializationEnum.options.map((spec) => (
            <Select.Item key={spec} value={spec}>
              {t(`specializations.${spec}`)}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>

      {/* Фильтр: Уровень */}
      <Select
        value={filters.level || "ALL"}
        onValueChange={(val: string) =>
          onChange({
            ...filters,
            level: val === "ALL" ? undefined : (val as ExperienceLevel),
          })
        }
      >
        <Select.Trigger className="w-[140px] h-9 text-xs rounded-xl bg-card border-border/70">
          <Select.Value placeholder={t("filters.allLevels")} />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="ALL">{t("filters.allLevels")}</Select.Item>
          {experienceLevelEnum.options.map((lvl) => (
            <Select.Item key={lvl} value={lvl}>
              {t(`levels.${lvl}`)}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>

      {/* Фильтр: Язык */}
      <Select
        value={filters.language || "ALL"}
        onValueChange={(val: string) =>
          onChange({
            ...filters,
            language: val === "ALL" ? undefined : (val as InterviewLanguage),
          })
        }
      >
        <Select.Trigger className="w-[130px] h-9 text-xs rounded-xl bg-card border-border/70">
          <Select.Value placeholder={t("filters.allLanguages")} />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="ALL">{t("filters.allLanguages")}</Select.Item>
          {interviewLanguageEnum.options.map((lang) => (
            <Select.Item key={lang} value={lang}>
              {t(`languages.${lang}`)}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>

      {/* Тумблер Готовы сегодня */}
      <Button
        type="button"
        variant={filters.isUrgent ? "default" : "outline"}
        size="sm"
        onClick={() =>
          onChange({
            ...filters,
            isUrgent: !filters.isUrgent,
          })
        }
        className={`h-9 rounded-xl text-xs font-medium gap-1.5 transition-all ${
          filters.isUrgent
            ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <ZapIcon
          className={`size-3.5 ${
            filters.isUrgent ? "fill-white text-white" : "text-amber-500"
          }`}
        />
        <span>{t("filters.urgentOnly")}</span>
      </Button>

      {/* Сортировка */}
      <div className="ml-auto flex items-center gap-2">
        <Select
          value={filters.sortBy || "BUMPED"}
          onValueChange={(val: string) =>
            onChange({
              ...filters,
              sortBy: val as ShowcaseSortBy,
            })
          }
        >
          <Select.Trigger className="w-[175px] h-9 text-xs rounded-xl bg-card border-border/70">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {showcaseSortByEnum.options.map((sort) => (
              <Select.Item key={sort} value={sort}>
                {t(`sortBy.${sort}`)}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>

        {/* Сброс */}
        {isAnyFilterActive && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-9 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("filters.reset")}
          </Button>
        )}
      </div>
    </div>
  );
}
