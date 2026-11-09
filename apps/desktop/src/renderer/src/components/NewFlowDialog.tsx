import { FlowEventName, INTERACTION_EVENTS } from "@makecord/spec";
import { useState } from "react";
import { useT } from "@/i18n";
import { api } from "@/lib/api";
import { openFile } from "@/lib/dock";
import { useStore } from "@/lib/store";
import { newCommandFlow, newEventFlow, toJson } from "@/lib/templates";
import { Button, cn, Dialog, Field, selectCls } from "./ui";

async function freePath(base: string) {
  for (let n = 1; n < 100; n++) {
    const path = n === 1 ? `${base}.flow.json` : `${base}-${n}.flow.json`;
    if ((await api.fs.readOptional(path)) === null) return path;
  }
  return `${base}-${Date.now()}.flow.json`;
}

export function NewFlowDialog() {
  const { t } = useT();
  const set = useStore((s) => s.set);
  const [kind, setKind] = useState<"command" | "event">("command");
  const [name, setName] = useState("");
  const [event, setEvent] = useState<FlowEventName>("guildMemberAdd");
  const [customId, setCustomId] = useState("");
  const interaction = INTERACTION_EVENTS.includes(event);
  const [error, setError] = useState<string | null>(null);
  const close = () => set({ newFlowOpen: false });
  const validName = /^[-_\p{Ll}\p{N}]{1,32}$/u.test(name);

  const create = async () => {
    const slug = customId
      .replace(/\*$/, "")
      .replace(/[^-_\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "");
    const base =
      kind === "command"
        ? `commands/${name}`
        : `events/${interaction && slug ? `${event}-${slug}` : event}`;
    const path = kind === "command" ? `${base}.flow.json` : await freePath(base);
    const flow =
      kind === "command"
        ? newCommandFlow(
            name,
            t("templates.commandDescription", { name }),
            t("templates.commandReply"),
          )
        : newEventFlow(event, customId.trim() || undefined);
    try {
      await api.fs.create(path, toJson(flow));
      close();
      await useStore.getState().refreshTree();
      await openFile(path);
    } catch (e) {
      setError(
        (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ""),
      );
    }
  };

  return (
    <Dialog title={t("newFlow.title")} onClose={close}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (kind === "event" || validName) void create();
        }}
      >
        <fieldset className="m-0 grid min-w-0 grid-cols-2 gap-1 rounded-lg border border-line bg-chrome p-1">
          {(["command", "event"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "h-7 rounded-md text-label transition-colors duration-150 ease-out",
                kind === k ? "bg-hover text-fg" : "text-faint hover:text-fg",
              )}
            >
              {t(k === "command" ? "newFlow.command" : "newFlow.event")}
            </button>
          ))}
        </fieldset>
        {kind === "command" ? (
          <Field label={t("newFlow.commandName")} hint={t("newFlow.commandNameHint")}>
            <div className="flex items-center rounded-md border border-line bg-chrome focus-within:border-fg/40">
              <span className="pl-2 font-mono text-label text-faint">/</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s/g, "-"))}
                placeholder="help"
                className="h-7 flex-1 bg-transparent px-1 font-mono text-label outline-none focus-visible:outline-none placeholder:text-faint"
              />
            </div>
          </Field>
        ) : (
          <Field label={t("newFlow.eventLabel")}>
            <select
              value={event}
              onChange={(e) => setEvent(e.target.value as FlowEventName)}
              className={selectCls}
            >
              {FlowEventName.options.map((ev) => (
                <option key={ev} value={ev}>
                  {t(`events.${ev}`)}
                </option>
              ))}
            </select>
          </Field>
        )}
        {kind === "event" && interaction && (
          <Field label={t("properties.customId")} hint={t("properties.customIdHint")}>
            <input
              value={customId}
              maxLength={100}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="vote:*"
              className="h-7 w-full rounded-md border border-line bg-chrome px-2 font-mono text-label outline-none focus:border-fg/40 focus-visible:outline-none placeholder:text-faint"
            />
          </Field>
        )}
        {error && <p className="text-label text-bad">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={kind === "command" && !validName}>
            {t("common.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
