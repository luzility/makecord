import type { Locale } from "@/i18n/locale";
import { type MessageKey, translate } from "@/i18n/locale";
import type { Problem } from "./api";
import { descriptorOf, fieldsOf, nodeTitle } from "./nodes";

const KEYS: Record<string, MessageKey> = {
  "unknown-node": "problems.unknownNode",
  "wrong-context": "problems.wrongContext",
  "needs-interaction": "problems.needsInteraction",
  "missing-schedule": "problems.missingSchedule",
  "missing-message": "problems.missingMessage",
  "wrong-event": "problems.wrongEvent",
  "command-conflict": "problems.commandConflict",
  "unhandled-autocomplete": "problems.unhandledAutocomplete",
  "unhandled-component": "problems.unhandledComponent",
  "invalid-field": "problems.invalidField",
  "dangling-edge": "problems.danglingEdge",
  "multiple-edges": "problems.multipleEdges",
  unreachable: "problems.unreachable",
  "missing-intent": "problems.missingIntent",
  "plugin-failed": "problems.pluginFailed",
  "plugin-incompatible": "problems.pluginIncompatible",
  "missing-function-name": "problems.missingFunctionName",
  "duplicate-function": "problems.duplicateFunction",
  "missing-function": "problems.missingFunction",
  "missing-argument": "problems.missingArgument",
};

export function problemText(p: Problem, locale: Locale): string {
  let key = KEYS[p.code];
  if (!key || !p.params) return p.message;
  const vars: Record<string, string> = { ...p.params };
  if (p.params.type) vars.node = nodeTitle(p.params.type, locale);
  if (p.code === "invalid-field") {
    const meta = p.params.type ? descriptorOf(p.params.type) : undefined;
    const field = meta && fieldsOf(meta, locale).find((f) => f.key === p.params?.field);
    if (field) vars.field = field.title;
    if (p.params.empty) key = "problems.fieldEmpty";
  }
  if (p.params.event) vars.event = translate(locale, `events.${p.params.event}` as MessageKey);
  if (p.params.kind)
    vars.kind = translate(
      locale,
      p.params.kind === "event" ? "problems.kindEvent" : "problems.kindCommand",
    );
  return translate(locale, key, vars);
}
