// models/ModelManager.js - main entry point for local model management

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

import { detectAllProviders } from './ModelDetector.js';
import { getModelInfo, getBestCodingModels } from './ModelInfo.js';
import { benchmarkAll, benchmarkModel, BENCHMARK_PROMPT } from './ModelBenchmark.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}

function readJSON(filePath, fallback = null) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function agentDir(workspaceRoot) {
  return join(workspaceRoot, '.local-agent');
}

function configPath(workspaceRoot) {
  return join(agentDir(workspaceRoot), 'config.json');
}

function benchmarkPath(workspaceRoot) {
  return join(agentDir(workspaceRoot), 'model-benchmarks.json');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * List all detected models across all providers, enriched with ModelInfo metadata.
 *
 * @param {object} config
 * @returns {Promise<Array<{ name: string, provider: string, baseUrl: string } & object>>}
 */
async function listModels(config) {
  const { providers } = await detectAllProviders(config);
  const enriched = [];
  for (const p of providers) {
    if (!p.available) continue;
    for (const model of p.models) {
      enriched.push({
        ...model,
        provider: p.name,
        baseUrl: p.baseUrl,
        ...getModelInfo(model.name),
      });
    }
  }
  return enriched;
}

/**
 * Get a summary of the current active provider and model.
 *
 * @param {object} config
 * @returns {Promise<{ activeProvider: string|null, activeModel: string|null, available: boolean, contextWindow: number, ramEstimate: string, codingScore: number, fallback: string|null }>}
 */
async function getStatus(config) {
  const { providers, activeProvider } = await detectAllProviders(config);
  const activeModel = config?.llm?.model ?? null;
  const fallbackModel = config?.llm?.fallbackModel ?? null;

  const available = providers.some((p) => p.available);
  const info = activeModel ? getModelInfo(activeModel) : { contextWindow: 0, ramEstimateGB: 0, codingScore: 0 };

  return {
    activeProvider,
    activeModel,
    available,
    contextWindow: info.contextWindow,
    ramEstimate: `~${info.ramEstimateGB} GB`,
    codingScore: info.codingScore,
    fallback: fallbackModel,
  };
}

/**
 * Set the active model in the workspace config and write it back.
 *
 * @param {string} modelName
 * @param {string} workspaceRoot
 * @returns {object} updated config
 */
function selectModel(modelName, workspaceRoot) {
  ensureDir(agentDir(workspaceRoot));
  const existing = readJSON(configPath(workspaceRoot), {});
  if (!existing.llm) existing.llm = {};
  existing.llm.model = modelName;
  writeJSON(configPath(workspaceRoot), existing);
  return existing;
}

/**
 * Send the benchmark prompt to the active provider/model and return success/timing info.
 *
 * @param {object} config
 * @returns {Promise<{ success: boolean, latencyMs: number|null, response: string }>}
 */
async function testModel(config) {
  const provider = config?.llm?.provider ?? 'ollama';
  const baseUrl = config?.llm?.baseUrl ?? 'http://localhost:11434';
  const modelName = config?.llm?.model ?? 'qwen2.5-coder:7b';

  const result = await benchmarkModel(provider, baseUrl, modelName);

  return {
    success: !result.error,
    latencyMs: result.latencyMs,
    response: (result.response ?? result.error ?? '').slice(0, 200),
  };
}

/**
 * Benchmark all available models and save results to .local-agent/model-benchmarks.json.
 *
 * @param {object} config
 * @param {string} workspaceRoot
 * @returns {Promise<Array>}
 */
async function benchmarkModels(config, workspaceRoot) {
  const { providers } = await detectAllProviders(config);
  const results = await benchmarkAll(providers);

  if (workspaceRoot) {
    ensureDir(agentDir(workspaceRoot));
    writeJSON(benchmarkPath(workspaceRoot), {
      timestamp: new Date().toISOString(),
      results,
    });
  }

  return results;
}

/**
 * Determine the best model for coding by combining benchmark results and detection.
 *
 * @param {object} config
 * @param {string} [workspaceRoot]
 * @returns {Promise<string|null>} model name or null if none found
 */
async function getBestModel(config, workspaceRoot) {
  // Try saved benchmark results first
  let saved = null;
  if (workspaceRoot) {
    const bPath = benchmarkPath(workspaceRoot);
    const data = readJSON(bPath, null);
    if (data?.results?.length) {
      // Pick fastest non-error result
      const best = data.results.find((r) => !r.error && r.tokensPerSec !== null);
      if (best) saved = best.model;
    }
  }

  // Detect available models and pick best by codingScore
  const { providers } = await detectAllProviders(config);
  const allModelNames = [];
  for (const p of providers) {
    if (p.available) {
      for (const m of p.models) allModelNames.push(m.name);
    }
  }

  const ranked = getBestCodingModels(allModelNames);

  // Prefer a model that both benchmarked well and has a high coding score
  if (saved && ranked.some((m) => m.name === saved)) return saved;
  if (ranked.length > 0) return ranked[0].name;
  if (saved) return saved;
  if (allModelNames.length > 0) return allModelNames[0];
  return null;
}

// Default export as object matching the spec
export default {
  listModels,
  getStatus,
  selectModel,
  testModel,
  benchmarkModels,
  getBestModel,
};
