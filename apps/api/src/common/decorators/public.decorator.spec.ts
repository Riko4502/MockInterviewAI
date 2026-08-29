import { IS_PUBLIC_KEY, Public } from "./public.decorator";

describe("@Public() decorator", () => {
  it("возвращает функцию (decorator)", () => {
    const decorator = Public();
    expect(typeof decorator).toBe("function");
  });

  it("использует правильный ключ метаданных IS_PUBLIC_KEY", () => {
    expect(IS_PUBLIC_KEY).toBe("isPublic");
  });

  it("устанавливает метаданные через SetMetadata — проверка через Reflector", () => {
    const { Reflector } = require("@nestjs/core");
    const reflector = new Reflector();

    class TestController {
      @Public()
      publicMethod() {}

      protectedMethod() {}
    }

    const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      TestController.prototype.publicMethod,
      TestController,
    ]);
    expect(isPublic).toBe(true);

    const isNotPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      TestController.prototype.protectedMethod,
      TestController,
    ]);
    expect(isNotPublic).toBeFalsy();
  });
});
