export const PROVIDERS = {
  anthropic: { label: "Anthropic (Claude)", secret: "ANTHROPIC_API_KEY", baseUrl: "" },
  openai: { label: "OpenAI", secret: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1" },
  gemini: {
    label: "Google Gemini",
    secret: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  openrouter: {
    label: "OpenRouter",
    secret: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
  },
  groq: { label: "Groq", secret: "GROQ_API_KEY", baseUrl: "https://api.groq.com/openai/v1" },
  ollama: { label: "Ollama (local)", secret: "", baseUrl: "http://localhost:11434/v1" },
  custom: { label: "OpenAI-compatible", secret: "AI_API_KEY", baseUrl: "" },
} as const;

export type ProviderId = keyof typeof PROVIDERS;
export const PROVIDER_IDS = Object.keys(PROVIDERS) as [ProviderId, ...ProviderId[]];
