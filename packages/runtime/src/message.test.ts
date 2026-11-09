import assert from "node:assert/strict";
import { test } from "node:test";
import { MessageDesign } from "@makecord/spec";
import { buildMessage, parseEmoji } from "./message.js";

const scope = { user: { displayName: "Luzi", avatar: "https://cdn/a.png" }, vars: { votes: 3 } };

test("classic designs become content, embeds and rows", () => {
  const design = MessageDesign.parse({
    specVersion: 1,
    kind: "classic",
    content: "Hi {{user.displayName}}",
    embeds: [
      {
        title: "Votes: {{vars.votes}}",
        color: "#5865f2",
        thumbnail: "{{user.avatar}}",
        fields: [{ name: "Empty", value: "{{vars.missing}}" }],
      },
      { title: "{{vars.missing}}" },
    ],
    components: [
      {
        type: "row",
        components: [
          { type: "button", label: "Yes", customId: "vote:yes", emoji: "👍" },
          { type: "button", style: "link", label: "Docs", url: "https://makecord.dev" },
        ],
      },
    ],
  });
  const built = buildMessage(design, scope);
  assert.equal(built.content, "Hi Luzi");
  assert.equal(built.flags, undefined);
  assert.equal(built.embeds?.length, 1);
  assert.equal(built.embeds?.[0]?.title, "Votes: 3");
  assert.equal(built.embeds?.[0]?.color, 0x5865f2);
  assert.deepEqual(built.embeds?.[0]?.thumbnail, { url: "https://cdn/a.png" });
  assert.deepEqual(built.embeds?.[0]?.fields, [{ name: "Empty", value: "​", inline: false }]);
  assert.deepEqual(built.components, [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 1,
          label: "Yes",
          emoji: { name: "👍" },
          disabled: undefined,
          custom_id: "vote:yes",
        },
        {
          type: 2,
          style: 5,
          label: "Docs",
          emoji: undefined,
          disabled: undefined,
          url: "https://makecord.dev",
        },
      ],
    },
  ]);
});

test("components v2 designs set the flag and nest containers", () => {
  const design = MessageDesign.parse({
    specVersion: 1,
    kind: "componentsV2",
    components: [
      {
        type: "container",
        accentColor: "#ff0000",
        components: [
          { type: "text", content: "## Hello {{user.displayName}}" },
          { type: "separator" },
          {
            type: "section",
            texts: ["Votes: {{vars.votes}}"],
            accessory: { type: "thumbnail", url: "{{user.avatar}}" },
          },
          { type: "text", content: "{{vars.missing}}" },
        ],
      },
    ],
  });
  const built = buildMessage(design, scope);
  assert.equal(built.flags, 1 << 15);
  assert.equal(built.content, undefined);
  const container = built.components?.[0] as {
    type: number;
    accent_color: number;
    components: { type: number }[];
  };
  assert.equal(container.type, 17);
  assert.equal(container.accent_color, 0xff0000);
  assert.deepEqual(
    container.components.map((c) => c.type),
    [10, 14, 9],
  );
});

test("design limits are checked", () => {
  const row = (n: number) => ({
    type: "row",
    components: Array.from({ length: n }, (_, i) => ({
      type: "button",
      label: `B${i}`,
      customId: `b${i}`,
    })),
  });
  assert.equal(
    MessageDesign.safeParse({ specVersion: 1, kind: "classic", content: "x", components: [row(6)] })
      .success,
    false,
  );
  assert.equal(
    MessageDesign.safeParse({ specVersion: 1, kind: "classic", content: "" }).success,
    false,
  );
  assert.equal(
    MessageDesign.safeParse({
      specVersion: 1,
      kind: "classic",
      content: "x",
      components: [{ type: "row", components: [{ type: "button", style: "link", label: "x" }] }],
    }).success,
    false,
  );
  assert.equal(
    MessageDesign.safeParse({
      specVersion: 1,
      kind: "componentsV2",
      components: Array.from({ length: 8 }, () => row(5)),
    }).success,
    false,
  );
});

test("custom emoji are parsed", () => {
  assert.deepEqual(parseEmoji("<:party:123456789012345678>"), {
    name: "party",
    id: "123456789012345678",
    animated: false,
  });
  assert.deepEqual(parseEmoji("<a:spin:123456789012345678>"), {
    name: "spin",
    id: "123456789012345678",
    animated: true,
  });
  assert.equal(parseEmoji("  "), undefined);
});
