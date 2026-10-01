import { render } from "@react-email/render";
import type { ReactElement } from "react";

/**
 * Рендерит React Email компонент одновременно в HTML и чистую текстовую (plain-text) версию.
 *
 * @param element - React элемент шаблона письма (например, `<VerifyEmailTemplate {...props} />`)
 * @returns Объект с HTML-строкой и plain-text строкой для передачи в почтовый транспорт
 */
export async function renderEmail(
  element: ReactElement,
): Promise<{ html: string; text: string }> {
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text };
}
