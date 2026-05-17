# Ollama Setup

Ollama is the default local model runtime target.

## Policy

- Ollama must run locally.
- Default endpoint: `http://localhost:11434`.
- The local agent must reject external LLM endpoints.
- No prompts or source code should be sent to cloud LLM APIs during runtime.

## Basic Setup

```bash
ollama serve
ollama pull qwen2.5-coder:7b
```

The default model configuration lives in:

```text
local-agent/config/default.json
```

## Validation

```bash
npm run dev -- status .
npm run dev -- ask "summarize this project" .
```

If Ollama is unavailable, commands that require LLM inference should fail clearly or fall back to non-LLM behavior where supported.
