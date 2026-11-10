import { type CommandType, CUSTOM_ID_EVENTS, FlowEventName, messageFileOf } from "@makecord/spec";
import { useState } from "react";
import { newMessage } from "@/editors/message/model";
import { useT } from "@/i18n";
import { api } from "@/lib/api";
import { openFile } from "@/lib/dock";
import { useStore } from "@/lib/store";
import { newCommandFlow, newEventFlow, toJson } from "@/lib/templates";
import { Select } from "./Select";
import { Button, cn, Dialog, Field } from "./ui";

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
  const initial = useStore((s) => s.newFlowOpen);
  const [kind, setKind] = useState<"command" | "event" | "message">(initial || "command");
  const [messageKind, setMessageKind] = useState<"classic" | "componentsV2">("componentsV2");
  const [name, setName] = useState("");
  const [event, setEvent] = useState<FlowEventName>("guildMemberAdd");
  const [customId, setCustomId] = useState("");
  const interaction = CUSTOM_ID_EVENTS.includes(event);
  const [commandType, setCommandType] = useState<CommandType>("chatInput");
  const [error, setError] = useState<string | null>(null);
  const close = () => set({ newFlowOpen: false });
  const validName =
    kind === "message"
      ? /^[-_\p{L}\p{N}]+(\/[-_\p{L}\p{N}]+)*$/u.test(name) && name.length <= 64
      : commandType === "chatInput"
        ? /^[-_\p{Ll}\p{N}]{1,32}$/u.test(name)
        : name.trim().length > 0 && name.length <= 32;

  const create = async () => {
    const slug = customId
      .replace(/\*$/, "")
      .replace(/[^-_\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "");
    const commandSlug =
      name
        .trim()
        .toLowerCase()
        .replace(/[^-_\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "") || "command";
    const base =
      kind === "command"
        ? `commands/${commandSlug}`
        : `events/${interaction && slug ? `${event}-${slug}` : event}`;
    const path = kind === "message" ? messageFileOf(name) : await freePath(base);
    const flow =
      kind === "message"
        ? newMessage(messageKind, t("templates.messageText"))
        : kind === "command"
          ? newCommandFlow(
              name.trim(),
              t("templates.commandDescription", { name }),
              t("templates.commandReply"),
              commandType,
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
        <fieldset className="m-0 grid min-w-0 grid-cols-3 gap-1 rounded-lg border border-line bg-chrome p-1">
          {(["command", "event", "message"] as const).map((k) => (
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
              {t(`newFlow.${k}`)}
            </button>
          ))}
        </fieldset>
        {kind === "message" ? (
          <>
            <Field label={t("newFlow.messageName")} hint={t("newFlow.messageNameHint")}>
              <div className="flex items-center rounded-md border border-line bg-chrome focus-within:border-fg/40">
                <span className="pl-2 font-mono text-label text-faint">messages/</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value.replace(/\s/g, "-"))}
                  placeholder="welcome"
                  className="h-7 flex-1 bg-transparent px-1 font-mono text-label outline-none focus-visible:outline-none placeholder:text-faint"
                />
              </div>
            </Field>
            <Field label={t("message.format")} hint={t("newFlow.formatHint")}>
              <Select
                value={messageKind}
                options={[
                  { value: "componentsV2", label: t("message.componentsV2") },
                  { value: "classic", label: t("message.classic") },
                ]}
                onChange={setMessageKind}
              />
            </Field>
          </>
        ) : kind === "command" ? (
          <>
            <Field label={t("newFlow.commandType")}>
              <Select
                value={commandType}
                options={[
                  { value: "chatInput", label: t("properties.typeSlash") },
                  { value: "user", label: t("properties.typeUser") },
                  { value: "message", label: t("properties.typeMessage") },
                ]}
                onChange={setCommandType}
              />
            </Field>
            <Field
              label={t("newFlow.commandName")}
              hint={t(
                commandType === "chatInput" ? "newFlow.commandNameHint" : "properties.menuNameHint",
              )}
            >
              <div className="flex items-center rounded-md border border-line bg-chrome focus-within:border-fg/40">
                {commandType === "chatInput" && (
                  <span className="pl-2 font-mono text-label text-faint">/</span>
                )}
                <input
                  autoFocus
                  value={name}
                  maxLength={32}
                  onChange={(e) =>
                    setName(
                      commandType === "chatInput"
                        ? e.target.value.toLowerCase().replace(/\s/g, "-")
                        : e.target.value,
                    )
                  }
                  placeholder={commandType === "chatInput" ? "help" : "Report"}
                  className="h-7 flex-1 bg-transparent px-2 font-mono text-label outline-none focus-visible:outline-none placeholder:text-faint"
                />
              </div>
            </Field>
          </>
        ) : (
          <Field label={t("newFlow.eventLabel")}>
            <Select
              value={event}
              options={FlowEventName.options.map((ev) => ({ value: ev, label: t(`events.${ev}`) }))}
              onChange={setEvent}
            />
          </Field>
        )}
        {kind === "event" && interaction && (
          <Field label={t("properties.customId")} hint={t("properties.customIdHint")}>
            <input
              value={customId}
              maxLength={100}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder={event === "autocomplete" ? "search.query" : "vote:*"}
              className="h-7 w-full rounded-md border border-line bg-chrome px-2 font-mono text-label outline-none focus:border-fg/40 focus-visible:outline-none placeholder:text-faint"
            />
          </Field>
        )}
        {error && <p className="text-label text-bad">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={kind !== "event" && !validName}>
            {t("common.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
