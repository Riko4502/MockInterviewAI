import { describe, expect, it } from "vitest";
import { addParticipantSchema } from "./participant.dto";

describe("addParticipantSchema", () => {
  const validPayload = {
    userId: "123e4567-e89b-12d3-a456-426614174000",
    role: "CANDIDATE" as const,
  };

  it("успешно валидирует корректный payload с валидным UUID", () => {
    const result = addParticipantSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("принимает допустимые роли (INTERVIEWER, OBSERVER)", () => {
    expect(
      addParticipantSchema.safeParse({
        ...validPayload,
        role: "INTERVIEWER",
      }).success,
    ).toBe(true);

    expect(
      addParticipantSchema.safeParse({
        ...validPayload,
        role: "OBSERVER",
      }).success,
    ).toBe(true);
  });

  it("отклоняет невалидный UUID", () => {
    const result = addParticipantSchema.safeParse({
      ...validPayload,
      userId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "userId must be a valid UUID",
      );
    }
  });

  it("отклоняет недопустимую роль", () => {
    const result = addParticipantSchema.safeParse({
      ...validPayload,
      role: "ADMIN",
    });
    expect(result.success).toBe(false);
  });
});
