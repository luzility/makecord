# @makecord/spec

[Zod](https://zod.dev) schemas and helpers for the files of a [Makecord](https://makecord.luzili.tech) project: `makecord.json`, `*.flow.json` and `*.message.json`. The IDE, the runtime and plugins all validate against these.

```ts
import { Flow, MessageDesign, ProjectConfig } from "@makecord/spec";

const flow = Flow.parse(JSON.parse(text));
```

Apache-2.0
