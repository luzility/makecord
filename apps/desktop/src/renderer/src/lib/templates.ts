import type { CommandFlow, EventFlow, FlowEventName } from "@makecord/spec";

export function newCommandFlow(name: string, description: string, reply: string): CommandFlow {
  return {
    specVersion: 1,
    kind: "command",
    command: { name, description, options: [] },
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

export function newEventFlow(event: FlowEventName): EventFlow {
  return {
    specVersion: 1,
    kind: "event",
    event,
    nodes: [{ id: "start", type: "core.trigger", position: { x: 0, y: 0 }, data: {} }],
    edges: [],
  };
}

export const toJson = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
