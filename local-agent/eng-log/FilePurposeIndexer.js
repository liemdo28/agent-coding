// eng-log/FilePurposeIndexer.js — file purpose index for log-first workflow
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const INDEX_PATH = '.local-agent/engineering-log/file-purpose-index.json';

// Static purpose map — all known system files with context sufficient to avoid opening them
const KNOWN_PURPOSES = {
  'bin/local-agent.js': {
    purpose: 'Main CLI — all local-agent commands (phases 1-55, 3600+ lines)',
    category: 'core', phase: 'all', status: 'STABLE', risk: 'low',
  },
  'accounting-engine/api/server.js': {
    purpose: 'Accounting REST API — binds to 127.0.0.1:8844 only',
    category: 'accounting', phase: '23', status: 'STABLE', risk: 'low',
  },
  'accounting-engine/db/AccountingDB.js': {
    purpose: 'SQLite WAL database for metrics. Hash-chain audit ledger.',
    category: 'accounting', phase: '23', status: 'STABLE', risk: 'low',
  },
  'accounting-engine/core/MetricCollector.js': {
    purpose: 'Collects CPU/RAM/GPU/disk metrics. Batch writes to SQLite every 5s.',
    category: 'accounting', phase: '23', status: 'STABLE', risk: 'low',
  },
  'accounting-engine/core/AuditLedger.js': {
    purpose: 'SHA-256 hash-chain audit ledger. Tamper-evident event log.',
    category: 'accounting', phase: '23', status: 'STABLE', risk: 'low',
  },
  'accounting-engine/core/BatchWriter.js': {
    purpose: 'Batches metric writes to SQLite (5s flush). Prevents write amplification.',
    category: 'accounting', phase: '23', status: 'STABLE', risk: 'low',
  },
  'local-agent/self-heal/HealthWatcher.js': {
    purpose: 'Workspace health monitor — detects config corruption, index staleness, lock files.',
    category: 'self-heal', phase: '24', status: 'STABLE', risk: 'low',
  },
  'local-agent/self-heal/CacheRepair.js': {
    purpose: 'Repairs stale or corrupted file index cache on health check failure.',
    category: 'self-heal', phase: '24', status: 'STABLE', risk: 'low',
  },
  'local-agent/self-heal/RuntimeRecovery.js': {
    purpose: 'Startup crash recovery — clears stale locks and temp files.',
    category: 'self-heal', phase: '24', status: 'STABLE', risk: 'low',
  },
  'local-agent/reasoning/TaskDecomposer.js': {
    purpose: 'Decomposes complex tasks into ordered subtasks with dependency graph.',
    category: 'reasoning', phase: '25', status: 'STABLE', risk: 'low',
  },
  'local-agent/reasoning/StrategyPlanner.js': {
    purpose: 'Selects implementation strategy by task type and risk level.',
    category: 'reasoning', phase: '25', status: 'STABLE', risk: 'low',
  },
  'local-agent/reasoning/RiskAssessor.js': {
    purpose: 'Estimates change risk score. Flags high-risk implementation paths.',
    category: 'reasoning', phase: '25', status: 'STABLE', risk: 'low',
  },
  'local-agent/reasoning/VerificationChain.js': {
    purpose: 'Post-implementation verification steps — confirms intent vs outcome.',
    category: 'reasoning', phase: '25', status: 'STABLE', risk: 'low',
  },
  'local-agent/optimizer/IncrementalIndexer.js': {
    purpose: 'Incremental file indexer using mtime manifest. Skips unchanged files.',
    category: 'optimizer', phase: '26', status: 'STABLE', risk: 'low',
  },
  'local-agent/optimizer/SmartFileCache.js': {
    purpose: 'LRU in-memory cache with byte-limit eviction. Prevents OOM on large repos.',
    category: 'optimizer', phase: '26', status: 'STABLE', risk: 'low',
  },
  'local-agent/optimizer/ParallelScanner.js': {
    purpose: 'Parallel file scanner using worker pools for large project analysis.',
    category: 'optimizer', phase: '26', status: 'STABLE', risk: 'low',
  },
  'local-agent/plugins/PluginRegistry.js': {
    purpose: 'Plugin registry — loads, validates, manages offline-only plugins.',
    category: 'plugins', phase: '27', status: 'STABLE', risk: 'medium',
  },
  'local-agent/plugins/PluginSandbox.js': {
    purpose: 'Plugin sandbox — blocks fetch/WebSocket/eval, limits filesystem access to workspace.',
    category: 'plugins', phase: '27', status: 'STABLE', risk: 'medium',
  },
  'local-agent/plugins/PluginValidator.js': {
    purpose: 'Validates plugin manifest.json permissions against allowlist before install.',
    category: 'plugins', phase: '27', status: 'STABLE', risk: 'medium',
  },
  'local-agent/team/TeamSyncManager.js': {
    purpose: 'LAN/NAS team sync with secret sanitization. All exports audit logged.',
    category: 'team', phase: '28', status: 'STABLE', risk: 'medium',
  },
  'local-agent/team/SecretSanitizer.js': {
    purpose: 'Strips secrets from team exports before LAN/NAS sync. Regex-based masking.',
    category: 'team', phase: '28', status: 'STABLE', risk: 'low',
  },
  'local-agent/timeline/TimelineStore.js': {
    purpose: 'Append-only JSONL event store — file changes, QA runs, patches, regressions.',
    category: 'timeline', phase: '34', status: 'STABLE', risk: 'low',
  },
  'local-agent/deps/DependencyHealthChecker.js': {
    purpose: 'Scans package.json for risky/abandoned/duplicate/oversized dependencies.',
    category: 'deps', phase: '35', status: 'STABLE', risk: 'low',
  },
  'local-agent/vault/SecretVault.js': {
    purpose: 'Hash-only secret storage (SHA-256). Detects raw secret exposure in workspace files.',
    category: 'vault', phase: '36', status: 'STABLE', risk: 'low',
  },
  'local-agent/incident/IncidentManager.js': {
    purpose: 'Incident management — create/analyze/recover with 8 category playbooks.',
    category: 'incident', phase: '37', status: 'STABLE', risk: 'low',
  },
  'local-agent/analytics/EngineeringAnalytics.js': {
    purpose: 'QA trend, regression frequency, fix success rate — ASCII bar charts, no cloud.',
    category: 'analytics', phase: '38', status: 'STABLE', risk: 'low',
  },
  'local-agent/governance/GovernanceEngine.js': {
    purpose: 'AI governance — patch approval policy, risk thresholds, restricted file zones.',
    category: 'governance', phase: '39', status: 'STABLE', risk: 'low',
  },
  'local-agent/rbac/RBACManager.js': {
    purpose: 'RBAC — 6 roles (viewer→ceo), permission matrix, role assignment, audit log.',
    category: 'rbac', phase: '40', status: 'STABLE', risk: 'low',
  },
  'local-agent/resources/ResourceMonitor.js': {
    purpose: 'CPU/RAM/GPU/disk/temp monitoring with threshold alerts. Local only.',
    category: 'resources', phase: '41', status: 'STABLE', risk: 'low',
  },
  'local-agent/vision/VisionAnalyzer.js': {
    purpose: 'Local PNG analysis — IHDR parsing, entropy check, byte-level diff. No cloud.',
    category: 'vision', phase: '42', status: 'STABLE', risk: 'low',
  },
  'local-agent/knowledge/KnowledgeEvolution.js': {
    purpose: 'Laplace confidence scoring. Knowledge promote/demote/expire based on QA feedback.',
    category: 'knowledge', phase: '43', status: 'STABLE', risk: 'low',
  },
  'local-agent/terminal/TerminalAnalyzer.js': {
    purpose: 'Parses bash/zsh/fish history. 7 dangerous patterns, 10 failure classifications.',
    category: 'terminal', phase: '44', status: 'STABLE', risk: 'low',
  },
  'local-agent/config-drift/ConfigDriftDetector.js': {
    purpose: 'Detects config drift — env diff, duplicate configs, stale config files.',
    category: 'config-drift', phase: '45', status: 'STABLE', risk: 'low',
  },
  'local-agent/fsint/FilesystemIntelligence.js': {
    purpose: 'Finds orphan files, duplicates, oversized files. Generates cleanup plan.',
    category: 'fsint', phase: '46', status: 'STABLE', risk: 'low',
  },
  'local-agent/standards/StandardsEnforcer.js': {
    purpose: 'Naming conventions, arch rules, test coverage thresholds, git hook installation.',
    category: 'standards', phase: '47', status: 'STABLE', risk: 'low',
  },
  'local-agent/patch-sim/PatchSimulator.js': {
    purpose: 'Estimates regression risk, affected tests/APIs before applying patch.',
    category: 'patch-sim', phase: '48', status: 'STABLE', risk: 'low',
  },
  'local-agent/modes/AgentModes.js': {
    purpose: 'Agent modes — safe/balanced/aggressive-debug/qa/architecture/learning.',
    category: 'modes', phase: '49', status: 'STABLE', risk: 'low',
  },
  'local-agent/memviz/MemoryVisualizer.js': {
    purpose: 'ASCII charts for QA trend, unstable modules, patch chains. No external deps.',
    category: 'memviz', phase: '50', status: 'STABLE', risk: 'low',
  },
  'local-agent/correlate/RootCauseCorrelator.js': {
    purpose: '5 known patterns: env-missing, db-corruption, dep-mismatch, port-conflict, workspace-corruption.',
    category: 'correlate', phase: '51', status: 'STABLE', risk: 'low',
  },
  'local-agent/playbooks/PlaybookLibrary.js': {
    purpose: '5 built-in playbooks — React QA, Vite migration, FastAPI debug, emergency rollback, Laravel.',
    category: 'playbooks', phase: '52', status: 'STABLE', risk: 'low',
  },
  'local-agent/eng-log/EngineeringLogManager.js': {
    purpose: 'Top-level coordinator — generates latest.md (single source of truth), architecture docs.',
    category: 'eng-log', phase: '54', status: 'STABLE', risk: 'low',
  },
  'local-agent/eng-log/ProgressTracker.js': {
    purpose: 'Persists current phase, completed tasks, in-progress items, priorities to progress.json.',
    category: 'eng-log', phase: '54', status: 'STABLE', risk: 'low',
  },
  'local-agent/eng-log/DecisionTracker.js': {
    purpose: 'Records architectural decisions as DEC-NNN.json + decisions-index.jsonl.',
    category: 'eng-log', phase: '54', status: 'STABLE', risk: 'low',
  },
  'local-agent/eng-log/CheckpointWriter.js': {
    purpose: 'Writes checkpoint-NNN.md files. List and read checkpoint support.',
    category: 'eng-log', phase: '54', status: 'STABLE', risk: 'low',
  },
  'local-agent/eng-log/BuildSummaryGenerator.js': {
    purpose: 'Generates build-summary-<ts>.md for QA/build runs with phase and score.',
    category: 'eng-log', phase: '54', status: 'STABLE', risk: 'low',
  },
  'local-agent/eng-log/IncidentRecorder.js': {
    purpose: 'Records INC-LOG-NNN.md + .json for regressions and runtime failures.',
    category: 'eng-log', phase: '54', status: 'STABLE', risk: 'low',
  },
  'local-agent/eng-log/FilePurposeIndexer.js': {
    purpose: 'File purpose index — keyword search across all system files. Log-first policy.',
    category: 'eng-log', phase: '55', status: 'STABLE', risk: 'low',
  },
  'local-agent/eng-log/ArchitectureSummarizer.js': {
    purpose: 'Implementation map — module purpose, main files, deps, status, risk level.',
    category: 'eng-log', phase: '55', status: 'STABLE', risk: 'low',
  },
  'local-agent/eng-log/EngineeringStateTracker.js': {
    purpose: 'Tracks blocked systems, known issues, active risks. Persisted to state.json.',
    category: 'eng-log', phase: '55', status: 'STABLE', risk: 'low',
  },
  'local-agent/eng-log/ContextPriorityManager.js': {
    purpose: 'Context priority manager — logs first, source files last. Enforces log-first policy.',
    category: 'eng-log', phase: '55', status: 'STABLE', risk: 'low',
  },
  'local-agent/eng-log/SmartFileSelector.js': {
    purpose: 'Picks minimum necessary source files for a task using purpose index + relevance scoring.',
    category: 'eng-log', phase: '55', status: 'STABLE', risk: 'low',
  },
};

export function buildFilePurposeIndex(workspaceRoot) {
  const index = { ...KNOWN_PURPOSES };

  const scanDir = (dir) => {
    if (!existsSync(dir)) return;
    try {
      for (const f of readdirSync(dir)) {
        const full = join(dir, f);
        try {
          if (statSync(full).isDirectory()) { scanDir(full); continue; }
        } catch { continue; }
        if (!f.endsWith('.js')) continue;
        const rel = relative(workspaceRoot, full).replace(/\\/g, '/');
        if (index[rel]) continue;
        try {
          const lines       = readFileSync(full, 'utf8').split('\n').slice(0, 5);
          const commentLine = lines.find((l) => l.startsWith('//'));
          const purpose     = commentLine
            ? commentLine.replace(/^\/\/\s*/, '').replace(/^[^—–\-:]+[—–\-:]\s*/, '')
            : `${f} — auto-indexed`;
          const category = rel.split('/')[1] ?? 'other';
          index[rel] = { purpose, category, phase: 'auto', status: 'UNKNOWN', risk: 'unknown' };
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  };

  scanDir(join(workspaceRoot, 'local-agent'));
  scanDir(join(workspaceRoot, 'accounting-engine'));

  saveFilePurposeIndex(workspaceRoot, index);
  return index;
}

export function loadFilePurposeIndex(workspaceRoot) {
  const p = join(workspaceRoot, INDEX_PATH);
  if (!existsSync(p)) return buildFilePurposeIndex(workspaceRoot);
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch { return buildFilePurposeIndex(workspaceRoot); }
}

export function saveFilePurposeIndex(workspaceRoot, index) {
  mkdirSync(join(workspaceRoot, '.local-agent/engineering-log'), { recursive: true });
  writeFileSync(join(workspaceRoot, INDEX_PATH), JSON.stringify(index, null, 2));
}

/**
 * Keyword search across the file purpose index.
 * @param {string} workspaceRoot
 * @param {string} query
 * @param {{ limit?: number }} opts
 * @returns {Array<{ file: string, purpose: string, category: string, phase: string, score: number }>}
 */
export function searchFilePurpose(workspaceRoot, query, { limit = 10 } = {}) {
  const index   = loadFilePurposeIndex(workspaceRoot);
  const terms   = query.toLowerCase().split(/\W+/).filter((t) => t.length > 1);
  const results = [];

  for (const [file, info] of Object.entries(index)) {
    const text  = `${file} ${info.purpose} ${info.category} ${info.phase}`.toLowerCase();
    const score = terms.reduce((acc, t) => acc + (text.includes(t) ? 1 : 0), 0);
    if (score > 0) {
      results.push({ file, purpose: info.purpose, category: info.category, phase: info.phase, score });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export { KNOWN_PURPOSES };
