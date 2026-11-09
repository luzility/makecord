import type { MessageKey } from "@/i18n/locale";

const KEYS: Record<string, MessageKey> = {
  "missing-token": "runErrors.missingToken",
  "login-failed": "runErrors.loginFailed",
};

export const runErrorKey = (code?: string): MessageKey | undefined =>
  code ? KEYS[code] : undefined;
