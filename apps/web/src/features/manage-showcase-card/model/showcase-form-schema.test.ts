import { describe, expect, it, vi } from "vitest";
import {
  createShowcaseFormSchema,
  type ShowcaseFormValues,
  toCreateShowcaseCardDto,
  toUpdateShowcaseCardDto,
} from "./showcase-form-schema";

const mockT = (key: string) => key;

describe("showcase-form-schema", () => {
  const schema = createShowcaseFormSchema(mockT);

  const validFormValues: ShowcaseFormValues = {
    specialization: "FRONTEND",
    level: "MIDDLE",
    language: "RU",
    skills: ["React", "TypeScript"],
    title: "Готовлюсь к собеседованию",
    bio: "Опыт 3 года, ищу mock-интервью",
    scheduleInfo: "Будни вечер",
    isUrgent: true,
    autoRenew: false,
  };

  it("должен успешно валидировать корректные данные", () => {
    const result = schema.safeParse(validFormValues);
    expect(result.success).toBe(true);
  });

  it("должен возвращать ошибку, если массив навыков пуст", () => {
    const invalidValues = {
      ...validFormValues,
      skills: [],
    };
    const result = schema.safeParse(invalidValues);
    expect(result.success).toBe(false);
  });

  it("должен фильтровать пустые строки в массиве навыков", () => {
    const valuesWithEmptySkills = {
      ...validFormValues,
      skills: ["React", "  ", "", "TypeScript"],
    };
    const result = schema.parse(valuesWithEmptySkills);
    expect(result.skills).toEqual(["React", "TypeScript"]);
  });

  it("должен возвращать ошибку, если навыков больше 20", () => {
    const tooManySkills = {
      ...validFormValues,
      skills: Array.from({ length: 21 }, (_, i) => `Skill${i}`),
    };
    const result = schema.safeParse(tooManySkills);
    expect(result.success).toBe(false);
  });

  it("должен возвращать ошибку, если заголовок длиннее 100 символов", () => {
    const tooLongTitle = {
      ...validFormValues,
      title: "a".repeat(101),
    };
    const result = schema.safeParse(tooLongTitle);
    expect(result.success).toBe(false);
  });

  it("toCreateShowcaseCardDto должен корректно приводить данные к DTO", () => {
    const dto = toCreateShowcaseCardDto(validFormValues);

    expect(dto).toEqual({
      specialization: "FRONTEND",
      level: "MIDDLE",
      language: "RU",
      skills: ["React", "TypeScript"],
      title: "Готовлюсь к собеседованию",
      bio: "Опыт 3 года, ищу mock-интервью",
      scheduleInfo: "Будни вечер",
      isUrgent: true,
      autoRenew: false,
    });
  });

  it("toUpdateShowcaseCardDto должен возвращать dto для частичного обновления", () => {
    const dto = toUpdateShowcaseCardDto({
      ...validFormValues,
      title: "",
      bio: "",
    });

    expect(dto.title).toBeNull();
    expect(dto.bio).toBeNull();
  });

  describe("слоты доступности", () => {
    const futureSlot = {
      startsAtLocal: "2999-01-01T10:00",
      durationMinutes: 60,
    };

    it("должен принимать корректный будущий слот", () => {
      const result = schema.safeParse({
        ...validFormValues,
        slots: [futureSlot],
      });
      expect(result.success).toBe(true);
    });

    it("должен отклонять слот в прошлом", () => {
      const result = schema.safeParse({
        ...validFormValues,
        slots: [{ startsAtLocal: "2000-01-01T10:00", durationMinutes: 60 }],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("slots.cannotAddInPast");
      }
    });

    it("должен проверять 'не в прошлом' относительно фиксированных часов", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));

      const pastResult = schema.safeParse({
        ...validFormValues,
        slots: [{ startsAtLocal: "2026-06-01T11:59", durationMinutes: 60 }],
      });
      const futureResult = schema.safeParse({
        ...validFormValues,
        slots: [{ startsAtLocal: "2026-06-01T12:01", durationMinutes: 60 }],
      });

      vi.useRealTimers();

      expect(pastResult.success).toBe(false);
      expect(futureResult.success).toBe(true);
    });

    it("должен отклонять более 10 открытых слотов", () => {
      const slots = Array.from({ length: 11 }, (_, i) => ({
        startsAtLocal: `2999-01-${String(i + 1).padStart(2, "0")}T10:00`,
        durationMinutes: 60,
      }));
      const result = schema.safeParse({ ...validFormValues, slots });
      expect(result.success).toBe(false);
    });

    it("не должен считать занятые слоты в лимит", () => {
      const slots = Array.from({ length: 11 }, (_, i) => ({
        startsAtLocal: `2999-01-${String(i + 1).padStart(2, "0")}T10:00`,
        durationMinutes: 60,
        booked: true,
      }));
      const result = schema.safeParse({ ...validFormValues, slots });
      expect(result.success).toBe(true);
    });

    it("должен исключать занятые слоты из DTO", () => {
      const dto = toCreateShowcaseCardDto({
        ...validFormValues,
        slots: [
          { id: "1", ...futureSlot, booked: false },
          {
            id: "2",
            startsAtLocal: "2999-02-01T10:00",
            durationMinutes: 45,
            booked: true,
          },
        ],
      });

      expect(dto.slots).toEqual([
        { startsAtLocal: futureSlot.startsAtLocal, durationMinutes: 60 },
      ]);
    });

    it("должен не передавать slots, если открытых слотов нет", () => {
      const dto = toCreateShowcaseCardDto({
        ...validFormValues,
        slots: [
          {
            id: "1",
            startsAtLocal: "2999-02-01T10:00",
            durationMinutes: 45,
            booked: true,
          },
        ],
      });

      expect(dto.slots).toBeUndefined();
    });

    it("должен не передавать slots, если массив слотов пуст", () => {
      const dto = toCreateShowcaseCardDto({
        ...validFormValues,
        slots: [],
      });

      expect(dto.slots).toBeUndefined();
    });
  });
});
