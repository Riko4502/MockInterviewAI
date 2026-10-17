import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it } from "vitest";
import i18n from "@/shared/lib/i18n";
import type {
  ShowcaseFormValues,
  SlotFormValue,
} from "../model/showcase-form-schema";
import { SlotPickerField } from "./SlotPickerField";

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

function Harness({
  defaultSlots = [],
  authorTimezone = "UTC",
}: {
  defaultSlots?: SlotFormValue[];
  authorTimezone?: string;
}): ReactElement {
  const form = useForm<ShowcaseFormValues>({
    defaultValues: { ...baseValues, slots: defaultSlots },
  });

  return (
    <SlotPickerField control={form.control} authorTimezone={authorTimezone} />
  );
}

describe("SlotPickerField", () => {
  beforeEach(() => {
    i18n.changeLanguage("ru");
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("должен добавлять слот при заполнении даты и времени", () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("Дата"), {
      target: { value: "2999-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Время начала"), {
      target: { value: "10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Добавить слот/i }));

    const slotItem = screen.getByRole("listitem");
    expect(within(slotItem).getByText(/10:00/)).toBeInTheDocument();
    expect(within(slotItem).getByText(/60 мин/)).toBeInTheDocument();
  });

  it("должен удалять открытый слот", () => {
    render(
      <Harness
        defaultSlots={[
          {
            id: "slot-1",
            startsAtLocal: "2999-01-01T10:00",
            durationMinutes: 60,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));

    expect(screen.queryByText(/10:00/)).not.toBeInTheDocument();
  });

  it("должен блокировать удаление занятого слота", () => {
    render(
      <Harness
        defaultSlots={[
          {
            id: "slot-1",
            startsAtLocal: "2999-01-01T10:00",
            durationMinutes: 60,
            booked: true,
          },
        ]}
      />,
    );

    expect(screen.getByText("Забронирован")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Нельзя удалить забронированный слот",
      }),
    ).toBeDisabled();
  });

  it("должен блокировать добавление при достижении лимита", () => {
    const slots: SlotFormValue[] = Array.from({ length: 10 }, (_, i) => ({
      id: `slot-${i}`,
      startsAtLocal: `2999-01-${String(i + 1).padStart(2, "0")}T10:00`,
      durationMinutes: 60,
    }));

    render(<Harness defaultSlots={slots} />);

    expect(
      screen.getByRole("button", { name: /Достигнут лимит из 10 слотов/i }),
    ).toBeDisabled();
    expect(screen.getByText("10/10")).toBeInTheDocument();
  });

  it("должен показывать ошибку при попытке добавить слот в прошлом", () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("Дата"), {
      target: { value: "2000-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Время начала"), {
      target: { value: "10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Добавить слот/i }));

    expect(
      screen.getByText("Нельзя добавить слот в прошлом"),
    ).toBeInTheDocument();
  });
});
