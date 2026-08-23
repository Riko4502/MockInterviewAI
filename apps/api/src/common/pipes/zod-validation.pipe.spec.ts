import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe";

const simpleSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email"),
  name: z.string().min(1, "Name is required"),
});

const nestedSchema = z.object({
  user: z.object({
    address: z.object({
      city: z.string().min(1, "City is required"),
    }),
  }),
});

describe("ZodValidationPipe", () => {
  let pipe: ZodValidationPipe;

  describe("валидные данные", () => {
    beforeEach(() => {
      pipe = new ZodValidationPipe(simpleSchema);
    });

    it("проходит валидацию и возвращает данные", () => {
      const input = { email: "user@example.com", name: "Alice" };
      const result = pipe.transform(input, { type: "body", metatype: Object });
      expect(result).toEqual(input);
    });

    it("нормализует данные через transform в схеме", () => {
      const schema = z.object({
        email: z.string().trim().toLowerCase(),
      });
      const p = new ZodValidationPipe(schema);
      const result = p.transform(
        { email: "  USER@EXAMPLE.COM  " },
        { type: "body", metatype: Object },
      );
      expect(result).toEqual({ email: "user@example.com" });
    });
  });

  describe("невалидные данные", () => {
    beforeEach(() => {
      pipe = new ZodValidationPipe(simpleSchema);
    });

    it("бросает BadRequestException (400)", () => {
      expect(() =>
        pipe.transform(
          { email: "", name: "" },
          { type: "body", metatype: Object },
        ),
      ).toThrow(BadRequestException);
    });

    it("содержит statusCode 400", () => {
      try {
        pipe.transform(
          { email: "", name: "" },
          { type: "body", metatype: Object },
        );
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect((e as BadRequestException).getStatus()).toBe(400);
      }
    });

    it("форматирует ошибки как { field: message }", () => {
      try {
        pipe.transform(
          { email: "not-an-email", name: "" },
          { type: "body", metatype: Object },
        );
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        const response = (e as BadRequestException).getResponse();
        expect(response).toEqual({
          email: "Invalid email",
          name: "Name is required",
        });
      }
    });

    it("одна ошибка — один ключ в объекте", () => {
      try {
        pipe.transform(
          { email: "valid@example.com", name: "" },
          { type: "body", metatype: Object },
        );
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        const response = (e as BadRequestException).getResponse() as Record<
          string,
          string
        >;
        expect(Object.keys(response)).toEqual(["name"]);
      }
    });
  });

  describe("вложенные пути", () => {
    beforeEach(() => {
      pipe = new ZodValidationPipe(nestedSchema);
    });

    it("форматирует вложенные пути через точку", () => {
      try {
        pipe.transform(
          { user: { address: { city: "" } } },
          { type: "body", metatype: Object },
        );
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        const response = (e as BadRequestException).getResponse();
        expect(response).toEqual({
          "user.address.city": "City is required",
        });
      }
    });
  });

  describe("корневые ошибки", () => {
    it("использует _root для ошибок без path", () => {
      const schema = z.string().min(1, "Value is required");
      pipe = new ZodValidationPipe(schema);
      try {
        pipe.transform("", { type: "body", metatype: Object });
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        const response = (e as BadRequestException).getResponse();
        expect(response).toEqual({ _root: "Value is required" });
      }
    });
  });
});
