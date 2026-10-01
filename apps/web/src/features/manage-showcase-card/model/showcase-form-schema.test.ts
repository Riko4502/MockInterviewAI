import { describe, expect, it } from "vitest";
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
});
