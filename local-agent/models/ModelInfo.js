// models/ModelInfo.js - pure data module for local model metadata; no network calls

const MODEL_DB = {
  'qwen2.5-coder:7b':    { contextWindow: 32768,  ramEstimateGB: 6,  codingScore: 9, speciality: 'code' },
  'qwen2.5-coder:14b':   { contextWindow: 32768,  ramEstimateGB: 12, codingScore: 9, speciality: 'code' },
  'qwen2.5-coder:32b':   { contextWindow: 32768,  ramEstimateGB: 24, codingScore: 9, speciality: 'code' },
  'codellama:7b':        { contextWindow: 16384,  ramEstimateGB: 6,  codingScore: 8, speciality: 'code' },
  'codellama:13b':       { contextWindow: 16384,  ramEstimateGB: 10, codingScore: 8, speciality: 'code' },
  'deepseek-coder:6.7b': { contextWindow: 16384,  ramEstimateGB: 6,  codingScore: 8, speciality: 'code' },
  'deepseek-coder:33b':  { contextWindow: 16384,  ramEstimateGB: 24, codingScore: 9, speciality: 'code' },
  'llama3.2:3b':         { contextWindow: 8192,   ramEstimateGB: 3,  codingScore: 6, speciality: 'general' },
  'llama3.1:8b':         { contextWindow: 131072, ramEstimateGB: 7,  codingScore: 7, speciality: 'general' },
  'mistral:7b':          { contextWindow: 32768,  ramEstimateGB: 6,  codingScore: 6, speciality: 'general' },
  'phi3.5:3.8b':         { contextWindow: 128000, ramEstimateGB: 3,  codingScore: 7, speciality: 'general' },
  'gemma2:9b':           { contextWindow: 8192,   ramEstimateGB: 8,  codingScore: 6, speciality: 'general' },
};

const DEFAULT_INFO = {
  contextWindow: 4096,
  ramEstimateGB: 8,
  codingScore: 5,
  speciality: 'unknown',
};

/**
 * Return metadata for a named model. Unknown models get sensible defaults.
 *
 * @param {string} modelName
 * @returns {{ contextWindow: number, ramEstimateGB: number, speciality: string, codingScore: number, recommended: boolean }}
 */
export function getModelInfo(modelName) {
  // Normalize: strip trailing whitespace, lowercase for lookup
  const key = (modelName ?? '').trim();
  const info = MODEL_DB[key] ?? MODEL_DB[key.toLowerCase()] ?? null;

  if (info) {
    return {
      ...info,
      recommended: info.codingScore >= 8 && info.speciality === 'code',
    };
  }

  // Try prefix matching for models with extra tags (e.g. "qwen2.5-coder:7b-instruct-q4_K_M")
  for (const [dbKey, dbInfo] of Object.entries(MODEL_DB)) {
    if (key.toLowerCase().startsWith(dbKey.toLowerCase())) {
      return {
        ...dbInfo,
        recommended: dbInfo.codingScore >= 8 && dbInfo.speciality === 'code',
      };
    }
  }

  return {
    ...DEFAULT_INFO,
    recommended: false,
  };
}

/**
 * Filter and rank available models by coding suitability.
 *
 * @param {string[]} availableModelNames
 * @returns {Array<{ name: string, rank: number } & ReturnType<typeof getModelInfo>>}
 */
export function getBestCodingModels(availableModelNames) {
  return availableModelNames
    .map((name) => ({ name, ...getModelInfo(name) }))
    .filter((m) => m.codingScore >= 7)
    .sort((a, b) => b.codingScore - a.codingScore)
    .map((m, i) => ({ ...m, rank: i + 1 }));
}

/**
 * Return a human-readable RAM estimate string for a model.
 *
 * @param {string} modelName
 * @returns {string} e.g. "~6 GB"
 */
export function estimateRAMForModel(modelName) {
  const info = getModelInfo(modelName);
  return `~${info.ramEstimateGB} GB`;
}
