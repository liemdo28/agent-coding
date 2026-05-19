/**
 * ModelRouter — deterministic offline model routing for local Ollama.
 *
 * Routes tasks to appropriate local models based on task profile, language,
 * and hardware constraints. Reads from a bundled manifest (no network calls).
 *
 * Usage:
 *   import { ModelRouter } from '../llm/ModelRouter.js';
 *   const router = new ModelRouter();
 *   const candidate = router.route({ taskType: 'code-gen', language: 'python' });
 *   console.log(candidate.model); // e.g., 'qwen2.5-coder:7b'
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');
const DEFAULT_MANIFEST = join(ROOT, 'data', 'model-manifest.json');

/**
 * Task profile types recognized by the router.
 * @typedef {'code-gen' | 'code-review' | 'ast-query' | 'refactor' | 'test-gen'} TaskType
 */

/**
 * @typedef {Object} TaskProfile
 * @property {TaskType} taskType
 * @property {string} [language]
 * @property {'low' | 'medium' | 'high'} [complexity]
 * @property {number} [maxDuration] — seconds
 */

/**
 * @typedef {Object} ModelCandidate
 * @property {string} model — model name (e.g., 'qwen2.5-coder:7b')
 * @property {string} reason — human-readable explanation of the routing decision
 * @property {string[]} fallback — ordered fallback model names
 * @property {number} score — routing score
 */

/**
 * @typedef {Object} ModelInfo
 * @property {string[]} languages
 * @property {number} contextLength
 * @property {number} speed — 0-1, higher = faster
 * @property {number} quality — 0-1, higher = better quality
 * @property {string} domain — primary domain (e.g., 'code-generation')
 * @property {number} vramMB
 * @property {number} ramMB
 */

export class ModelRouter {
  /**
   * @param {string} [manifestPath] — path to model manifest JSON
   */
  constructor(manifestPath = DEFAULT_MANIFEST) {
    this.manifestPath = manifestPath;
    this._manifest = null;
    this._cache = null;
  }

  /** Lazily load and cache the manifest. */
  _loadManifest() {
    if (this._manifest) return this._manifest;

    if (!existsSync(this.manifestPath)) {
      // Return minimal inline manifest for environments without manifest file
      this._manifest = this._getDefaultManifest();
    } else {
      try {
        this._manifest = JSON.parse(readFileSync(this.manifestPath, 'utf-8'));
      } catch (err) {
        console.warn(`[ModelRouter] Failed to parse manifest: ${err.message}. Using defaults.`);
        this._manifest = this._getDefaultManifest();
      }
    }
    return this._manifest;
  }

  /** Inline default manifest so router works even without data/model-manifest.json */
  _getDefaultManifest() {
    return {
      models: {
        'qwen2.5-coder:7b': {
          languages: ['python', 'javascript', 'typescript', 'go', 'rust', 'java'],
          contextLength: 8192,
          speed: 0.85,
          quality: 0.82,
          domain: 'code-generation',
          vramMB: 4800,
          ramMB: 2000,
        },
        'codellama:13b': {
          languages: ['python', 'javascript', 'go', 'rust', 'c', 'cpp'],
          contextLength: 16384,
          speed: 0.65,
          quality: 0.88,
          domain: 'code-analysis',
          vramMB: 7800,
          ramMB: 3000,
        },
        'qwen2.5-coder:1.5b': {
          languages: ['python', 'javascript', 'typescript'],
          contextLength: 8192,
          speed: 0.95,
          quality: 0.70,
          domain: 'code-generation',
          vramMB: 1600,
          ramMB: 1000,
        },
      },
      profiles: {
        'code-gen': { weights: { speed: 0.4, quality: 0.3, domain_match: 0.3 } },
        'code-review': { weights: { speed: 0.1, quality: 0.6, domain_match: 0.3 } },
        'ast-query': { weights: { speed: 0.6, quality: 0.2, domain_match: 0.2 } },
        'refactor': { weights: { speed: 0.1, quality: 0.7, domain_match: 0.2 } },
        'test-gen': { weights: { speed: 0.3, quality: 0.4, domain_match: 0.3 } },
      },
      fallbackChain: {
        'qwen2.5-coder:7b': ['qwen2.5-coder:1.5b', 'codellama:7b'],
        'codellama:13b': ['codellama:7b', 'qwen2.5-coder:7b'],
        '*': ['qwen2.5-coder:7b', 'codellama:13b'],
      },
    };
  }

  /**
   * Route a task to the best available model.
   * @param {TaskProfile} profile
   * @returns {ModelCandidate}
   */
  route(profile) {
    const manifest = this._loadManifest();
    const { taskType = 'code-gen', language } = profile;

    const profileConfig = manifest.profiles[taskType] || manifest.profiles['code-gen'];
    const weights = profileConfig.weights;

    /** @type {Array<{model: string, score: number, info: ModelInfo}>} */
    const candidates = [];

    for (const [modelName, modelInfo] of Object.entries(manifest.models)) {
      // Filter: skip models that don't support the target language
      if (language && modelInfo.languages && !modelInfo.languages.includes(language)) {
        continue;
      }

      // Score components
      const speedScore = modelInfo.speed || 0.5;
      const qualityScore = modelInfo.quality || 0.5;
      const domainMatch = this._domainScore(modelName, taskType);

      const score =
        (weights.speed * speedScore) +
        (weights.quality * qualityScore) +
        (weights.domain_match * domainMatch);

      candidates.push({ model: modelName, score, info: modelInfo });
    }

    if (candidates.length === 0) {
      // Fallback: return any available model
      const anyModel = Object.keys(manifest.models)[0];
      return {
        model: anyModel,
        reason: `No model supports language '${language}' — using default.`,
        fallback: this._getFallback(anyModel, manifest),
        score: 0,
      };
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    return {
      model: best.model,
      reason: this._explainRoute(taskType, language, best),
      fallback: this._getFallback(best.model, manifest),
      score: Math.round(best.score * 100) / 100,
    };
  }

  /**
   * Check if Ollama is reachable and a specific model is available.
   * Returns false if model not found or Ollama not running.
   * @param {string} model
   * @returns {Promise<boolean>}
   */
  async isAvailable(model) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) return false;

      const data = await response.json();
      const available = (data.models || []).map((m) => m.name);
      return available.includes(model);
    } catch {
      return false;
    }
  }

  /**
   * List all models currently available in Ollama.
   * @returns {Promise<string[]>}
   */
  async listAvailable() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) return [];
      const data = await response.json();
      return (data.models || []).map((m) => m.name);
    } catch {
      return [];
    }
  }

  /**
   * Route with availability check — returns the first available model from
   * the scored candidate list. Falls back to wildcard chain if no candidates.
   * @param {TaskProfile} profile
   * @returns {Promise<ModelCandidate>}
   */
  async routeAvailable(profile) {
    const manifest = this._loadManifest();
    const { taskType = 'code-gen', language } = profile;
    const profileConfig = manifest.profiles[taskType] || manifest.profiles['code-gen'];
    const weights = profileConfig.weights;

    const candidates = [];

    for (const [modelName, modelInfo] of Object.entries(manifest.models)) {
      if (language && modelInfo.languages && !modelInfo.languages.includes(language)) {
        continue;
      }

      const speedScore = modelInfo.speed || 0.5;
      const qualityScore = modelInfo.quality || 0.5;
      const domainMatch = this._domainScore(modelName, taskType);

      const score =
        (weights.speed * speedScore) +
        (weights.quality * qualityScore) +
        (weights.domain_match * domainMatch);

      candidates.push({ model: modelName, score, info: modelInfo });
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Try each candidate in order; return first available
    for (const candidate of candidates) {
      if (await this.isAvailable(candidate.model)) {
        return {
          model: candidate.model,
          reason: this._explainRoute(taskType, language, candidate),
          fallback: this._getFallback(candidate.model, manifest),
          score: Math.round(candidate.score * 100) / 100,
        };
      }
    }

    // None available — use the highest-scored anyway (caller must handle Ollama not running)
    const best = candidates[0];
    const anyModel = best ? best.model : Object.keys(manifest.models)[0];
    return {
      model: anyModel,
      reason: 'No scored candidates are available in Ollama — returning highest-scored.',
      fallback: this._getFallback(anyModel, manifest),
      score: best ? Math.round(best.score * 100) / 100 : 0,
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  _domainScore(modelName, taskType) {
    const domainMap = {
      'code-gen': 'code-generation',
      'code-review': 'code-analysis',
      'ast-query': 'code-generation',
      'refactor': 'code-analysis',
      'test-gen': 'code-generation',
    };
    const expectedDomain = domainMap[taskType] || 'code-generation';
    const lower = modelName.toLowerCase();
    if (lower.includes('coder')) return taskType === 'code-gen' || taskType === 'ast-query' || taskType === 'test-gen' ? 1.0 : 0.6;
    if (lower.includes('llama') || lower.includes('codellama')) return taskType === 'code-review' || taskType === 'refactor' ? 1.0 : 0.6;
    return 0.5;
  }

  _explainRoute(taskType, language, candidate) {
    let reason = `Selected '${candidate.model}' for task '${taskType}'`;
    if (language) reason += ` (language: ${language})`;
    reason += ` with score ${candidate.score.toFixed(2)}.`;
    return reason;
  }

  _getFallback(model, manifest) {
    const chain = manifest.fallbackChain || {};
    if (chain[model]) return chain[model];
    if (chain['*']) return chain['*'];
    return Object.keys(manifest.models).filter((m) => m !== model);
  }
}

export default ModelRouter;