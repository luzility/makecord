import { defineNodeMeta } from "@makecord/plugin-sdk";
import { z } from "zod";

const text = (title: string, description?: string) =>
  z.string().meta({ title, description, multiline: true });

export const trigger = defineNodeMeta({
  type: "core.trigger",
  title: "Start",
  description: "Where the flow begins when its command or event fires.",
  category: "trigger",
  fields: z.object({}),
  locales: {
    tr: { title: "Başlangıç", description: "Komut veya event tetiklenince akış buradan başlar." },
  },
});

export const reply = defineNodeMeta({
  type: "core.reply",
  title: "Reply",
  description: "Replies to the slash command.",
  category: "action",
  contexts: ["command"],
  fields: z.object({
    content: text("Message", "Use variables like {{user.displayName}}").min(1).max(2000),
    ephemeral: z.boolean().default(false).meta({ title: "Only visible to the user" }),
  }),
  locales: {
    tr: {
      title: "Yanıt Ver",
      description: "Slash komutuna yanıt gönderir.",
      fields: {
        content: {
          title: "Mesaj",
          description: "{{user.displayName}} gibi değişkenler kullanılabilir",
        },
        ephemeral: { title: "Sadece kullanana göster" },
      },
    },
  },
});

export const sendMessage = defineNodeMeta({
  type: "core.sendMessage",
  title: "Send Message",
  description: "Sends a message to a channel.",
  category: "action",
  fields: z.object({
    channelId: z
      .string()
      .min(1)
      .meta({ title: "Channel ID", description: "For example {{channel.id}}" }),
    content: text("Message").min(1).max(2000),
  }),
  locales: {
    tr: {
      title: "Mesaj Gönder",
      description: "Bir kanala mesaj gönderir.",
      fields: {
        channelId: { title: "Kanal ID", description: "Örneğin {{channel.id}}" },
        content: { title: "Mesaj" },
      },
    },
  },
});

export const condition = defineNodeMeta({
  type: "core.condition",
  title: "Condition",
  description: "Compares two values and branches into true or false.",
  category: "logic",
  outputs: ["true", "false"],
  fields: z.object({
    left: z.string().meta({ title: "Left value" }),
    operator: z
      .enum(["equals", "notEquals", "contains", "greaterThan", "lessThan"])
      .default("equals")
      .meta({ title: "Operator" }),
    right: z.string().meta({ title: "Right value" }),
  }),
  locales: {
    tr: {
      title: "Koşul",
      description: "İki değeri karşılaştırır ve doğru/yanlış yoluna ayrılır.",
      fields: {
        left: { title: "Sol değer" },
        operator: { title: "Operatör" },
        right: { title: "Sağ değer" },
      },
      outputs: { true: "doğru", false: "yanlış" },
    },
  },
});

export const setVariable = defineNodeMeta({
  type: "core.setVariable",
  title: "Set Variable",
  description: "Stores a value you can read later in the flow as {{vars.name}}.",
  category: "data",
  fields: z.object({
    name: z
      .string()
      .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
      .meta({ title: "Variable name" }),
    value: z.string().meta({ title: "Value" }),
  }),
  locales: {
    tr: {
      title: "Değişken Ata",
      description: "Akış boyunca {{vars.isim}} ile okunabilen bir değer saklar.",
      fields: { name: { title: "Değişken adı" }, value: { title: "Değer" } },
    },
  },
});

export const addRole = defineNodeMeta({
  type: "core.addRole",
  title: "Add Role",
  description: "Gives a member a role. The bot needs the Manage Roles permission.",
  category: "action",
  fields: z.object({
    roleId: z.string().min(1).meta({ title: "Role ID" }),
    userId: z.string().default("{{user.id}}").meta({ title: "User ID" }),
  }),
  locales: {
    tr: {
      title: "Rol Ver",
      description: "Bir üyeye rol ekler. Botun Rolleri Yönet yetkisi gerekir.",
      fields: { roleId: { title: "Rol ID" }, userId: { title: "Kullanıcı ID" } },
    },
  },
});

export const log = defineNodeMeta({
  type: "core.log",
  title: "Log",
  description: "Writes a line to the IDE's Run panel, or to the server console.",
  category: "data",
  fields: z.object({
    level: z.enum(["debug", "info", "warn", "error"]).default("info").meta({ title: "Level" }),
    message: text("Message"),
  }),
  locales: {
    tr: {
      title: "Log Yaz",
      description: "IDE'nin Run paneline veya sunucu konsoluna bir satır yazar.",
      fields: { level: { title: "Seviye" }, message: { title: "Mesaj" } },
    },
  },
});

export const coreNodeMetas = [trigger, reply, sendMessage, condition, setVariable, addRole, log];
