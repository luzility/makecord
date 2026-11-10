# @makecord/plugin-sdk

Write plugins that add blocks to [Makecord](https://makecord.luzili.tech).

```ts
import { defineNode, defineNodeMeta, definePlugin } from "@makecord/plugin-sdk";
import { z } from "zod";

const roll = defineNodeMeta({
  type: "dice.roll",
  title: "Roll Dice",
  category: "data",
  fields: z.object({ sides: z.coerce.number().int().min(2).default(6) }),
});

export default definePlugin({
  id: "makecord-plugin-dice",
  version: "1.0.0",
  engines: { makecord: "^0.1.0" },
  nodes: [
    defineNode(roll, (ctx, { sides }) => {
      ctx.vars.set("roll", 1 + Math.floor(Math.random() * sides));
    }),
  ],
});
```

Publish your plugin with the `makecord-plugin` keyword to list it in the IDE's marketplace. The full guide is at [Writing plugins](https://makecord.luzili.tech/docs/writing-plugins/).

Apache-2.0
