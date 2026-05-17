// eng-log/ArchitectureSummarizer.js — implementation map and module relationships
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ARCH_DIR = '.local-agent/engineering-log/architecture';

const IMPLEMENTATION_MAP = [
  {
    name: 'Engineering Build Log',
    purpose: 'Single source of truth. latest.md is PRIMARY context — read before any implementation.',
    mainFiles: [
      'local-agent/eng-log/EngineeringLogManager.js',
      'local-agent/eng-log/ProgressTracker.js',
      'local-agent/eng-log/CheckpointWriter.js',
      'local-agent/eng-log/DecisionTracker.js',
      'local-agent/eng-log/BuildSummaryGenerator.js',
      'local-agent/eng-log/IncidentRecorder.js',
    ],
    dependencies: ['fs (built-in)', 'path (built-in)'],
    status: 'PASS', risk: 'low', phase: '54',
  },
  {
    name: 'Log-First Policy Layer (Phase 55)',
    purpose: 'Enforces log-first workflow. File purpose index, smart file selector, context priority, state tracker, architecture summaries.',
    mainFiles: [
      'local-agent/eng-log/FilePurposeIndexer.js',
      'local-agent/eng-log/ArchitectureSummarizer.js',
      'local-agent/eng-log/EngineeringStateTracker.js',
      'local-agent/eng-log/ContextPriorityManager.js',
      'local-agent/eng-log/SmartFileSelector.js',
    ],
    dependencies: ['FilePurposeIndexer (internal)'],
    status: 'PASS', risk: 'low', phase: '55',
  },
  {
    name: 'Accounting Engine',
    purpose: 'Resource accounting: metrics collection, SQLite WAL, hash-chain audit, REST API on 127.0.0.1:8844.',
    mainFiles: [
      'accounting-engine/api/server.js',
      'accounting-engine/db/AccountingDB.js',
      'accounting-engine/core/MetricCollector.js',
      'accounting-engine/core/AuditLedger.js',
      'accounting-engine/core/BatchWriter.js',
    ],
    dependencies: ['better-sqlite3', 'express'],
    status: 'PASS', risk: 'low', phase: '23',
  },
  {
    name: 'Self-Healing Engine',
    purpose: 'Workspace health monitoring. Cache repair, index repair, runtime recovery on startup.',
    mainFiles: [
      'local-agent/self-heal/HealthWatcher.js',
      'local-agent/self-heal/CacheRepair.js',
      'local-agent/self-heal/RuntimeRecovery.js',
    ],
    dependencies: ['fs (built-in)'],
    status: 'PASS', risk: 'low', phase: '24',
  },
  {
    name: 'Reasoning Engine',
    purpose: 'Task decomposition, strategy selection, risk assessment, verification chains.',
    mainFiles: [
      'local-agent/reasoning/TaskDecomposer.js',
      'local-agent/reasoning/StrategyPlanner.js',
      'local-agent/reasoning/RiskAssessor.js',
      'local-agent/reasoning/VerificationChain.js',
    ],
    dependencies: [],
    status: 'PASS', risk: 'low', phase: '25',
  },
  {
    name: 'Large Project Optimizer',
    purpose: 'Incremental indexer (mtime manifest), LRU cache with byte-limit eviction, parallel scanner.',
    mainFiles: [
      'local-agent/optimizer/IncrementalIndexer.js',
      'local-agent/optimizer/SmartFileCache.js',
      'local-agent/optimizer/ParallelScanner.js',
    ],
    dependencies: ['fast-glob'],
    status: 'PASS', risk: 'low', phase: '26',
  },
  {
    name: 'Plugin System',
    purpose: 'Plugin registry + sandbox. Blocks fetch/WebSocket/eval. Offline-only plugins with manifest validation.',
    mainFiles: [
      'local-agent/plugins/PluginRegistry.js',
      'local-agent/plugins/PluginSandbox.js',
      'local-agent/plugins/PluginValidator.js',
    ],
    dependencies: [],
    status: 'PASS', risk: 'medium', phase: '27',
  },
  {
    name: 'Team Collaboration',
    purpose: 'LAN/NAS team sync. Secret sanitization before any export. Fully audit logged.',
    mainFiles: ['local-agent/team/TeamSyncManager.js', 'local-agent/team/SecretSanitizer.js'],
    dependencies: [],
    status: 'PASS', risk: 'medium', phase: '28',
  },
  {
    name: 'Source Timeline',
    purpose: 'Append-only JSONL event store. Records file changes, QA runs, patches, regressions.',
    mainFiles: ['local-agent/timeline/TimelineStore.js'],
    dependencies: ['fs (built-in)'],
    status: 'PASS', risk: 'low', phase: '34',
  },
  {
    name: 'Dependency Health',
    purpose: 'Scans package.json for risky/abandoned/duplicate/oversized dependencies.',
    mainFiles: ['local-agent/deps/DependencyHealthChecker.js'],
    dependencies: ['fs (built-in)'],
    status: 'PASS', risk: 'low', phase: '35',
  },
  {
    name: 'Secret Vault',
    purpose: 'Hash-only secret storage (SHA-256, 16-char prefix). Detects raw secret exposure in workspace.',
    mainFiles: ['local-agent/vault/SecretVault.js'],
    dependencies: ['crypto (built-in)'],
    status: 'PASS', risk: 'low', phase: '36',
  },
  {
    name: 'Incident Response',
    purpose: 'Incident creation, analysis, recovery. 8 category playbooks. Audit log.',
    mainFiles: ['local-agent/incident/IncidentManager.js'],
    dependencies: [],
    status: 'PASS', risk: 'low', phase: '37',
  },
  {
    name: 'Engineering Analytics',
    purpose: 'QA trend, regression frequency, fix success rate. ASCII bar charts. No cloud.',
    mainFiles: ['local-agent/analytics/EngineeringAnalytics.js'],
    dependencies: ['TimelineStore'],
    status: 'PASS', risk: 'low', phase: '38',
  },
  {
    name: 'AI Governance',
    purpose: 'Patch approval policy, risk thresholds, restricted file zones. Audit logged.',
    mainFiles: ['local-agent/governance/GovernanceEngine.js'],
    dependencies: [],
    status: 'PASS', risk: 'low', phase: '39',
  },
  {
    name: 'RBAC',
    purpose: '6 roles (viewer→ceo), permission matrix, role assignment, all changes audit logged.',
    mainFiles: ['local-agent/rbac/RBACManager.js'],
    dependencies: [],
    status: 'PASS', risk: 'low', phase: '40',
  },
  {
    name: 'Resource Monitor',
    purpose: 'CPU/RAM/GPU/disk/temp monitoring with threshold alerts. Fully local.',
    mainFiles: ['local-agent/resources/ResourceMonitor.js'],
    dependencies: [],
    status: 'PASS', risk: 'low', phase: '41',
  },
  {
    name: 'Visual Debug',
    purpose: 'Local PNG analysis — IHDR parsing, entropy check, byte-level diff. No cloud.',
    mainFiles: ['local-agent/vision/VisionAnalyzer.js'],
    dependencies: [],
    status: 'PASS', risk: 'low', phase: '42',
  },
  {
    name: 'Knowledge Evolution',
    purpose: 'Laplace confidence scoring. Knowledge promote/demote/expire based on QA feedback.',
    mainFiles: ['local-agent/knowledge/KnowledgeEvolution.js'],
    dependencies: [],
    status: 'PASS', risk: 'low', phase: '43',
  },
  {
    name: 'Terminal Intelligence',
    purpose: 'Parses bash/zsh/fish history. 7 dangerous patterns, 10 failure classifications.',
    mainFiles: ['local-agent/terminal/TerminalAnalyzer.js'],
    dependencies: [],
    status: 'PASS', risk: 'low', phase: '44',
  },
  {
    name: 'Config Drift Detector',
    purpose: 'Detects env drift, duplicate configs, stale config files.',
    mainFiles: ['local-agent/config-drift/ConfigDriftDetector.js'],
    dependencies: [],
    status: 'PASS', risk: 'low', phase: '45',
  },
  {
    name: 'Filesystem Intelligence',
    purpose: 'Finds orphan files, duplicates, oversized files. Generates cleanup plan.',
    mainFiles: ['local-agent/fsint/FilesystemIntelligence.js'],
    dependencies: [],
    status: 'PASS', risk: 'low', phase: '46',
  },
  {
    name: 'Standards Enforcer',
    purpose: 'Naming conventions, arch rules, test coverage thresholds, git hook installation.',
    mainFiles: ['local-agent/standards/StandardsEnforcer.js'],
    dependencies: [],
    status: 'PASS', risk: 'low', phase: '47',
  },
  {
    name: 'Patch Simulation',
    purpose: 'Estimates regression risk score, affected tests and APIs before applying patch.',
    mainFiles: ['local-agent/patch-sim/PatchSimulator.js'],
    dependencies: [],
    status: 'PASS', risk: 'low', phase: '48',
  },
  {
    name: 'Agent Modes',
    purpose: '6 operational modes: safe/balanced/aggressive-debug/qa/architecture/learning.',
    mainFiles: ['local-agent/modes/AgentModes.js'],
    dependencies: [],
    status: 'PASS', risk: 'low', phase: '49',
  },
  {
    name: 'Memory Visualizer',
    purpose: 'ASCII charts for QA trend, unstable modules, patch chains. No external deps.',
    mainFiles: ['local-agent/memviz/MemoryVisualizer.js'],
    dependencies: ['TimelineStore'],
    status: 'PASS', risk: 'low', phase: '50',
  },
  {
    name: 'Root Cause Correlator',
    purpose: '5 known patterns: env-missing, db-corruption, dep-mismatch, port-conflict, workspace-corruption.',
    mainFiles: ['local-agent/correlate/RootCauseCorrelator.js'],
    dependencies: ['TimelineStore'],
    status: 'PASS', risk: 'low', phase: '51',
  },
  {
    name: 'Playbook System',
    purpose: '5 built-in playbooks: React release QA, Vite migration, FastAPI debug, emergency rollback, Laravel deploy.',
    mainFiles: ['local-agent/playbooks/PlaybookLibrary.js'],
    dependencies: [],
    status: 'PASS', risk: 'low', phase: '52',
  },
  {
    name: 'Engineering OS',
    purpose: 'Unified dashboard — `local-agent os` loads all 10 subsystems in parallel (Promise.all).',
    mainFiles: ['bin/local-agent.js (os command)'],
    dependencies: ['All subsystems'],
    status: 'PASS', risk: 'low', phase: '53',
  },
];

export function getImplementationMap() {
  return IMPLEMENTATION_MAP;
}

export function generateImplementationMapMd() {
  const sections = IMPLEMENTATION_MAP.map((m) => {
    const filesStr = m.mainFiles.map((f) => `- \`${f}\``).join('\n');
    const depsStr  = m.dependencies.length
      ? m.dependencies.map((d) => `- ${d}`).join('\n')
      : '- none (built-in only)';
    return `## ${m.name}

**Phase:** ${m.phase} | **Status:** ${m.status} | **Risk:** ${m.risk}

**Purpose:**
${m.purpose}

**Main Files:**
${filesStr}

**Dependencies:**
${depsStr}`;
  }).join('\n\n---\n\n');

  return `# Implementation Map
> Every module — purpose, main files, dependencies, status, risk.
> Read this BEFORE opening source files.

${sections}
`;
}

export function generateModuleRelationshipMd() {
  return `# Module Relationships

\`\`\`
Engineering Build Log ←── All modules write to timeline/logs
          ↓
  latest.md  (single source of truth — READ FIRST)
          ↓
  Engineering OS (local-agent os) ──→ loads all subsystems

Accounting Engine ──→ SQLite WAL ──→ REST API (127.0.0.1:8844)
Self-Healing      ──→ watches workspace, repairs on startup
QA Engine         ──→ build/test/lint → score → timeline
Patch System      ──→ propose → simulate → approve → apply → QA
Secret Vault      ──→ hash-only store → governance enforces
RBAC              ──→ permission checks before sensitive ops
Timeline          ←── QA, patches, file changes, incidents
Analytics         ──→ reads timeline → ASCII charts
Memory Viz        ──→ reads timeline → trend charts
Root Cause        ──→ reads timeline → correlates patterns
\`\`\`

## Log-First Read Order
\`\`\`
1. latest.md                              (current state)
2. checkpoints/checkpoint-NNN.md          (last progress)
3. architecture/implementation-map.md     (module map)
4. file-purpose-index.json               (file search)
5. incidents/                             (active issues)
6. source files                           (last resort only)
\`\`\`
`;
}

export function writeImplementationMap(workspaceRoot) {
  const dir = join(workspaceRoot, ARCH_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'implementation-map.md'), generateImplementationMapMd());
  writeFileSync(join(dir, 'module-relationships.md'), generateModuleRelationshipMd());
}
