import type { Messages } from "@packages/i18n";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: Messages;
  }
}
