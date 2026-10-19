import "@testing-library/jest-dom/vitest";
import type { AvailabilitySlot } from "@packages/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { SlotSelectorRadioGroup } from "./SlotSelectorRadioGroup";

/** Times are fixed in the far future/past so the `now()` filter is deterministic. */
const SLOTS: AvailabilitySlot[] = [
  {
    id: "slot-later",
    startsAt: "2999-01-15T16:00:00.000Z",
    durationMinutes: 60,
    status: "OPEN",
  },
  {
    id: "slot-earlier",
    startsAt: "2999-01-14T16:00:00.000Z",
    durationMinutes: 30,
    status: "OPEN",
  },
  {
    id: "slot-past",
    startsAt: "2000-01-01T10:00:00.000Z",
    durationMinutes: 60,
    status: "OPEN",
  },
  {
    id: "slot-booked",
    startsAt: "2999-01-16T16:00:00.000Z",
    durationMinutes: 60,
    status: "BOOKED",
  },
];

describe("SlotSelectorRadioGroup", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("ru");
  });

  it("показывает только будущие OPEN-слоты, отсортированные по началу", () => {
    render(
      <SlotSelectorRadioGroup
        slots={SLOTS}
        onChange={vi.fn()}
        viewerTimezone="Europe/Moscow"
        locale="ru"
      />,
    );

    const radios = screen.getAllByRole("radio");
    // BOOKED и прошедший OPEN отфильтрованы
    expect(radios).toHaveLength(2);
    // Europe/Moscow = UTC+3: 16:00Z → 19:00
    expect(radios[0]).toHaveAccessibleName(/14 января/);
    expect(radios[1]).toHaveAccessibleName(/15 января/);
    expect(screen.getByText("Выберите слот")).toBeInTheDocument();
  });

  it("ничего не рендерит, если нет актуальных OPEN-слотов", () => {
    const { container } = render(
      <SlotSelectorRadioGroup
        slots={SLOTS.filter((slot) => slot.status !== "OPEN")}
        onChange={vi.fn()}
        viewerTimezone="Europe/Moscow"
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("вызывает onChange с id выбранного слота", () => {
    const onChange = vi.fn();
    render(
      <SlotSelectorRadioGroup
        slots={SLOTS}
        onChange={onChange}
        viewerTimezone="Europe/Moscow"
      />,
    );

    fireEvent.click(screen.getAllByRole("radio")[1]);

    expect(onChange).toHaveBeenCalledWith("slot-later");
  });

  it("не вызывает onChange, когда группа disabled", () => {
    const onChange = vi.fn();
    render(
      <SlotSelectorRadioGroup
        slots={SLOTS}
        onChange={onChange}
        viewerTimezone="Europe/Moscow"
        disabled
      />,
    );

    fireEvent.click(screen.getAllByRole("radio")[0]);

    expect(onChange).not.toHaveBeenCalled();
  });
});
