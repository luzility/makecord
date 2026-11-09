import { useCallback } from "react";
import { useStore } from "@/lib/store";
import { type MessageKey, type PluralKey, translate, translatePlural, type Vars } from "./locale";

export * from "./locale";

export function useT() {
  const locale = useStore((s) => s.locale);
  const t = useCallback((key: MessageKey, vars?: Vars) => translate(locale, key, vars), [locale]);
  const tn = useCallback(
    (key: PluralKey, count: number, vars?: Vars) => translatePlural(locale, key, count, vars),
    [locale],
  );
  return { t, tn, locale };
}
