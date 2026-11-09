import { en, type Messages } from "./en";
import { tr } from "./tr";

export const messages = { en, tr } satisfies Record<string, Messages>;
export type Locale = keyof typeof messages;
export const LOCALES = Object.keys(messages) as Locale[];

type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Paths<Messages>;
type PluralBase<K> = K extends `${infer B}_one` ? B : never;
export type PluralKey = PluralBase<MessageKey>;
export type Vars = Record<string, string | number>;

function lookup(locale: Locale, key: string): string | undefined {
  let cur: unknown = messages[locale];
  for (const part of key.split(".")) cur = (cur as Record<string, unknown> | undefined)?.[part];
  return typeof cur === "string" ? cur : undefined;
}

export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const text = lookup(locale, key) ?? lookup("en", key) ?? key;
  return vars
    ? text.replace(/%\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
    : text;
}

export function translatePlural(
  locale: Locale,
  key: PluralKey,
  count: number,
  vars?: Vars,
): string {
  const form = new Intl.PluralRules(locale).select(count) === "one" ? "one" : "other";
  return translate(locale, `${key}_${form}` as MessageKey, { count, ...vars });
}

const STORAGE_KEY = "makecord.locale";

export function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in messages) return saved as Locale;
  } catch {}
  return "en";
}

export function persistLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {}
  document.documentElement.lang = locale;
}
