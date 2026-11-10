import { type FunctionParam, FunctionParamType, type FunctionSignature } from "@makecord/spec";
import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/Select";
import { Field, IconButton, Input } from "@/components/ui";
import { type MessageKey, useT } from "@/i18n";
import { useStore } from "@/lib/store";

const EMPTY: FunctionSignature = { name: "", description: "", params: [] };

export function FunctionSettings({
  path,
  signature,
}: {
  path: string;
  signature: FunctionSignature | undefined;
}) {
  const { t } = useT();
  const updateFlow = useStore((s) => s.updateFlow);
  const sig = signature ?? EMPTY;
  const setSig = (patch: Partial<FunctionSignature>, key = Object.keys(patch).join(",")) =>
    updateFlow(
      path,
      (f) => (f.kind === "event" ? { ...f, function: { ...sig, ...f.function, ...patch } } : f),
      `fn:${key}`,
    );
  const setParam = (i: number, patch: Partial<FunctionParam>) =>
    setSig({ params: sig.params.map((p, j) => (i === j ? { ...p, ...patch } : p)) }, `param:${i}`);

  return (
    <>
      <Field label={t("properties.functionName")} hint={t("properties.functionNameHint")}>
        <Input
          className="font-mono"
          maxLength={64}
          value={sig.name}
          onChange={(e) => setSig({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") })}
        />
      </Field>
      <Field label={t("properties.description")} hint={t("properties.functionDescriptionHint")}>
        <textarea
          rows={3}
          maxLength={1000}
          value={sig.description}
          onChange={(e) => setSig({ description: e.target.value })}
          className="w-full resize-y rounded-md border border-line bg-chrome p-2 text-label focus:border-fg/40 focus:outline-none focus-visible:outline-none"
        />
      </Field>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-label text-muted">{t("properties.params")}</span>
          <IconButton
            label={t("properties.addParam")}
            disabled={sig.params.length >= 20}
            onClick={() =>
              setSig({
                params: [
                  ...sig.params,
                  {
                    name: `param${sig.params.length + 1}`,
                    description: "",
                    type: "string",
                    required: true,
                  },
                ],
              })
            }
          >
            <Plus size={16} strokeWidth={1.5} />
          </IconButton>
        </div>
        {sig.params.length === 0 && (
          <p className="text-meta text-faint">{t("properties.paramsHint")}</p>
        )}
        {sig.params.map((p, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-line p-2">
            <div className="flex gap-2">
              <Input
                className="font-mono"
                value={p.name}
                maxLength={64}
                onChange={(e) =>
                  setParam(i, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") })
                }
              />
              <Select
                className="w-28 shrink-0"
                value={p.type}
                options={FunctionParamType.options.map((ty) => ({
                  value: ty,
                  label: t(`properties.paramTypes.${ty}` as MessageKey),
                }))}
                onChange={(type) => setParam(i, { type })}
              />
              <IconButton
                label={t("properties.deleteParam")}
                onClick={() => setSig({ params: sig.params.filter((_, j) => j !== i) })}
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </IconButton>
            </div>
            <Input
              value={p.description}
              maxLength={500}
              placeholder={t("properties.paramDescription")}
              onChange={(e) => setParam(i, { description: e.target.value })}
            />
            <label className="flex items-center gap-2 text-label text-muted">
              <input
                type="checkbox"
                className="accent-fg"
                checked={p.required}
                onChange={(e) => setParam(i, { required: e.target.checked })}
              />
              {t("properties.required")}
            </label>
          </div>
        ))}
        <p className="text-meta text-faint">{t("properties.argsHint")}</p>
      </div>
    </>
  );
}
