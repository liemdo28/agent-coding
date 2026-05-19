# Local AI Engineering OS

**The engineering partner that lives on the machine where the code lives.**

A fully offline AI coding agent that learns your codebase, remembers team decisions, and never sends a byte to anyone else's GPUs. Built for air-gapped environments, regulated industries, and privacy-first teams.

## Overview

Local Agent is an AI-powered engineering assistant that runs entirely on your local machine. It combines:

- **Multi-language AST parsing** with Tree-sitter for deep code understanding
- **Knowledge graph** that learns from your codebase over time
- **Cross-project pattern learning** that compounds insights across projects
- **Robust sandboxing** with filesystem, network, and process isolation
- **Full audit trail** with hash-chain verification for compliance

## Quickstart

```bash
# Install dependencies
npm install

# Run the main CLI
npm start

# Or install globally
npm install -g
local-agent --help
```

## CLI Commands

### Core Systems

| Command | Description |
|---------|-------------|
| `local-agent time-machine` | Rewind engineering state |
| `local-agent cognitive` | Cognitive load balancer |
| `local-agent forensic` | Engineering forensics engine |
| `local-agent distill` | Engineering knowledge distiller |
| `local-agent war-room` | Autonomous QA operations |
| `local-agent dna` | Engineering DNA profiler |
| `local-agent strategy` | High-level planning |
| `local-agent economics` | Engineering economics tracking |
| `local-agent optimize` | Self-optimizing engine |
| `local-agent singularity` | Unified autonomous ecosystem |

### Development Tools

| Command | Description |
|---------|-------------|
| `local-agent memory` | Local memory system |
| `local-agent patch` | Local patch management |
| `local-agent qa` | Local QA system |
| `local-agent governance` | Local governance system |
| `local-agent resources` | Local resource monitor |
| `local-agent analytics` | Engineering analytics |

### Data Tools

| Command | Description |
|---------|-------------|
| `local-agent marketing-db import <csv>` | Import marketing data |
| `local-agent marketing-db export <output>` | Export marketing data |
| `local-agent marketing-db report` | Generate reports |

### Evaluation

```bash
# Run evaluation harness
node eval/runner.js <model> <benchmark>

# Example: Run HumanEval on qwen2.5-coder:7b
node eval/runner.js qwen2.5-coder:7b humaneval
```

## Architecture

```
agent-coding/
├── bin/                    # CLI entry points
│   ├── cli.js             # Main CLI
│   └── marketing-db.js    # Marketing data CLI
├── src/                   # Source code
│   ├── coding-core/       # M2: Coding agent core
│   ├── parser/            # M1: Multi-language AST parsing
│   ├── llm/              # LLM integration
│   ├── debug/             # M3: Auto-debug loop
│   ├── testing/           # M3: Test generation
│   ├── knowledge-graph/   # M4: Knowledge graph
│   ├── cross-project/     # M4: Cross-project learning
│   ├── sandbox/           # M5: Security sandbox
│   ├── vault/             # M5: Secret management
│   ├── rbac/              # M5: Role-based access control
│   ├── da/                # M6: Data analysis
│   ├── memory/            # Memory system
│   ├── patch/             # Patch management
│   ├── qa/                # QA system
│   ├── governance/        # Governance system
│   └── shared/            # Shared utilities
├── eval/                   # Evaluation harness
│   ├── runner.js          # Benchmark runner
│   ├── datasets/          # HumanEval, MBPP, SWE-bench
│   └── results/           # Evaluation results
├── scripts/               # Verification scripts
└── data/                  # Local data storage
```

## Offline Policy

**100% Offline • Local-only • No Telemetry**

Local Agent is designed for air-gapped environments:

- ✅ All processing happens locally
- ✅ No network calls to external services
- ✅ Models run via Ollama on localhost
- ✅ Data never leaves your machine
- ✅ No telemetry, analytics, or crash reporting by default

### Ollama Integration

Local Agent uses [Ollama](https://ollama.ai/) for local LLM inference:

```bash
# Install Ollama
brew install ollama

# Pull a coding model
ollama pull qwen2.5-coder:7b

# Start Ollama server
ollama serve
```

## Development

### Prerequisites

- Node.js 18+
- Ollama (for LLM features)
- Tree-sitter CLI (for AST parsing)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd agent-coding

# Install dependencies
npm install

# Run tests
npm test

# Lint code
npm run lint
```

### Verification Scripts

Each milestone has a verification script:

```bash
# Run M0 verification
./scripts/m0-verify.sh

# Run M1 verification (after implementing)
./scripts/m1-verify.sh
```

## Roadmap

| Milestone | Timeline | Goal |
|-----------|----------|------|
| M0 | Weeks 1-2 | Foundation hardening |
| M1 | Weeks 3-6 | Multi-language AST |
| M2 | Weeks 7-10 | Coding agent core |
| M3 | Weeks 11-14 | Auto-debug & test generation |
| M4 | Weeks 15-18 | Knowledge graph |
| M5 | Weeks 19-21 | Security hardening |
| M6 | Weeks 22-24 | Data analysis pillar |
| M7 | Weeks 25-27 | Accounting pillar |
| M8 | Weeks 28-31 | IDE integration |
| M9 | Weeks 32-34 | Binary distribution |
| M10 | Weeks 35-37 | Performance & scale |
| M11 | Weeks 38-42 | Fine-tuning pipeline |
| M12 | Weeks 43-48 | v2.0 GA release |

## Team

8 senior engineers building the future of local AI-assisted development.

## License

MIT