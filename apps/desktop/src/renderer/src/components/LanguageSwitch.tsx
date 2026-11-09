import { LOCALES, useT } from "@/i18n";
import { useStore } from "@/lib/store";
import { cn } from "./ui";

export function LanguageSwitch() {
  const { t, locale } = useT();
  const setLocale = useStore((s) => s.setLocale);
  return (
    <fieldset
      aria-label={t("welcome.language")}
      className="m-0 flex min-w-0 rounded-md border border-line p-0.5"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          onClick={() => setLocale(l)}
          className={cn(
            "h-6 rounded px-2 text-meta transition-colors duration-150 ease-out",
            locale === l ? "bg-hover text-fg" : "text-faint hover:text-fg",
          )}
        >
          {t(`languages.${l}`)}
        </button>
      ))}
    </fieldset>
  );
}
