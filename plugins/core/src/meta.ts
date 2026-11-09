import { defineNodeMeta, MESSAGE_FIELD_FORMAT } from "@makecord/plugin-sdk";
import { z } from "zod";

const text = (title: string, description?: string) =>
  z.string().meta({ title, description, multiline: true });
const line = (title: string, description?: string) => z.string().meta({ title, description });
const variable = (fallback: string) =>
  z
    .string()
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
    .default(fallback)
    .meta({ title: "Save as variable", description: "Read it later as {{vars.name}}" });
const variableTr = { title: "Değişkene kaydet", description: "Sonra {{vars.ad}} olarak okunur" };
const userId = () =>
  z
    .string()
    .min(1)
    .default("{{user.id}}")
    .meta({ title: "User ID", description: "For example {{options.user}}" });
const userIdTr = { title: "Kullanıcı ID", description: "Örneğin {{options.user}}" };
const reason = () =>
  z.string().default("").meta({ title: "Reason", description: "Shown in the audit log" });
const reasonTr = { title: "Sebep", description: "Denetim kaydında görünür" };
const content = () =>
  z.string().max(2000).default("").meta({
    title: "Message",
    description: "Use variables like {{user.displayName}}",
    multiline: true,
  });
const design = () =>
  z.string().default("").meta({
    title: "Message design",
    description: "Sends a design from messages/ instead of the text above",
    format: MESSAGE_FIELD_FORMAT,
  });
const contentTr = {
  title: "Mesaj",
  description: "{{user.displayName}} gibi değişkenler kullanılabilir",
};
const designTr = {
  title: "Mesaj tasarımı",
  description: "Yukarıdaki metin yerine messages/ içindeki bir tasarımı gönderir",
};
const contentOrDesign = <T extends { content: string; message: string }>(d: T) =>
  Boolean(d.content.trim() || d.message.trim());
const contentOrDesignError = {
  message: "Write a message or pick a message design",
  path: ["content"],
};

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
  description: "Replies to the command, button, menu or form that started the flow.",
  category: "action",
  needsInteraction: true,
  fields: z
    .object({
      content: content(),
      message: design(),
      ephemeral: z.boolean().default(false).meta({ title: "Only visible to the user" }),
    })
    .refine(contentOrDesign, contentOrDesignError),
  locales: {
    tr: {
      title: "Yanıt Ver",
      description: "Akışı başlatan komuta, butona, menüye veya forma yanıt verir.",
      fields: {
        content: contentTr,
        message: designTr,
        ephemeral: { title: "Sadece kullanana göster" },
      },
    },
  },
});

export const deferReply = defineNodeMeta({
  type: "core.deferReply",
  title: "Defer Reply",
  description: "Tells Discord the answer is coming, for steps that take longer than 3 seconds.",
  category: "action",
  needsInteraction: true,
  fields: z.object({
    ephemeral: z.boolean().default(false).meta({ title: "Only visible to the user" }),
  }),
  locales: {
    tr: {
      title: "Yanıtı Ertele",
      description: "3 saniyeden uzun süren adımlar için Discord'a yanıtın geleceğini bildirir.",
      fields: { ephemeral: { title: "Sadece kullanana göster" } },
    },
  },
});

export const sendMessage = defineNodeMeta({
  type: "core.sendMessage",
  title: "Send Message",
  description: "Sends a message to a channel.",
  category: "action",
  permissions: ["ViewChannel", "SendMessages", "EmbedLinks"],
  fields: z
    .object({
      channelId: line("Channel ID", "For example {{channel.id}}").min(1),
      content: content(),
      message: design(),
    })
    .refine(contentOrDesign, contentOrDesignError),
  locales: {
    tr: {
      title: "Mesaj Gönder",
      description: "Bir kanala mesaj gönderir.",
      fields: {
        channelId: { title: "Kanal ID", description: "Örneğin {{channel.id}}" },
        content: contentTr,
        message: designTr,
      },
    },
  },
});

export const sendDM = defineNodeMeta({
  type: "core.sendDM",
  title: "Send DM",
  description: "Sends a direct message to a user. Fails if they don't accept DMs.",
  category: "action",
  outputs: ["next", "failed"],
  fields: z
    .object({
      userId: userId(),
      content: content(),
      message: design(),
    })
    .refine(contentOrDesign, contentOrDesignError),
  locales: {
    tr: {
      title: "DM Gönder",
      description:
        "Bir kullanıcıya özel mesaj gönderir. Kullanıcı DM kabul etmiyorsa başarısız olur.",
      fields: { userId: userIdTr, content: contentTr, message: designTr },
      outputs: { next: "gönderildi", failed: "başarısız" },
    },
  },
});

export const updateMessage = defineNodeMeta({
  type: "core.updateMessage",
  title: "Update Message",
  description:
    "Changes the message whose button or menu was used, like a vote count or a next page.",
  category: "action",
  needsInteraction: true,
  fields: z
    .object({
      content: content(),
      message: design(),
    })
    .refine(contentOrDesign, contentOrDesignError),
  locales: {
    tr: {
      title: "Mesajı Güncelle",
      description:
        "Butonu veya menüsü kullanılan mesajı değiştirir, örneğin oy sayısı ya da sonraki sayfa.",
      fields: { content: contentTr, message: designTr },
    },
  },
});

export const addReaction = defineNodeMeta({
  type: "core.addReaction",
  title: "Add Reaction",
  description: "Reacts to a message with an emoji.",
  category: "action",
  permissions: ["AddReactions", "ReadMessageHistory"],
  fields: z.object({
    emoji: line("Emoji", "A unicode emoji, or a custom one as name:id").min(1),
    channelId: line("Channel ID").default("{{channel.id}}"),
    messageId: line("Message ID").default("{{message.id}}"),
  }),
  locales: {
    tr: {
      title: "Tepki Ekle",
      description: "Bir mesaja emoji ile tepki verir.",
      fields: {
        emoji: { title: "Emoji", description: "Unicode emoji veya ad:id biçiminde özel emoji" },
        channelId: { title: "Kanal ID" },
        messageId: { title: "Mesaj ID" },
      },
    },
  },
});

export const deleteMessage = defineNodeMeta({
  type: "core.deleteMessage",
  title: "Delete Message",
  description:
    "Deletes a message. The bot needs the Manage Messages permission for other people's messages.",
  category: "action",
  permissions: ["ManageMessages", "ReadMessageHistory"],
  fields: z.object({
    channelId: line("Channel ID").default("{{channel.id}}"),
    messageId: line("Message ID").default("{{message.id}}"),
  }),
  locales: {
    tr: {
      title: "Mesajı Sil",
      description: "Bir mesajı siler. Başkalarının mesajları için Mesajları Yönet yetkisi gerekir.",
      fields: { channelId: { title: "Kanal ID" }, messageId: { title: "Mesaj ID" } },
    },
  },
});

export const addRole = defineNodeMeta({
  type: "core.addRole",
  title: "Add Role",
  description: "Gives a member a role. The bot needs the Manage Roles permission.",
  category: "action",
  permissions: ["ManageRoles"],
  fields: z.object({
    roleId: line("Role ID").min(1),
    userId: userId(),
  }),
  locales: {
    tr: {
      title: "Rol Ver",
      description: "Bir üyeye rol ekler. Botun Rolleri Yönet yetkisi gerekir.",
      fields: { roleId: { title: "Rol ID" }, userId: userIdTr },
    },
  },
});

export const removeRole = defineNodeMeta({
  type: "core.removeRole",
  title: "Remove Role",
  description: "Takes a role away from a member. The bot needs the Manage Roles permission.",
  category: "action",
  permissions: ["ManageRoles"],
  fields: z.object({
    roleId: line("Role ID").min(1),
    userId: userId(),
  }),
  locales: {
    tr: {
      title: "Rol Kaldır",
      description: "Bir üyeden rol alır. Botun Rolleri Yönet yetkisi gerekir.",
      fields: { roleId: { title: "Rol ID" }, userId: userIdTr },
    },
  },
});

export const kick = defineNodeMeta({
  type: "core.kick",
  title: "Kick Member",
  description: "Removes a member from the server. They can join again with an invite.",
  category: "action",
  permissions: ["KickMembers"],
  fields: z.object({ userId: userId(), reason: reason() }),
  locales: {
    tr: {
      title: "Üyeyi At",
      description: "Bir üyeyi sunucudan çıkarır. Davetle tekrar katılabilir.",
      fields: { userId: userIdTr, reason: reasonTr },
    },
  },
});

export const ban = defineNodeMeta({
  type: "core.ban",
  title: "Ban Member",
  description: "Bans a user from the server.",
  category: "action",
  permissions: ["BanMembers"],
  fields: z.object({
    userId: userId(),
    reason: reason(),
    deleteMessageHours: line("Delete their messages from the last (hours)", "0 to 168").default(
      "0",
    ),
  }),
  locales: {
    tr: {
      title: "Üyeyi Yasakla",
      description: "Bir kullanıcıyı sunucudan yasaklar.",
      fields: {
        userId: userIdTr,
        reason: reasonTr,
        deleteMessageHours: {
          title: "Son kaç saatin mesajlarını sil",
          description: "0 ile 168 arası",
        },
      },
    },
  },
});

export const timeout = defineNodeMeta({
  type: "core.timeout",
  title: "Timeout Member",
  description: "Mutes a member for a while. Use 0 minutes to lift a timeout.",
  category: "action",
  permissions: ["ModerateMembers"],
  fields: z.object({
    userId: userId(),
    minutes: line("Minutes", "Up to 40320 (28 days)").default("10"),
    reason: reason(),
  }),
  locales: {
    tr: {
      title: "Zaman Aşımı Ver",
      description: "Bir üyeyi bir süreliğine susturur. Kaldırmak için 0 dakika gir.",
      fields: {
        userId: userIdTr,
        minutes: { title: "Dakika", description: "En fazla 40320 (28 gün)" },
        reason: reasonTr,
      },
    },
  },
});

export const showModal = defineNodeMeta({
  type: "core.showModal",
  title: "Show Form",
  description:
    "Opens a form (modal). Handle the answers in a Form submitted event flow with the same ID.",
  category: "action",
  needsInteraction: true,
  fields: z.object({
    customId: line("Form ID", "Matches the Form submitted flow, e.g. feedback").min(1).max(100),
    title: line("Title").min(1).max(45),
    inputs: text(
      "Fields",
      "One per line: id | Label | short or paragraph | required or optional. Up to 5",
    ).min(1),
  }),
  locales: {
    tr: {
      title: "Form Göster",
      description: "Bir form (modal) açar. Cevapları aynı ID'li bir Form gönderildi akışında işle.",
      fields: {
        customId: {
          title: "Form ID",
          description: "Form gönderildi akışıyla eşleşir, örn. geri-bildirim",
        },
        title: { title: "Başlık" },
        inputs: {
          title: "Alanlar",
          description:
            "Her satıra bir alan: id | Etiket | short veya paragraph | required veya optional. En fazla 5",
        },
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
    left: line("Left value"),
    operator: z
      .enum(["equals", "notEquals", "contains", "greaterThan", "lessThan"])
      .default("equals")
      .meta({ title: "Operator" }),
    right: line("Right value"),
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

export const wait = defineNodeMeta({
  type: "core.wait",
  title: "Wait",
  description: "Pauses the flow. In a command, longer waits defer the reply automatically.",
  category: "logic",
  fields: z.object({ seconds: line("Seconds", "Up to 900").default("1") }),
  locales: {
    tr: {
      title: "Bekle",
      description: "Akışı bekletir. Komutlarda uzun beklemelerde yanıt otomatik ertelenir.",
      fields: { seconds: { title: "Saniye", description: "En fazla 900" } },
    },
  },
});

export const repeat = defineNodeMeta({
  type: "core.repeat",
  title: "Repeat",
  description:
    "Runs the loop branch a number of times, then continues with done. Connect the end of the loop back to this block.",
  category: "logic",
  outputs: ["loop", "done"],
  fields: z.object({
    times: line("Times", "Up to 100").default("3"),
    indexVariable: z
      .string()
      .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
      .default("i")
      .meta({ title: "Counter variable", description: "1, 2, 3… as {{vars.i}}" }),
  }),
  locales: {
    tr: {
      title: "Tekrarla",
      description:
        "Döngü dalını belirtilen sayıda çalıştırır, sonra bitti dalından devam eder. Döngünün sonunu bu bloğa geri bağla.",
      fields: {
        times: { title: "Kaç kez", description: "En fazla 100" },
        indexVariable: { title: "Sayaç değişkeni", description: "{{vars.i}} olarak 1, 2, 3…" },
      },
      outputs: { loop: "döngü", done: "bitti" },
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
    value: line("Value"),
  }),
  locales: {
    tr: {
      title: "Değişken Ata",
      description: "Akış boyunca {{vars.isim}} ile okunabilen bir değer saklar.",
      fields: { name: { title: "Değişken adı" }, value: { title: "Değer" } },
    },
  },
});

export const random = defineNodeMeta({
  type: "core.random",
  title: "Random Number",
  description: "Picks a whole number between min and max, both included.",
  category: "data",
  fields: z.object({
    min: line("Min").default("1"),
    max: line("Max").default("6"),
    variable: variable("random"),
  }),
  locales: {
    tr: {
      title: "Rastgele Sayı",
      description: "Min ile max arasında (ikisi de dahil) bir tam sayı seçer.",
      fields: { min: { title: "En az" }, max: { title: "En çok" }, variable: variableTr },
    },
  },
});

export const math = defineNodeMeta({
  type: "core.math",
  title: "Math",
  description: "Calculates with two numbers.",
  category: "data",
  fields: z.object({
    left: line("Left number"),
    operator: z
      .enum(["add", "subtract", "multiply", "divide", "modulo", "power", "min", "max"])
      .default("add")
      .meta({ title: "Operation" }),
    right: line("Right number"),
    variable: variable("result"),
  }),
  locales: {
    tr: {
      title: "Matematik",
      description: "İki sayıyla işlem yapar.",
      fields: {
        left: { title: "Sol sayı" },
        operator: { title: "İşlem" },
        right: { title: "Sağ sayı" },
        variable: variableTr,
      },
    },
  },
});

export const textOp = defineNodeMeta({
  type: "core.text",
  title: "Text",
  description: "Changes or measures a piece of text.",
  category: "data",
  fields: z.object({
    operation: z
      .enum(["uppercase", "lowercase", "trim", "length", "replace", "split"])
      .default("lowercase")
      .meta({ title: "Operation" }),
    input: line("Text"),
    find: line("Find", "For replace and split").default(""),
    replaceWith: line("Replace with", "For replace").default(""),
    variable: variable("text"),
  }),
  locales: {
    tr: {
      title: "Metin İşlemi",
      description: "Bir metni değiştirir veya ölçer.",
      fields: {
        operation: { title: "İşlem" },
        input: { title: "Metin" },
        find: { title: "Bul", description: "replace ve split için" },
        replaceWith: { title: "Yerine", description: "replace için" },
        variable: variableTr,
      },
    },
  },
});

export const httpRequest = defineNodeMeta({
  type: "core.httpRequest",
  title: "HTTP Request",
  description: "Calls a web API. JSON answers can be read like {{vars.response.field}}.",
  category: "data",
  outputs: ["next", "error"],
  fields: z.object({
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
      .default("GET")
      .meta({ title: "Method" }),
    url: line("URL").min(1),
    body: text("JSON body", "For POST, PUT and PATCH").default(""),
    variable: variable("response"),
  }),
  locales: {
    tr: {
      title: "HTTP İsteği",
      description: "Bir web API'sini çağırır. JSON cevaplar {{vars.response.alan}} gibi okunur.",
      fields: {
        method: { title: "Yöntem" },
        url: { title: "URL" },
        body: { title: "JSON gövdesi", description: "POST, PUT ve PATCH için" },
        variable: variableTr,
      },
      outputs: { next: "başarılı", error: "hata" },
    },
  },
});

export const storeGet = defineNodeMeta({
  type: "core.storeGet",
  title: "Read Value",
  description: "Reads a saved value into a variable. Saved values survive restarts.",
  category: "data",
  fields: z.object({
    key: line("Key", "For example xp:{{user.id}}").min(1),
    fallback: line("If missing", "Used when nothing is saved under the key").default(""),
    variable: variable("value"),
  }),
  locales: {
    tr: {
      title: "Değer Oku",
      description:
        "Kaydedilmiş bir değeri değişkene okur. Kaydedilen değerler yeniden başlatmada kaybolmaz.",
      fields: {
        key: { title: "Anahtar", description: "Örneğin xp:{{user.id}}" },
        fallback: { title: "Yoksa", description: "Anahtarda değer yoksa kullanılır" },
        variable: variableTr,
      },
    },
  },
});

export const storeSet = defineNodeMeta({
  type: "core.storeSet",
  title: "Save Value",
  description: "Saves a value under a key, kept across restarts.",
  category: "data",
  fields: z.object({
    key: line("Key", "For example xp:{{user.id}}").min(1),
    value: line("Value"),
  }),
  locales: {
    tr: {
      title: "Değer Kaydet",
      description: "Bir değeri anahtarın altına kaydeder, yeniden başlatmada kaybolmaz.",
      fields: {
        key: { title: "Anahtar", description: "Örneğin xp:{{user.id}}" },
        value: { title: "Değer" },
      },
    },
  },
});

export const storeIncrement = defineNodeMeta({
  type: "core.storeIncrement",
  title: "Increase Value",
  description:
    "Adds to a saved number (missing counts as 0) and stores the new total in a variable.",
  category: "data",
  fields: z.object({
    key: line("Key", "For example xp:{{user.id}}").min(1),
    by: line("By", "Negative numbers decrease it").default("1"),
    variable: variable("total"),
  }),
  locales: {
    tr: {
      title: "Değeri Artır",
      description:
        "Kaydedilmiş bir sayıya ekler (yoksa 0 sayılır) ve yeni toplamı değişkene yazar.",
      fields: {
        key: { title: "Anahtar", description: "Örneğin xp:{{user.id}}" },
        by: { title: "Ne kadar", description: "Negatif sayı azaltır" },
        variable: variableTr,
      },
    },
  },
});

export const storeDelete = defineNodeMeta({
  type: "core.storeDelete",
  title: "Delete Value",
  description: "Removes a saved value.",
  category: "data",
  fields: z.object({ key: line("Key").min(1) }),
  locales: {
    tr: {
      title: "Değeri Sil",
      description: "Kaydedilmiş bir değeri siler.",
      fields: { key: { title: "Anahtar" } },
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

export const coreNodeMetas = [
  trigger,
  reply,
  deferReply,
  sendMessage,
  sendDM,
  updateMessage,
  addReaction,
  deleteMessage,
  addRole,
  removeRole,
  kick,
  ban,
  timeout,
  showModal,
  condition,
  wait,
  repeat,
  setVariable,
  random,
  math,
  textOp,
  httpRequest,
  storeGet,
  storeSet,
  storeIncrement,
  storeDelete,
  log,
];
