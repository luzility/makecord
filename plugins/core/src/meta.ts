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
  group: "interaction",
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
  group: "interaction",
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
  group: "messages",
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
  group: "messages",
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
  group: "interaction",
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
  group: "messages",
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
  group: "messages",
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
  group: "members",
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
  group: "members",
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
  group: "members",
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
  group: "members",
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
  group: "members",
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
  group: "interaction",
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

const channelId = (fallback = "{{channel.id}}") =>
  z
    .string()
    .min(1)
    .default(fallback)
    .meta({ title: "Channel ID", description: "For example {{channel.id}}" });
const channelIdTr = { title: "Kanal ID", description: "Örneğin {{channel.id}}" };
const messageId = () =>
  z
    .string()
    .min(1)
    .default("{{message.id}}")
    .meta({ title: "Message ID", description: "For example {{message.id}}" });
const messageIdTr = { title: "Mesaj ID", description: "Örneğin {{message.id}}" };
const roleId = () =>
  line("Role ID", "Right-click a role with Developer Mode on to copy its ID").min(1);
const roleIdTr = {
  title: "Rol ID",
  description: "Geliştirici Modu açıkken role sağ tıklayıp ID'sini kopyala",
};

export const replyToMessage = defineNodeMeta({
  type: "core.replyToMessage",
  group: "messages",
  title: "Reply to Message",
  description: "Replies to a message in its channel, like a member would. Works in message events.",
  category: "action",
  permissions: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
  fields: z
    .object({
      channelId: channelId(),
      messageId: messageId(),
      content: content(),
      message: design(),
      mention: z.boolean().default(true).meta({ title: "Ping the author" }),
    })
    .refine(contentOrDesign, contentOrDesignError),
  locales: {
    tr: {
      title: "Mesaja Yanıt Ver",
      description:
        "Bir mesaja kendi kanalında, bir üye gibi yanıt verir. Mesaj event'lerinde çalışır.",
      fields: {
        channelId: channelIdTr,
        messageId: messageIdTr,
        content: contentTr,
        message: designTr,
        mention: { title: "Yazarı etiketle" },
      },
    },
  },
});

export const editMessage = defineNodeMeta({
  type: "core.editMessage",
  group: "messages",
  title: "Edit Message",
  description: "Changes a message the bot sent earlier.",
  category: "action",
  fields: z
    .object({
      channelId: channelId(),
      messageId: messageId(),
      content: content(),
      message: design(),
    })
    .refine(contentOrDesign, contentOrDesignError),
  locales: {
    tr: {
      title: "Mesajı Düzenle",
      description: "Botun daha önce gönderdiği bir mesajı değiştirir.",
      fields: {
        channelId: channelIdTr,
        messageId: messageIdTr,
        content: contentTr,
        message: designTr,
      },
    },
  },
});

export const pinMessage = defineNodeMeta({
  type: "core.pinMessage",
  group: "messages",
  title: "Pin Message",
  description: "Pins or unpins a message.",
  category: "action",
  permissions: ["ManageMessages", "ReadMessageHistory"],
  fields: z.object({
    action: z.enum(["pin", "unpin"]).default("pin").meta({ title: "Action" }),
    channelId: channelId(),
    messageId: messageId(),
  }),
  locales: {
    tr: {
      title: "Mesajı Sabitle",
      description: "Bir mesajı sabitler ya da sabitlemeyi kaldırır.",
      fields: { action: { title: "İşlem" }, channelId: channelIdTr, messageId: messageIdTr },
    },
  },
});

export const purgeMessages = defineNodeMeta({
  type: "core.purgeMessages",
  group: "messages",
  title: "Delete Recent Messages",
  description:
    "Deletes up to 100 recent messages in a channel. Messages older than 14 days are skipped.",
  category: "action",
  permissions: ["ManageMessages", "ReadMessageHistory"],
  fields: z.object({
    channelId: channelId(),
    amount: line("How many", "1 to 100").default("10"),
    fromUser: line("Only from user ID", "Leave empty to delete from everyone").default(""),
    variable: variable("deleted"),
  }),
  locales: {
    tr: {
      title: "Son Mesajları Sil",
      description: "Bir kanaldaki son 100 mesaja kadar siler. 14 günden eski mesajlar atlanır.",
      fields: {
        channelId: channelIdTr,
        amount: { title: "Kaç tane", description: "1 ile 100 arası" },
        fromUser: {
          title: "Sadece şu kullanıcıdan",
          description: "Herkesten silmek için boş bırak",
        },
        variable: variableTr,
      },
    },
  },
});

export const getMessage = defineNodeMeta({
  type: "core.getMessage",
  title: "Get Message",
  description: "Loads a message and saves its text, author and link in a variable.",
  category: "data",
  outputs: ["next", "notFound"],
  fields: z.object({
    channelId: channelId(),
    messageId: messageId(),
    variable: variable("msg"),
  }),
  locales: {
    tr: {
      title: "Mesajı Getir",
      description: "Bir mesajı yükler, metnini, yazarını ve linkini bir değişkene kaydeder.",
      fields: { channelId: channelIdTr, messageId: messageIdTr, variable: variableTr },
      outputs: { next: "bulundu", notFound: "bulunamadı" },
    },
  },
});

export const removeReactions = defineNodeMeta({
  type: "core.removeReactions",
  group: "messages",
  title: "Remove Reactions",
  description: "Removes reactions from a message: all of them, one emoji, or one person's.",
  category: "action",
  permissions: ["ManageMessages", "ReadMessageHistory"],
  fields: z.object({
    channelId: channelId(),
    messageId: messageId(),
    emoji: line("Emoji", "Leave empty to remove every reaction").default(""),
    userId: line("Only from user ID", "With an emoji, removes just this person's reaction").default(
      "",
    ),
  }),
  locales: {
    tr: {
      title: "Tepkileri Kaldır",
      description: "Bir mesajdaki tepkileri kaldırır: hepsini, bir emojiyi ya da bir kişininkini.",
      fields: {
        channelId: channelIdTr,
        messageId: messageIdTr,
        emoji: { title: "Emoji", description: "Tüm tepkileri kaldırmak için boş bırak" },
        userId: {
          title: "Sadece şu kullanıcıdan",
          description: "Bir emojiyle birlikte sadece bu kişinin tepkisini kaldırır",
        },
      },
    },
  },
});

export const createThread = defineNodeMeta({
  type: "core.createThread",
  group: "messages",
  title: "Create Thread",
  description: "Starts a thread in a channel, or on a message if you give one.",
  category: "action",
  permissions: ["CreatePublicThreads", "SendMessagesInThreads"],
  fields: z.object({
    channelId: channelId(),
    messageId: line("On message ID", "Optional. For example {{message.id}}").default(""),
    name: line("Thread name").min(1).max(100),
    archiveAfter: z
      .enum(["60", "1440", "4320", "10080"])
      .default("1440")
      .meta({ title: "Hide after inactivity (minutes)" }),
    variable: variable("threadId"),
  }),
  locales: {
    tr: {
      title: "Thread Oluştur",
      description: "Bir kanalda, verilirse bir mesajın üzerinde thread başlatır.",
      fields: {
        channelId: channelIdTr,
        messageId: {
          title: "Mesaj ID'si üzerinde",
          description: "İsteğe bağlı. Örneğin {{message.id}}",
        },
        name: { title: "Thread adı" },
        archiveAfter: { title: "Hareketsizlikten sonra gizle (dakika)" },
        variable: variableTr,
      },
    },
  },
});

export const sendPoll = defineNodeMeta({
  type: "core.sendPoll",
  group: "messages",
  title: "Send Poll",
  description: "Posts a Discord poll in a channel.",
  category: "action",
  permissions: ["ViewChannel", "SendMessages", "SendPolls"],
  fields: z.object({
    channelId: channelId(),
    question: line("Question").min(1).max(300),
    answers: text("Answers", "One per line, up to 10. Start a line with an emoji to show it").min(
      1,
    ),
    hours: line("Open for (hours)", "1 to 768").default("24"),
    multiple: z.boolean().default(false).meta({ title: "Allow more than one answer" }),
  }),
  locales: {
    tr: {
      title: "Anket Gönder",
      description: "Bir kanala Discord anketi gönderir.",
      fields: {
        channelId: channelIdTr,
        question: { title: "Soru" },
        answers: {
          title: "Cevaplar",
          description: "Her satıra bir tane, en fazla 10. Göstermek için satıra emojiyle başla",
        },
        hours: { title: "Açık kalma süresi (saat)", description: "1 ile 768 arası" },
        multiple: { title: "Birden fazla cevaba izin ver" },
      },
    },
  },
});

export const getMember = defineNodeMeta({
  type: "core.getMember",
  title: "Get Member",
  description: "Loads a server member and saves their name, roles and dates in a variable.",
  category: "data",
  outputs: ["next", "notFound"],
  fields: z.object({ userId: userId(), variable: variable("member") }),
  locales: {
    tr: {
      title: "Üyeyi Getir",
      description:
        "Bir sunucu üyesini yükler; adını, rollerini ve tarihlerini bir değişkene kaydeder.",
      fields: { userId: userIdTr, variable: variableTr },
      outputs: { next: "bulundu", notFound: "bulunamadı" },
    },
  },
});

export const hasRole = defineNodeMeta({
  type: "core.hasRole",
  title: "Has Role",
  description: "Checks whether a member has a role.",
  category: "logic",
  outputs: ["true", "false"],
  fields: z.object({ userId: userId(), roleId: roleId() }),
  locales: {
    tr: {
      title: "Rolü Var mı",
      description: "Bir üyenin bir role sahip olup olmadığını kontrol eder.",
      fields: { userId: userIdTr, roleId: roleIdTr },
      outputs: { true: "evet", false: "hayır" },
    },
  },
});

export const MEMBER_PERMISSIONS = [
  "Administrator",
  "ManageGuild",
  "ManageRoles",
  "ManageChannels",
  "ManageMessages",
  "KickMembers",
  "BanMembers",
  "ModerateMembers",
  "ManageNicknames",
  "MentionEveryone",
  "MoveMembers",
  "ManageThreads",
] as const;

export const hasPermission = defineNodeMeta({
  type: "core.hasPermission",
  title: "Has Permission",
  description: "Checks whether a member has a permission in the server.",
  category: "logic",
  outputs: ["true", "false"],
  fields: z.object({
    userId: userId(),
    permission: z.enum(MEMBER_PERMISSIONS).default("ManageMessages").meta({ title: "Permission" }),
  }),
  locales: {
    tr: {
      title: "Yetkisi Var mı",
      description: "Bir üyenin sunucuda bir yetkiye sahip olup olmadığını kontrol eder.",
      fields: { userId: userIdTr, permission: { title: "Yetki" } },
      outputs: { true: "evet", false: "hayır" },
    },
  },
});

export const setNickname = defineNodeMeta({
  type: "core.setNickname",
  group: "members",
  title: "Set Nickname",
  description: "Changes a member's nickname in the server. Leave it empty to reset.",
  category: "action",
  permissions: ["ManageNicknames"],
  fields: z.object({
    userId: userId(),
    nickname: line("Nickname", "Up to 32 characters").max(32).default(""),
    reason: reason(),
  }),
  locales: {
    tr: {
      title: "Takma Ad Ver",
      description: "Bir üyenin sunucudaki takma adını değiştirir. Sıfırlamak için boş bırak.",
      fields: {
        userId: userIdTr,
        nickname: { title: "Takma ad", description: "En fazla 32 karakter" },
        reason: reasonTr,
      },
    },
  },
});

export const unban = defineNodeMeta({
  type: "core.unban",
  group: "members",
  title: "Unban Member",
  description: "Lifts a ban so the user can join again.",
  category: "action",
  permissions: ["BanMembers"],
  fields: z.object({ userId: line("User ID").min(1), reason: reason() }),
  locales: {
    tr: {
      title: "Yasağı Kaldır",
      description: "Bir yasağı kaldırır, kullanıcı tekrar katılabilir.",
      fields: { userId: { title: "Kullanıcı ID" }, reason: reasonTr },
    },
  },
});

export const moveVoice = defineNodeMeta({
  type: "core.moveVoice",
  group: "members",
  title: "Move in Voice",
  description: "Moves a member to another voice channel, or disconnects them.",
  category: "action",
  permissions: ["MoveMembers"],
  fields: z.object({
    userId: userId(),
    channelId: line("Voice channel ID", "Leave empty to disconnect").default(""),
  }),
  locales: {
    tr: {
      title: "Seste Taşı",
      description: "Bir üyeyi başka bir ses kanalına taşır ya da bağlantısını keser.",
      fields: {
        userId: userIdTr,
        channelId: { title: "Ses kanalı ID", description: "Bağlantıyı kesmek için boş bırak" },
      },
    },
  },
});

export const createRole = defineNodeMeta({
  type: "core.createRole",
  group: "server",
  title: "Create Role",
  description: "Creates a role in the server.",
  category: "action",
  permissions: ["ManageRoles"],
  fields: z.object({
    name: line("Name").min(1).max(100),
    color: line("Color", "Hex, like #5865f2. Optional").default(""),
    hoist: z.boolean().default(false).meta({ title: "Show members separately" }),
    mentionable: z.boolean().default(false).meta({ title: "Anyone can mention it" }),
    variable: variable("roleId"),
  }),
  locales: {
    tr: {
      title: "Rol Oluştur",
      description: "Sunucuda bir rol oluşturur.",
      fields: {
        name: { title: "Ad" },
        color: { title: "Renk", description: "#5865f2 gibi hex. İsteğe bağlı" },
        hoist: { title: "Üyeleri ayrı göster" },
        mentionable: { title: "Herkes etiketleyebilir" },
        variable: variableTr,
      },
    },
  },
});

export const deleteRole = defineNodeMeta({
  type: "core.deleteRole",
  group: "server",
  title: "Delete Role",
  description: "Deletes a role from the server.",
  category: "action",
  permissions: ["ManageRoles"],
  fields: z.object({ roleId: roleId(), reason: reason() }),
  locales: {
    tr: {
      title: "Rolü Sil",
      description: "Sunucudan bir rolü siler.",
      fields: { roleId: roleIdTr, reason: reasonTr },
    },
  },
});

export const createChannel = defineNodeMeta({
  type: "core.createChannel",
  group: "server",
  title: "Create Channel",
  description: "Creates a text, voice, announcement or forum channel, or a category.",
  category: "action",
  permissions: ["ManageChannels"],
  fields: z.object({
    name: line("Name").min(1).max(100),
    kind: z
      .enum(["text", "voice", "category", "announcement", "forum", "stage"])
      .default("text")
      .meta({ title: "Type" }),
    parentId: line("Category ID", "Optional").default(""),
    topic: line("Topic", "Optional").default(""),
    private: z.boolean().default(false).meta({ title: "Hide from @everyone" }),
    variable: variable("channelId"),
  }),
  locales: {
    tr: {
      title: "Kanal Oluştur",
      description: "Metin, ses, duyuru veya forum kanalı ya da kategori oluşturur.",
      fields: {
        name: { title: "Ad" },
        kind: { title: "Tür" },
        parentId: { title: "Kategori ID", description: "İsteğe bağlı" },
        topic: { title: "Konu", description: "İsteğe bağlı" },
        private: { title: "@everyone'dan gizle" },
        variable: variableTr,
      },
    },
  },
});

export const deleteChannel = defineNodeMeta({
  type: "core.deleteChannel",
  group: "server",
  title: "Delete Channel",
  description: "Deletes a channel or thread.",
  category: "action",
  permissions: ["ManageChannels"],
  fields: z.object({ channelId: channelId(), reason: reason() }),
  locales: {
    tr: {
      title: "Kanalı Sil",
      description: "Bir kanalı ya da thread'i siler.",
      fields: { channelId: channelIdTr, reason: reasonTr },
    },
  },
});

export const editChannel = defineNodeMeta({
  type: "core.editChannel",
  group: "server",
  title: "Edit Channel",
  description: "Renames a channel or changes its topic or slowmode. Empty fields stay as they are.",
  category: "action",
  permissions: ["ManageChannels"],
  fields: z.object({
    channelId: channelId(),
    name: line("New name").default(""),
    topic: line("New topic").default(""),
    slowmode: line("Slowmode (seconds)", "0 to 21600. Empty keeps it").default(""),
  }),
  locales: {
    tr: {
      title: "Kanalı Düzenle",
      description:
        "Bir kanalın adını, konusunu veya yavaş modunu değiştirir. Boş alanlar olduğu gibi kalır.",
      fields: {
        channelId: channelIdTr,
        name: { title: "Yeni ad" },
        topic: { title: "Yeni konu" },
        slowmode: { title: "Yavaş mod (saniye)", description: "0 ile 21600 arası. Boşsa değişmez" },
      },
    },
  },
});

export const lockChannel = defineNodeMeta({
  type: "core.lockChannel",
  group: "server",
  title: "Lock Channel",
  description: "Stops @everyone from sending messages in a channel, or lets them again.",
  category: "action",
  permissions: ["ManageChannels", "ManageRoles"],
  fields: z.object({
    action: z.enum(["lock", "unlock"]).default("lock").meta({ title: "Action" }),
    channelId: channelId(),
    reason: reason(),
  }),
  locales: {
    tr: {
      title: "Kanalı Kilitle",
      description: "@everyone'ın bir kanalda mesaj göndermesini engeller ya da tekrar izin verir.",
      fields: { action: { title: "İşlem" }, channelId: channelIdTr, reason: reasonTr },
    },
  },
});

export const createInvite = defineNodeMeta({
  type: "core.createInvite",
  group: "server",
  title: "Create Invite",
  description: "Creates an invite link for a channel.",
  category: "action",
  permissions: ["CreateInstantInvite"],
  fields: z.object({
    channelId: channelId(),
    hours: line("Expires after (hours)", "0 never expires").default("24"),
    maxUses: line("Max uses", "0 is unlimited").default("0"),
    variable: variable("invite"),
  }),
  locales: {
    tr: {
      title: "Davet Oluştur",
      description: "Bir kanal için davet linki oluşturur.",
      fields: {
        channelId: channelIdTr,
        hours: { title: "Süre (saat)", description: "0 süresiz" },
        maxUses: { title: "En fazla kullanım", description: "0 sınırsız" },
        variable: variableTr,
      },
    },
  },
});

export const setPresence = defineNodeMeta({
  type: "core.setPresence",
  group: "server",
  title: "Set Bot Status",
  description: "Sets the bot's online status and the activity under its name.",
  category: "action",
  fields: z.object({
    status: z
      .enum(["online", "idle", "dnd", "invisible"])
      .default("online")
      .meta({ title: "Status" }),
    activity: z
      .enum(["none", "custom", "playing", "listening", "watching", "competing"])
      .default("custom")
      .meta({ title: "Activity" }),
    text: line("Text", "For example {{client.servers}} servers").default(""),
  }),
  locales: {
    tr: {
      title: "Bot Durumunu Ayarla",
      description: "Botun çevrimiçi durumunu ve adının altındaki etkinliği ayarlar.",
      fields: {
        status: { title: "Durum" },
        activity: { title: "Etkinlik" },
        text: { title: "Metin", description: "Örneğin {{client.servers}} sunucu" },
      },
    },
  },
});

export const forEach = defineNodeMeta({
  type: "core.forEach",
  title: "For Each",
  description: "Runs the loop branch once for every item in a list, then continues from done.",
  category: "logic",
  outputs: ["loop", "done"],
  fields: z.object({
    list: line("List", "A variable holding a list, like {{vars.items}}, or lines of text").min(1),
    itemVariable: variable("item"),
    indexVariable: variable("index"),
  }),
  locales: {
    tr: {
      title: "Her Biri İçin",
      description:
        "Listedeki her öğe için loop dalını bir kez çalıştırır, sonra done'dan devam eder.",
      fields: {
        list: {
          title: "Liste",
          description: "{{vars.items}} gibi liste tutan bir değişken ya da metin satırları",
        },
        itemVariable: { title: "Öğe değişkeni", description: "Sonra {{vars.item}} olarak okunur" },
        indexVariable: { title: "Sıra değişkeni", description: "1'den başlar" },
      },
      outputs: { loop: "her biri", done: "bitti" },
    },
  },
});

export const cooldown = defineNodeMeta({
  type: "core.cooldown",
  title: "Cooldown",
  description: "Lets a flow continue only once per period for each key, like per user.",
  category: "logic",
  outputs: ["next", "cooling"],
  fields: z.object({
    seconds: line("Seconds").default("10"),
    key: line("Per", "{{user.id}} limits each person separately").default("{{user.id}}"),
    variable: variable("remaining"),
  }),
  locales: {
    tr: {
      title: "Bekleme Süresi",
      description:
        "Bir akışın her anahtar için (örneğin kullanıcı başına) belli sürede bir kez devam etmesine izin verir.",
      fields: {
        seconds: { title: "Saniye" },
        key: { title: "Kime göre", description: "{{user.id}} her kişiyi ayrı sınırlar" },
        variable: {
          title: "Kalan süre değişkeni",
          description: "Saniye olarak, {{vars.remaining}}",
        },
      },
      outputs: { next: "devam", cooling: "beklemede" },
    },
  },
});

export const timestamp = defineNodeMeta({
  type: "core.timestamp",
  title: "Timestamp",
  description: 'Makes a time Discord shows in each reader\'s own time zone, like "in 2 hours".',
  category: "data",
  fields: z.object({
    time: line("Time", "now, an ISO date like {{member.joinedAt}}, or a Unix time").default("now"),
    addMinutes: line("Add minutes", "Can be negative").default("0"),
    style: z
      .enum([
        "relative",
        "shortTime",
        "longTime",
        "shortDate",
        "longDate",
        "shortDateTime",
        "longDateTime",
      ])
      .default("relative")
      .meta({ title: "Style" }),
    variable: variable("time"),
  }),
  locales: {
    tr: {
      title: "Zaman Damgası",
      description:
        'Discord\'un her okuyucuya kendi saat diliminde gösterdiği bir zaman üretir, örneğin "2 saat içinde".',
      fields: {
        time: {
          title: "Zaman",
          description: "now, {{member.joinedAt}} gibi ISO tarih ya da Unix zamanı",
        },
        addMinutes: { title: "Dakika ekle", description: "Negatif olabilir" },
        style: { title: "Biçim" },
        variable: variableTr,
      },
    },
  },
});

export const randomItem = defineNodeMeta({
  type: "core.randomItem",
  title: "Random Item",
  description: "Picks one item from a list at random.",
  category: "data",
  fields: z.object({
    list: text("List", "One per line, or a variable holding a list").min(1),
    variable: variable("pick"),
  }),
  locales: {
    tr: {
      title: "Rastgele Öğe",
      description: "Bir listeden rastgele bir öğe seçer.",
      fields: {
        list: { title: "Liste", description: "Her satıra bir tane ya da liste tutan bir değişken" },
        variable: variableTr,
      },
    },
  },
});

export const suggest = defineNodeMeta({
  type: "core.suggest",
  group: "interaction",
  title: "Suggest Choices",
  description: "Answers autocomplete with up to 25 suggestions for what the person is typing.",
  category: "action",
  events: ["autocomplete"],
  fields: z.object({
    choices: text("Choices", "One per line as Label | value, or a variable holding a list").min(1),
    filter: z
      .boolean()
      .default(true)
      .meta({ title: "Only show choices that match what was typed" }),
  }),
  locales: {
    tr: {
      title: "Öneri Göster",
      description: "Autocomplete'e, kişinin yazdığına göre en fazla 25 öneriyle cevap verir.",
      fields: {
        choices: {
          title: "Seçenekler",
          description: "Her satıra Etiket | değer ya da liste tutan bir değişken",
        },
        filter: { title: "Sadece yazılanla eşleşenleri göster" },
      },
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
  replyToMessage,
  editMessage,
  pinMessage,
  purgeMessages,
  getMessage,
  removeReactions,
  createThread,
  sendPoll,
  getMember,
  hasRole,
  hasPermission,
  setNickname,
  unban,
  moveVoice,
  createRole,
  deleteRole,
  createChannel,
  deleteChannel,
  editChannel,
  lockChannel,
  createInvite,
  setPresence,
  forEach,
  cooldown,
  timestamp,
  randomItem,
  suggest,
];
