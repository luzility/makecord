import { defineNodeMeta, VARIABLE_FIELD_FORMAT } from "@makecord/plugin-sdk";
import { z } from "zod";
import { PROVIDER_IDS } from "./presets.js";

const variable = (fallback: string, also?: string[]) =>
  z
    .string()
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
    .default(fallback)
    .meta({
      title: "Save as variable",
      description: "Read it later as {{vars.name}}",
      format: VARIABLE_FIELD_FORMAT,
      ...(also ? { alsoSets: also } : {}),
    });
const variableTr = { title: "Değişkene kaydet", description: "Sonra {{vars.ad}} olarak okunur" };

const model = {
  provider: z.enum(PROVIDER_IDS).default("anthropic").meta({
    title: "Provider",
    description: "Its API key goes in Secrets: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY…",
  }),
  model: z.string().max(200).default("").meta({
    title: "Model",
    description: "Empty uses claude-opus-5-5 with Anthropic. Other providers need a model name",
  }),
  baseUrl: z.string().max(500).default("").meta({
    title: "Base URL",
    description: "Only for an OpenAI-compatible server or a proxy",
  }),
  effort: z.enum(["default", "low", "medium", "high"]).default("default").meta({
    title: "Effort",
    description: "How hard the model thinks before answering",
  }),
  maxTokens: z.coerce.number().int().min(16).max(64000).default(16000).meta({
    title: "Max tokens",
    description: "Upper limit for one answer, thinking included",
  }),
};
const modelTr = {
  provider: {
    title: "Sağlayıcı",
    description:
      "API anahtarı Secrets'a eklenir: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY…",
  },
  model: {
    title: "Model",
    description:
      "Boş bırakılırsa Anthropic ile claude-opus-5-5 kullanılır. Diğer sağlayıcılar model adı ister",
  },
  baseUrl: {
    title: "Base URL",
    description: "Sadece OpenAI uyumlu bir sunucu veya proxy için",
  },
  effort: {
    title: "Efor",
    description: "Modelin cevaplamadan önce ne kadar düşüneceği",
  },
  maxTokens: { title: "En fazla token", description: "Tek cevabın üst sınırı, düşünme dahil" },
};

const fitDiscord = z
  .boolean()
  .default(true)
  .meta({ title: "Fit the answer in one Discord message (2000 characters)" });
const fitDiscordTr = { title: "Cevabı tek Discord mesajına sığdır (2000 karakter)" };

export const generate = defineNodeMeta({
  type: "ai.generate",
  title: "AI Generate",
  description: "Asks a language model and saves its answer.",
  category: "data",
  outputs: ["next", "failed"],
  fields: z.object({
    prompt: z
      .string()
      .min(1)
      .default("{{message.content}}")
      .meta({ title: "Prompt", description: "What to ask. Variables work here", multiline: true }),
    system: z.string().max(20000).default("").meta({
      title: "Instructions",
      description: "Who the bot is and how it should answer",
      multiline: true,
    }),
    fitDiscord,
    ...model,
    variable: variable("answer", ["Error"]),
  }),
  locales: {
    tr: {
      title: "AI ile Yaz",
      description: "Bir dil modeline sorar ve cevabını kaydeder.",
      fields: {
        prompt: { title: "İstem", description: "Ne sorulacak. Değişkenler kullanılabilir" },
        system: { title: "Talimatlar", description: "Bot kim ve nasıl cevap vermeli" },
        fitDiscord: fitDiscordTr,
        ...modelTr,
        variable: variableTr,
      },
      outputs: { next: "sonra", failed: "hata" },
    },
  },
});

export const agent = defineNodeMeta({
  type: "ai.agent",
  title: "AI Agent",
  description:
    "Chats like an assistant, remembers the conversation and can call your functions as tools.",
  category: "data",
  outputs: ["next", "failed"],
  fields: z.object({
    prompt: z
      .string()
      .min(1)
      .default("{{message.content}}")
      .meta({ title: "Message", description: "What the person said", multiline: true }),
    system: z
      .string()
      .max(20000)
      .default("You are a friendly assistant in a Discord server. Answer briefly.")
      .meta({
        title: "Instructions",
        description: "Who the bot is and how it should answer",
        multiline: true,
      }),
    tools: z.string().max(2000).default("").meta({
      title: "Functions it may call",
      description: "Function names separated by commas, or * for all. Empty means none",
    }),
    memory: z.string().max(200).default("{{channel.id}}").meta({
      title: "Remember by",
      description: "Messages with the same value share a conversation. Empty forgets every time",
    }),
    memoryTurns: z.coerce.number().int().min(1).max(50).default(10).meta({
      title: "Exchanges to remember",
    }),
    maxSteps: z.coerce.number().int().min(1).max(20).default(6).meta({
      title: "Max tool rounds",
      description: "Stops the agent after this many rounds of function calls",
    }),
    fitDiscord,
    ...model,
    variable: variable("answer", ["Error", "Tools"]),
  }),
  locales: {
    tr: {
      title: "AI Ajanı",
      description:
        "Asistan gibi sohbet eder, konuşmayı hatırlar ve fonksiyonlarını araç olarak çağırabilir.",
      fields: {
        prompt: { title: "Mesaj", description: "Kişinin söylediği" },
        system: { title: "Talimatlar", description: "Bot kim ve nasıl cevap vermeli" },
        tools: {
          title: "Çağırabileceği fonksiyonlar",
          description: "Virgülle ayrılmış fonksiyon adları ya da hepsi için *. Boşsa hiçbiri",
        },
        memory: {
          title: "Neye göre hatırlasın",
          description:
            "Aynı değere sahip mesajlar aynı sohbeti paylaşır. Boşsa her seferinde unutur",
        },
        memoryTurns: { title: "Hatırlanacak konuşma sayısı" },
        maxSteps: {
          title: "En fazla araç turu",
          description: "Ajan bu kadar fonksiyon çağırma turundan sonra durur",
        },
        fitDiscord: fitDiscordTr,
        ...modelTr,
        variable: variableTr,
      },
      outputs: { next: "sonra", failed: "hata" },
    },
  },
});

export const extract = defineNodeMeta({
  type: "ai.extract",
  title: "AI Extract",
  description: "Pulls structured values out of free text, like a date, an amount or a name.",
  category: "data",
  outputs: ["next", "failed"],
  fields: z.object({
    input: z
      .string()
      .min(1)
      .default("{{message.content}}")
      .meta({ title: "Text", multiline: true }),
    fields: z
      .string()
      .min(1)
      .default("summary: one sentence about the text\nlanguage: the language it's written in")
      .meta({
        title: "Values to find",
        description: "One per line as name: what it is. Add (number) or (yes/no) for other types",
        multiline: true,
      }),
    ...model,
    variable: variable("data", ["Error"]),
  }),
  locales: {
    tr: {
      title: "AI ile Ayıkla",
      description: "Serbest metinden tarih, tutar veya isim gibi yapılı değerler çıkarır.",
      fields: {
        input: { title: "Metin" },
        fields: {
          title: "Bulunacak değerler",
          description: "Her satıra ad: ne olduğu. Başka türler için (number) veya (yes/no) ekle",
        },
        ...modelTr,
        variable: { ...variableTr, description: "Sonra {{vars.ad.alan}} olarak okunur" },
      },
      outputs: { next: "sonra", failed: "hata" },
    },
  },
});

export const check = defineNodeMeta({
  type: "ai.check",
  title: "AI Check",
  description: "Asks a yes or no question about a text, for example whether a message is spam.",
  category: "logic",
  outputs: ["yes", "no", "failed"],
  fields: z.object({
    input: z
      .string()
      .min(1)
      .default("{{message.content}}")
      .meta({ title: "Text", multiline: true }),
    question: z
      .string()
      .min(1)
      .default("Is this message spam, a scam or abusive?")
      .meta({ title: "Question", multiline: true }),
    ...model,
    variable: variable("reason", ["Error"]),
  }),
  locales: {
    tr: {
      title: "AI Kontrol",
      description:
        "Bir metin hakkında evet/hayır sorusu sorar, örneğin bir mesajın spam olup olmadığını.",
      fields: {
        input: { title: "Metin" },
        question: { title: "Soru" },
        ...modelTr,
        variable: {
          title: "Gerekçeyi kaydet",
          description: "Modelin kısa açıklaması {{vars.ad}} olarak okunur",
        },
      },
      outputs: { yes: "evet", no: "hayır", failed: "hata" },
    },
  },
});

export const aiNodeMetas = [generate, agent, extract, check];
