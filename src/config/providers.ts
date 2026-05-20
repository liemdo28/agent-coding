export const providers = {
  opusmax: {
    name: process.env.OPUSMAX_NAME,
    baseURL: process.env.OPUSMAX_BASE_URL,
    apiKey: process.env.OPUSMAX_API_KEY,
    defaultModel: process.env.OPUSMAX_DEFAULT_MODEL,
  },

  openrouter: {
    name: process.env.OPENROUTER_NAME,
    baseURL: process.env.OPENROUTER_BASE_URL,
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultModel: process.env.OPENROUTER_DEFAULT_MODEL,
  },

  openai: {
    name: process.env.OPENAI_NAME,
    baseURL: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: process.env.OPENAI_DEFAULT_MODEL,
  },

  anthropic: {
    name: process.env.ANTHROPIC_NAME,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL,
  },

  gemini: {
    name: process.env.GEMINI_NAME,
    baseURL: process.env.GEMINI_BASE_URL,
    apiKey: process.env.GEMINI_API_KEY,
    defaultModel: process.env.GEMINI_DEFAULT_MODEL,
  },

  ollama: {
    name: process.env.OLLAMA_NAME,
    baseURL: process.env.OLLAMA_BASE_URL,
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL,
  },
}
