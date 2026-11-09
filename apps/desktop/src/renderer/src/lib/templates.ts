import {
  type CommandFlow,
  type CommandType,
  CUSTOM_ID_EVENTS,
  type EventFlow,
  type FlowEventName,
} from "@makecord/spec";

export function newCommandFlow(
  name: string,
  description: string,
  reply: string,
  type: CommandType = "chatInput",
): CommandFlow {
  return {
    specVersion: 1,
    kind: "command",
    command: { type, name, description: type === "chatInput" ? description : "", options: [] },
    nodes: [
      { id: "start", type: "core.trigger", position: { x: 0, y: 0 }, data: {} },
      {
        id: "reply",
        type: "core.reply",
        position: { x: 320, y: 0 },
        data: { content: reply, ephemeral: false },
      },
    ],
    edges: [{ id: "e1", source: "start", sourceHandle: "next", target: "reply" }],
  };
}

export function newEventFlow(event: FlowEventName, customId?: string): EventFlow {
  return {
    specVersion: 1,
    kind: "event",
    event,
    ...(CUSTOM_ID_EVENTS.includes(event) && customId ? { customId } : {}),
    ...(event === "schedule" ? { schedule: { everyMinutes: 60 } } : {}),
    nodes: [{ id: "start", type: "core.trigger", position: { x: 0, y: 0 }, data: {} }],
    edges: [],
  };
}

export const toJson = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
