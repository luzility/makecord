import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";

const here = dirname(fileURLToPath(import.meta.url));

export const RUNTIME_CLI = join(here, "runtime-cli.js");
export const LANGUAGE_SERVICE = join(here, "language-service.js");

export const TEMPLATES_DIR = app.isPackaged
  ? join(process.resourcesPath, "templates")
  : join(here, "../../../../packages/templates");
