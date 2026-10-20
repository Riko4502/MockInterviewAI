import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it } from "vitest";
import i18n from "@/shared/lib/i18n";
import type {
  ShowcaseFormValues,
  SlotFormValue,
} from "../model/showcase-form-schema";
import { ShowcaseCardForm } from "./ShowcaseCardForm";

const baseValues: ShowcaseFormValues = {
  specialization: "FRONTEND",
  level: "MIDDLE",
  language: "RU",
  skills: ["React"],
  title: "",
  bio: "",
  scheduleInfo: "",
  isUrgent: false,
  autoRenew: false,
  slots: [],
};

function Harness({ slots = [] }: { slots?: SlotFormValue[] }): ReactElement {
  const form = useForm<ShowcaseFormValues>({
    defaultValues: { ...baseValues, slots },
  });

  return (
    <ShowcaseCardForm
      form={form}
      onSubmit={() => {}}
      authorTimezone="Europe/Moscow"
    />
  );
}

describe("ShowcaseCardForm", () => {
  beforeEach(() => {
    i18n.changeLanguage("ru");
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("должен показывать блок 'Удобное время и формат', если слотов нет", () => {
    render(<Harness />);

    expect(screen.getByText("Удобное время и формат")).toBeInTheDocument();
  });

  it("должен скрывать блок 'Удобное время и формат' при наличии слотов", () => {
    render(
      <Harness
        slots={[
          {
            id: "slot-1",
            startsAtLocal: "2999-01-01T10:00",
            durationMinutes: 60,
          },
        ]}
      />,
    );

    expect(
      screen.queryByText("Удобное время и формат"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Слоты доступности")).toBeInTheDocument();
  });
});
