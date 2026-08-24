import type { SchemaObject } from "@nestjs/swagger";
import { loginSchema, registerSchema } from "@packages/dto";
import { ZodBody, zodToSchemaObject } from "./zod-openapi";

function propertyOf(schema: SchemaObject, name: string): SchemaObject {
  return (schema.properties as Record<string, SchemaObject>)[name];
}

describe("zodToSchemaObject", () => {
  it("registerSchema: тип object и required [email, password]", () => {
    const schema = zodToSchemaObject(registerSchema);
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["email", "password"]);
  });

  it("registerSchema: email — строка с format email", () => {
    const schema = zodToSchemaObject(registerSchema);
    const email = propertyOf(schema, "email");
    expect(email.type).toBe("string");
    expect(email.format).toBe("email");
    expect(email.minLength).toBe(1);
  });

  it("registerSchema: password — длина 12..128", () => {
    const schema = zodToSchemaObject(registerSchema);
    const password = propertyOf(schema, "password");
    expect(password.type).toBe("string");
    expect(password.minLength).toBe(12);
    expect(password.maxLength).toBe(128);
  });

  it("loginSchema: password допускает minLength 1", () => {
    const schema = zodToSchemaObject(loginSchema);
    const password = propertyOf(schema, "password");
    expect(password.minLength).toBe(1);
    expect(password.maxLength).toBe(128);
  });

  it(".transform шаги не ломают конвертацию (io: input)", () => {
    // email в registerSchema содержит .transform(normalizeEmail)
    expect(() => zodToSchemaObject(registerSchema)).not.toThrow();
  });

  it("служебное поле $schema удаляется", () => {
    const schema = zodToSchemaObject(registerSchema);
    expect((schema as Record<string, unknown>).$schema).toBeUndefined();
  });
});

describe("ZodBody", () => {
  it("возвращает декоратор, устанавливающий схему тела в метаданных", () => {
    class Dummy {
      handler(): void {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Dummy.prototype,
      "handler",
    );
    expect(descriptor).toBeDefined();
    if (!descriptor) {
      return;
    }

    ZodBody(registerSchema)(Dummy.prototype, "handler", descriptor);

    // ApiBody сохраняет параметры под ключом swagger/apiParameters
    const parameters = Reflect.getMetadata(
      "swagger/apiParameters",
      descriptor.value,
    ) as Array<{ in: string; schema: SchemaObject }> | undefined;
    const body = parameters?.find((parameter) => parameter.in === "body");
    expect(body?.schema?.required).toEqual(["email", "password"]);
    expect(body && propertyOf(body.schema, "email").format).toBe("email");
  });
});
