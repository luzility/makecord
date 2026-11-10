import type { ClassicMessage, MessageDesign } from "@makecord/spec";
import type { Locale } from "@/i18n/locale";
import { newMessage, toLayout } from "./model";

export const PRESET_IDS = ["blank", "announcement", "rules", "welcome", "choice"] as const;
export type PresetId = (typeof PRESET_IDS)[number];

const COLOR = "#006F6F";

const TEXT = {
  en: {
    announcement: ["Announcement", "Write the news here. Variables like {{guild.name}} work."],
    rules: [
      "Server rules",
      "**1.** Be kind to each other.\n**2.** No spam, ads or scams.\n**3.** Keep topics in their channels.\n**4.** Follow the Discord Terms of Service.",
      "Breaking the rules can get you muted or banned.",
    ],
    welcome: ["Welcome, {{user.displayName}}!", "{{user.mention}} just joined **{{guild.name}}**."],
    choice: ["What do you think?", "Yes", "No"],
  },
  tr: {
    announcement: ["Duyuru", "Haberi buraya yaz. {{guild.name}} gibi değişkenler kullanılabilir."],
    rules: [
      "Sunucu kuralları",
      "**1.** Birbirinize nazik olun.\n**2.** Spam, reklam ve dolandırıcılık yok.\n**3.** Konuları kendi kanallarında tutun.\n**4.** Discord Hizmet Koşulları'na uyun.",
      "Kuralları çiğnemek susturulmana veya yasaklanmana yol açabilir.",
    ],
    welcome: [
      "Hoş geldin, {{user.displayName}}!",
      "{{user.mention}} **{{guild.name}}** sunucusuna katıldı.",
    ],
    choice: ["Ne düşünüyorsun?", "Evet", "Hayır"],
  },
} as const;

function classic(id: Exclude<PresetId, "blank">, locale: Locale): ClassicMessage {
  const tx = TEXT[locale === "tr" ? "tr" : "en"];
  const base = { specVersion: 1 as const, kind: "classic" as const, content: "", components: [] };
  switch (id) {
    case "announcement":
      return {
        ...base,
        embeds: [
          {
            title: `📢 ${tx.announcement[0]}`,
            description: tx.announcement[1],
            color: COLOR,
            footer: { text: "{{guild.name}}" },
            timestamp: true,
            fields: [],
          },
        ],
      };
    case "rules":
      return {
        ...base,
        embeds: [
          {
            title: tx.rules[0],
            description: tx.rules[1],
            color: COLOR,
            footer: { text: tx.rules[2] },
            fields: [],
          },
        ],
      };
    case "welcome":
      return {
        ...base,
        embeds: [
          {
            title: tx.welcome[0],
            description: tx.welcome[1],
            thumbnail: "{{user.avatar}}",
            color: COLOR,
            fields: [],
          },
        ],
      };
    case "choice":
      return {
        ...base,
        content: tx.choice[0],
        embeds: [],
        components: [
          {
            type: "row",
            components: [
              { type: "button", style: "success", label: tx.choice[1], customId: "choice:yes" },
              { type: "button", style: "danger", label: tx.choice[2], customId: "choice:no" },
            ],
          },
        ],
      };
  }
}

export function presetMessage(
  id: PresetId,
  kind: MessageDesign["kind"],
  locale: Locale,
  blankText: string,
): MessageDesign {
  if (id === "blank") return newMessage(kind, blankText);
  const m = classic(id, locale);
  return kind === "classic" ? m : toLayout(m);
}
