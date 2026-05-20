# Windows Setup

Windows is a priority target for local resource collection and offline AI workflows.

## Prerequisites

- Windows 10/11.
- PowerShell.
- Git for Windows.
- Node.js compatible with repository engines.
- Visual Studio Build Tools for native Node dependencies.
- Optional: Ollama for Windows.

## Setup

```powershell
git clone https://github.com/liemdo28/agent-coding.git
cd agent-coding
npm install
cd accounting-engine
npm install
cd ..\local-agent\ui\frontend
npm install
```

## Validation

```powershell
cd path\to\agent-coding
npm run dev -- --help
npm run ui
```

```powershell
cd accounting-engine
npm test
npm run api
```

## Resource Monitoring Direction

The accounting roadmap calls for Windows-first resource tracking using local collectors. Prefer PowerShell or Windows APIs for CPU, RAM, disk, GPU, and process metrics. If GPU or VRAM is unavailable, collectors must return a graceful fallback instead of failing the monitor.
