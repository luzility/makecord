# @makecord/plugin-ai

AI blocks for [Makecord](https://makecord.luzili.tech) bots.

| Block       | What it does                                                                      |
| ----------- | --------------------------------------------------------------------------------- |
| AI Generate | Asks a model and saves the answer in a variable                                   |
| AI Agent    | Chats with memory per channel (or any key) and calls your function flows as tools |
| AI Extract  | Pulls typed values out of free text into `{{vars.data.name}}`                     |
| AI Check    | Answers a yes or no question about a text, with `yes`, `no` and `failed` ports    |

## Providers

Claude models run through the official Anthropic SDK. The others use their OpenAI-compatible endpoints.

| Provider          | Secret               |
| ----------------- | -------------------- |
| Anthropic         | `ANTHROPIC_API_KEY`  |
| OpenAI            | `OPENAI_API_KEY`     |
| Google Gemini     | `GEMINI_API_KEY`     |
| OpenRouter        | `OPENROUTER_API_KEY` |
| Groq              | `GROQ_API_KEY`       |
| Ollama            | none                 |
| OpenAI-compatible | `AI_API_KEY`         |

Add the key in the IDE's Secrets panel, or in `.env` when you host the bot yourself. With Anthropic, an empty model field uses `claude-opus-5-5`, and requests that a safety classifier declines are retried on a fallback model.

## Tools

An AI Agent only calls the functions you list in its settings. A function is a flow with a name, a description and arguments; the agent reads the description to decide when to call it. Model output is untrusted, so keep anything destructive, like banning, behind your own checks inside the function.

## Install

In the IDE, open **Plugins** and install `@makecord/plugin-ai`. Without the IDE:

```bash
npm install @makecord/plugin-ai
```

and add it to `plugins` in `makecord.json`.
