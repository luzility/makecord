import { MESSAGE_FIELD_FORMAT, type NodeMeta } from "@makecord/plugin-sdk";
import {
  type EventFlow,
  type IntentName,
  isInteractionFlow,
  type LayoutBlock,
  type MessageDesign,
  matchesCustomId,
  TRIGGER_NODE_TYPE,
} from "@makecord/spec";
import type { LoadedProject } from "./project.js";

export type Severity = "error" | "warning";

export interface Problem {
  severity: Severity;
  file: string;
  nodeId?: string;
  message: string;
  code: string;
  params?: Record<string, string>;
  fix?: { kind: "addIntent"; intent: IntentName };
}

export const EVENT_INTENTS: Record<EventFlow["event"], IntentName[]> = {
  clientReady: [],
  guildMemberAdd: ["GuildMembers"],
  guildMemberRemove: ["GuildMembers"],
  messageCreate: ["GuildMessages"],
  messageUpdate: ["GuildMessages"],
  messageDelete: ["GuildMessages"],
  messageReactionAdd: ["GuildMessageReactions"],
  messageReactionRemove: ["GuildMessageReactions"],
  messagePollVoteAdd: ["GuildMessagePolls"],
  guildMemberUpdate: ["GuildMembers"],
  guildBanAdd: ["GuildModeration"],
  guildBanRemove: ["GuildModeration"],
  voiceStateUpdate: ["GuildVoiceStates"],
  channelCreate: ["Guilds"],
  channelDelete: ["Guilds"],
  threadCreate: ["Guilds"],
  roleCreate: ["Guilds"],
  roleDelete: ["Guilds"],
  inviteCreate: ["GuildInvites"],
  guildCreate: ["Guilds"],
  guildDelete: ["Guilds"],
  autoModerationActionExecution: ["AutoModerationExecution"],
  autocomplete: [],
  buttonClick: [],
  selectMenu: [],
  modalSubmit: [],
  schedule: [],
};

const READS_CONTENT = new Set<EventFlow["event"]>([
  "messageCreate",
  "messageUpdate",
  "messageDelete",
]);

export function isEmptyIssue(issue: {
  code: string;
  minimum?: unknown;
  origin?: unknown;
}): boolean {
  return issue.code === "too_small" && issue.minimum === 1 && issue.origin === "string";
}

function messageFields(meta: NodeMeta): string[] {
  return Object.entries(meta.fields.shape)
    .filter(([, field]) => {
      const m = (field as { meta?: () => Record<string, unknown> | undefined }).meta?.();
      return m?.format === MESSAGE_FIELD_FORMAT;
    })
    .map(([key]) => key);
}

type Interactive = { event: "buttonClick" | "selectMenu"; customId: string; label: string };

function interactivesOf(design: MessageDesign): Interactive[] {
  const out: Interactive[] = [];
  const visit = (blocks: readonly LayoutBlock[]) => {
    for (const b of blocks) {
      if (b.type === "row") {
        for (const c of b.components) {
          if (c.type === "select")
            out.push({ event: "selectMenu", customId: c.customId, label: c.customId });
          else if (c.style !== "link" && c.customId)
            out.push({ event: "buttonClick", customId: c.customId, label: c.label || c.customId });
        }
      } else if (b.type === "container") visit(b.components);
      else if (
        b.type === "section" &&
        b.accessory.type === "button" &&
        b.accessory.style !== "link" &&
        b.accessory.customId
      )
        out.push({
          event: "buttonClick",
          customId: b.accessory.customId,
          label: b.accessory.label || b.accessory.customId,
        });
    }
  };
  visit(design.components);
  return out;
}

export function inspectProject(project: LoadedProject, metas: readonly NodeMeta[]): Problem[] {
  const byType = new Map(metas.map((m) => [m.type, m]));
  const problems: Problem[] = project.problems.map((p) => ({
    severity: "error",
    file: p.file,
    message: p.message,
    code: "invalid-file",
  }));

  const handlers = project.flows.flatMap(({ flow }) =>
    flow.kind === "event" ? [{ event: flow.event, customId: flow.customId }] : [],
  );
  for (const { file, design } of project.messages.values()) {
    for (const item of interactivesOf(design)) {
      if (item.customId.includes("{{")) continue;
      const handled = handlers.some(
        (h) => h.event === item.event && matchesCustomId(h.customId, item.customId),
      );
      if (!handled) {
        problems.push({
          severity: "warning",
          file,
          code: "unhandled-component",
          message: `Nothing runs when "${item.label}" is used. Add a ${item.event} flow with custom ID ${item.customId}`,
          params: { label: item.label, customId: item.customId, event: item.event },
        });
      }
    }
  }

  const byName = new Map<string, { file: string; sub: boolean }[]>();
  const autocompleteIds = project.flows.flatMap(({ flow }) =>
    flow.kind === "event" && flow.event === "autocomplete" ? [flow.customId] : [],
  );
  for (const { file, flow } of project.flows) {
    if (flow.kind !== "command" || flow.command.type !== "chatInput") continue;
    const list = byName.get(flow.command.name) ?? [];
    list.push({ file, sub: Boolean(flow.command.subcommand) });
    byName.set(flow.command.name, list);
    const path = [flow.command.name, flow.command.group?.name, flow.command.subcommand?.name]
      .filter(Boolean)
      .join(".");
    for (const o of flow.command.options) {
      if (!o.autocomplete) continue;
      const id = `${path}.${o.name}`;
      if (!autocompleteIds.some((p) => matchesCustomId(p, id))) {
        problems.push({
          severity: "warning",
          file,
          code: "unhandled-autocomplete",
          message: `Option ${o.name} uses autocomplete, but no autocomplete flow has the custom ID ${id}`,
          params: { option: o.name, customId: id },
        });
      }
    }
  }
  for (const [name, list] of byName) {
    if (list.some((l) => l.sub) && list.some((l) => !l.sub)) {
      for (const l of list.filter((x) => !x.sub)) {
        problems.push({
          severity: "error",
          file: l.file,
          code: "command-conflict",
          message: `/${name} has subcommands in other files, so this flow needs a subcommand too`,
          params: { name },
        });
      }
    }
    if (list.filter((l) => l.sub).length > 25) {
      problems.push({
        severity: "error",
        file: list[0]!.file,
        code: "command-conflict",
        message: `/${name} has more than 25 subcommands`,
        params: { name },
      });
    }
  }

  for (const { file, flow } of project.flows) {
    const ids = new Set(flow.nodes.map((n) => n.id));

    for (const node of flow.nodes) {
      const meta = byType.get(node.type);
      if (!meta) {
        problems.push({
          severity: "error",
          file,
          nodeId: node.id,
          code: "unknown-node",
          message: `Unknown node type "${node.type}" (is its plugin installed?)`,
          params: { type: node.type },
        });
        continue;
      }
      if (meta.needsInteraction && !isInteractionFlow(flow)) {
        problems.push({
          severity: "error",
          file,
          nodeId: node.id,
          code: "needs-interaction",
          message: `"${meta.title}" needs a command, button, menu or form to answer`,
          params: { type: node.type },
        });
      }
      if (meta.events && !(flow.kind === "event" && meta.events.includes(flow.event))) {
        problems.push({
          severity: "error",
          file,
          nodeId: node.id,
          code: "wrong-event",
          message: `"${meta.title}" only works in ${meta.events.join(", ")} flows`,
          params: { type: node.type, events: meta.events.join(", ") },
        });
      }
      if (meta.contexts && !meta.contexts.includes(flow.kind)) {
        problems.push({
          severity: "error",
          file,
          nodeId: node.id,
          code: "wrong-context",
          message: `"${meta.title}" can't be used in ${flow.kind} flows`,
          params: { type: node.type, kind: flow.kind },
        });
      }
      for (const key of messageFields(meta)) {
        const name = String(node.data[key] ?? "").trim();
        if (name && !project.messages.has(name)) {
          problems.push({
            severity: "error",
            file,
            nodeId: node.id,
            code: "missing-message",
            message: `Message design "${name}" doesn't exist in messages/`,
            params: { type: node.type, name },
          });
        }
      }
      const res = meta.fields.safeParse(node.data);
      if (!res.success) {
        for (const issue of res.error.issues) {
          problems.push({
            severity: "error",
            file,
            nodeId: node.id,
            code: "invalid-field",
            message: `${meta.title} › ${issue.path.join(".")}: ${issue.message}`,
            params: {
              type: node.type,
              field: issue.path.join("."),
              issue: issue.message,
              ...(isEmptyIssue(issue) ? { empty: "true" } : {}),
            },
          });
        }
      }
    }

    const usedPorts = new Set<string>();
    for (const edge of flow.edges) {
      if (!ids.has(edge.source) || !ids.has(edge.target)) {
        problems.push({
          severity: "error",
          file,
          code: "dangling-edge",
          message: `Connection ${edge.id} points to a node that doesn't exist`,
          params: { edge: edge.id },
        });
      }
      const key = `${edge.source}:${edge.sourceHandle}`;
      if (usedPorts.has(key)) {
        problems.push({
          severity: "warning",
          file,
          nodeId: edge.source,
          code: "multiple-edges",
          message: `More than one connection leaves "${edge.sourceHandle}"; only the first runs`,
          params: { port: edge.sourceHandle },
        });
      }
      usedPorts.add(key);
    }

    const trigger = flow.nodes.find((n) => n.type === TRIGGER_NODE_TYPE);
    if (trigger) {
      const seen = new Set([trigger.id]);
      const queue = [trigger.id];
      while (queue.length) {
        const id = queue.shift();
        for (const e of flow.edges) {
          if (e.source === id && !seen.has(e.target)) {
            seen.add(e.target);
            queue.push(e.target);
          }
        }
      }
      for (const node of flow.nodes) {
        if (!seen.has(node.id)) {
          problems.push({
            severity: "warning",
            file,
            nodeId: node.id,
            code: "unreachable",
            message: `"${byType.get(node.type)?.title ?? node.type}" never runs (not connected to Start)`,
            params: { type: node.type },
          });
        }
      }
    }

    if (flow.kind === "event" && flow.event === "schedule" && !flow.schedule) {
      problems.push({
        severity: "error",
        file,
        code: "missing-schedule",
        params: {},
        message: "A schedule flow needs a time: every N minutes, or daily at HH:MM",
      });
    }

    if (
      flow.kind === "event" &&
      READS_CONTENT.has(flow.event) &&
      !project.config.intents.includes("MessageContent") &&
      JSON.stringify(flow.nodes.map((n) => n.data)).includes("message.content")
    ) {
      problems.push({
        severity: "warning",
        file,
        code: "missing-intent",
        message: `Reading {{message.content}} needs the MessageContent intent`,
        params: { event: flow.event, intent: "MessageContent" },
        fix: { kind: "addIntent", intent: "MessageContent" },
      });
    }

    if (flow.kind === "event") {
      for (const intent of EVENT_INTENTS[flow.event]) {
        if (!project.config.intents.includes(intent)) {
          problems.push({
            severity: "warning",
            file,
            code: "missing-intent",
            message: `"${flow.event}" needs the ${intent} intent`,
            params: { event: flow.event, intent },
            fix: { kind: "addIntent", intent },
          });
        }
      }
    }
  }
  return problems;
}
