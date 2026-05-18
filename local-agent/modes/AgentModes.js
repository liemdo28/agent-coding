// modes/AgentModes.js — agent personality and operational modes
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const MODE_FILE = '.local-agent/agent-mode.json';

export const MODES = {
  'safe': {
    id:           'safe',
    name:         'Safe Mode',
    description:  'Maximum caution. All patches require explicit approval. No auto-apply.',
    retryDepth:   1,
    patchAggression: 'minimal',
    qaStrictness: 'strict',
    verbosity:    'high',
    riskTolerance: 'none',
    color:        'green',
    autoApply:    false,
    requireQA:    true,
  },
  'balanced': {
    id:           'balanced',
    name:         'Balanced Mode',
    description:  'Default mode. Balanced risk/speed trade-off.',
    retryDepth:   3,
    patchAggression: 'moderate',
    qaStrictness: 'standard',
    verbosity:    'normal',
    riskTolerance: 'medium',
    color:        'cyan',
    autoApply:    false,
    requireQA:    true,
  },
  'aggressive-debug': {
    id:           'aggressive-debug',
    name:         'Aggressive Debug Mode',
    description:  'Deep debugging with verbose output. Higher retry depth.',
    retryDepth:   8,
    patchAggression: 'high',
    qaStrictness: 'relaxed',
    verbosity:    'verbose',
    riskTolerance: 'high',
    color:        'red',
    autoApply:    false,
    requireQA:    false,
  },
  'qa': {
    id:           'qa',
    name:         'QA Mode',
    description:  'Optimized for quality assurance. Extra test runs and coverage checks.',
    retryDepth:   2,
    patchAggression: 'conservative',
    qaStrictness: 'strict',
    verbosity:    'high',
    riskTolerance: 'low',
    color:        'yellow',
    autoApply:    false,
    requireQA:    true,
  },
  'architecture': {
    id:           'architecture',
    name:         'Architecture Review Mode',
    description:  'Deep architecture analysis. Focus on structure, patterns, anti-patterns.',
    retryDepth:   2,
    patchAggression: 'none',
    qaStrictness: 'strict',
    verbosity:    'verbose',
    riskTolerance: 'none',
    color:        'magenta',
    autoApply:    false,
    requireQA:    true,
  },
  'learning': {
    id:           'learning',
    name:         'Learning Mode',
    description:  'Agent explains every decision. Records outcomes to knowledge base.',
    retryDepth:   3,
    patchAggression: 'minimal',
    qaStrictness: 'standard',
    verbosity:    'verbose',
    riskTolerance: 'low',
    color:        'blue',
    autoApply:    false,
    requireQA:    true,
  },
};

/**
 * Get the current agent mode.
 * @param {string} workspaceRoot
 * @returns {Mode}
 */
export function getMode(workspaceRoot) {
  const p = join(workspaceRoot, MODE_FILE);
  if (!existsSync(p)) return MODES.balanced;
  try {
    const saved = JSON.parse(readFileSync(p, 'utf8'));
    return MODES[saved.id] ?? MODES.balanced;
  } catch { return MODES.balanced; }
}

/**
 * Set the agent mode.
 * @param {string} workspaceRoot
 * @param {string} modeId — key from MODES
 * @returns {Mode}
 */
export function setMode(workspaceRoot, modeId) {
  const mode = Object.values(MODES).find(
    (m) => m.id === modeId || m.name.toLowerCase() === modeId.toLowerCase()
  );
  if (!mode) throw new Error(`Unknown mode: "${modeId}". Valid: ${Object.keys(MODES).join(', ')}`);
  mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
  writeFileSync(join(workspaceRoot, MODE_FILE), JSON.stringify({ id: mode.id, setAt: new Date().toISOString() }));
  return mode;
}

/**
 * List all available modes.
 * @returns {Mode[]}
 */
export function listModes() {
  return Object.values(MODES);
}
