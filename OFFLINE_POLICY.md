# Offline Policy

## Overview

The local-agent is an offline-first AI coding assistant. All AI inference, code analysis, indexing, and tool execution happen entirely on your local machine. This document explains the offline-first design, how to set up local dependencies, and how to verify that no network traffic is generated.

---

## 1. Offline-First Design

The agent is built around the assumption that no internet connection is available or permitted:

- The configuration flag `offline: true` is permanently enforced at the application layer. It cannot be disabled by project or user configuration.
- All LLM inference is delegated to a locally-running model server (Ollama) via `http://localhost:11434`. No remote API keys or cloud LLM endpoints are used.
- All file scanning, indexing, and code analysis run entirely on local disk.
- All generated data (project maps, patches, reports, logs, memory) is stored in the project's `.local-agent/` directory.
- No CDN-loaded assets, no remote configuration, no feature flags fetched from servers.

---

## 2. Local LLM Requirement

Phase 2+ of the agent requires a locally-running Ollama instance with at least one model installed.

### Install Ollama

```bash
# Linux / macOS
curl -fsSL https://ollama.com/install.sh | sh

# Or download manually from https://ollama.com/download
```

### Pull the required model

```bash
ollama pull qwen2.5-coder:7b       # Primary model (default)
ollama pull codellama:7b            # Fallback model
```

### Start Ollama

```bash
ollama serve                        # Starts on http://localhost:11434
```

### Verify the model is available

```bash
ollama list
curl http://localhost:11434/api/tags
```

The agent config (`local-agent/config/default.json`) specifies:
- `llm.provider`: `"ollama"`
- `llm.model`: `"qwen2.5-coder:7b"`
- `llm.baseUrl`: `"http://localhost:11434"`
- `llm.fallbackModel`: `"codellama:7b"`

To use a different model, override via `.local-agent/config.json` in your project:

```json
{
  "llm": {
    "model": "deepseek-coder:6.7b"
  }
}
```

---

## 3. No External API Calls

The agent explicitly does not use and does not bundle:

- OpenAI API (`api.openai.com`)
- Anthropic API (`api.anthropic.com`)
- Google Vertex AI or Gemini APIs
- Hugging Face Inference API
- Any cloud vector database (Pinecone, Weaviate cloud, Chroma cloud)
- Any cloud storage (S3, GCS, Azure)
- Any analytics or monitoring services (Datadog, New Relic, Sentry, etc.)
- Any CDN or remote asset fetching

All npm dependencies are installed at project setup time (`npm install`) and cached locally in `node_modules`. No packages are downloaded at runtime.

---

## 4. How to Verify Offline Operation

### Method 1: Check configuration

```bash
local-agent status [path]
```

Confirms `Offline mode: true`, `Telemetry: false`, `Cloud sync: false`.

### Method 2: Network monitoring (Linux)

```bash
# Monitor outbound connections while running the agent
ss -tp | grep node
# or
netstat -anp | grep node

# Block all outbound except localhost (test environment)
sudo iptables -A OUTPUT -p tcp -d 127.0.0.1 -j ACCEPT
sudo iptables -A OUTPUT -p tcp -j REJECT
```

### Method 3: DNS-level blocking (advanced)

Configure your network or `/etc/hosts` to block resolution of external AI API domains:

```
# /etc/hosts
0.0.0.0 api.openai.com
0.0.0.0 api.anthropic.com
0.0.0.0 generativelanguage.googleapis.com
```

The agent must continue to function normally with these blocks in place.

### Method 4: Inspect source code

The agent source files are plain ES module JavaScript with no obfuscation. Verify that no `fetch()`, `http.request()`, `axios`, `node-fetch`, `got`, or similar HTTP client calls exist in the core modules:

```bash
grep -r "fetch\|axios\|node-fetch\|http\.request\|https\.request" local-agent/core/ local-agent/scanner/ local-agent/sandbox/
```

Expected output: none (or only in comments).

---

## 5. Network Isolation Recommendations

For production or sensitive environments, enforce network isolation at the OS/infrastructure level in addition to the application-layer controls:

### Linux (systemd service isolation)

If running the agent as a service, use systemd's `RestrictAddressFamilies` and `IPAddressDeny`:

```ini
[Service]
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
IPAddressDeny=any
IPAddressAllow=127.0.0.1/8 ::1/128
```

### Container isolation (Docker)

```bash
docker run --network=none \
  -v /path/to/project:/workspace \
  local-agent init /workspace
```

### Firewall (ufw)

```bash
# Allow only loopback
ufw default deny outgoing
ufw allow out on lo
```

### Air-gapped environments

In a fully air-gapped environment:

1. Pre-install Node.js and npm dependencies offline.
2. Pull Ollama models on a connected machine, export them, and transfer via physical media.
3. Install Ollama and import the model on the air-gapped machine.
4. Run `local-agent init` — no network access is required.

---

## 6. Offline npm Install

When installing dependencies in an offline or restricted environment:

```bash
# On a connected machine, pack dependencies:
npm pack --dry-run        # See what would be packed
npm ci                    # Clean install from lockfile

# Transfer node_modules or use npm's offline cache:
npm install --prefer-offline
npm install --offline     # Strict offline — fails if any package is not cached
```

---

## 7. Summary Checklist

Before deploying in an offline environment, verify:

- [ ] Node.js >= 18.0.0 is installed locally
- [ ] `npm install` completed successfully (all packages in `node_modules`)
- [ ] Ollama is installed and running at `http://localhost:11434`
- [ ] Required model(s) are pulled and listed in `ollama list`
- [ ] `local-agent status` shows `offline: true`, `telemetry: false`
- [ ] No outbound connections observed during `local-agent init` or `local-agent scan`
- [ ] (Optional) Network firewall rules applied to prevent accidental egress
