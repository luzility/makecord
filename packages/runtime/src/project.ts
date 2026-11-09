import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import {
  FLOW_FILE_SUFFIX,
  Flow,
  MESSAGE_FILE_SUFFIX,
  MessageDesign,
  messageNameOf,
  PROJECT_FILE,
  ProjectConfig,
  TRIGGER_NODE_TYPE,
} from "@makecord/spec";

export interface LoadedFlow {
  file: string;
  flow: Flow;
}

export interface LoadedMessage {
  file: string;
  name: string;
  design: MessageDesign;
}

export interface ProjectProblem {
  file: string;
  message: string;
}

export interface LoadedProject {
  dir: string;
  config: ProjectConfig;
  flows: LoadedFlow[];
  messages: Map<string, LoadedMessage>;
  problems: ProjectProblem[];
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith(FLOW_FILE_SUFFIX) || e.name.endsWith(MESSAGE_FILE_SUFFIX)) yield p;
  }
}

const formatZod = (issues: { path: PropertyKey[]; message: string }[]) =>
  issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");

export async function loadProject(dir: string): Promise<LoadedProject> {
  const raw = JSON.parse(await readFile(join(dir, PROJECT_FILE), "utf8"));
  const parsed = ProjectConfig.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`${PROJECT_FILE} is invalid: ${formatZod(parsed.error.issues)}`);
  }

  const flows: LoadedFlow[] = [];
  const problems: ProjectProblem[] = [];
  const commandNames = new Map<string, string>();
  const messages = new Map<string, LoadedMessage>();

  for await (const path of walk(dir)) {
    const file = relative(dir, path).split(sep).join("/");
    let json: unknown;
    try {
      json = JSON.parse(await readFile(path, "utf8"));
    } catch (e) {
      problems.push({ file, message: `Couldn't parse JSON: ${(e as Error).message}` });
      continue;
    }
    if (file.endsWith(MESSAGE_FILE_SUFFIX)) {
      const name = messageNameOf(file);
      if (!name) {
        problems.push({ file, message: "Message designs have to be inside the messages/ folder" });
        continue;
      }
      const msg = MessageDesign.safeParse(json);
      if (!msg.success) problems.push({ file, message: formatZod(msg.error.issues) });
      else messages.set(name, { file, name, design: msg.data });
      continue;
    }
    const res = Flow.safeParse(json);
    if (!res.success) {
      problems.push({ file, message: formatZod(res.error.issues) });
      continue;
    }
    const flow = res.data;
    const triggers = flow.nodes.filter((n) => n.type === TRIGGER_NODE_TYPE);
    if (triggers.length !== 1) {
      problems.push({
        file,
        message: `A flow needs exactly one Start node (found ${triggers.length})`,
      });
      continue;
    }
    if (flow.kind === "command") {
      const dup = commandNames.get(flow.command.name);
      if (dup) {
        problems.push({
          file,
          message: `/${flow.command.name} is already defined in ${dup}`,
        });
        continue;
      }
      commandNames.set(flow.command.name, file);
    }
    flows.push({ file, flow });
  }

  return { dir, config: parsed.data, flows, messages, problems };
}
