// training/localFineTuneManager.js — manages local fine-tuning via Ollama (Modelfiles)
// Phase 17: creates Modelfiles, builds models, lists/deletes custom models. localhost only.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import http from 'http';

const MODELFILES_DIR = join(homedir(), '.local-agent', 'modelfiles');
const OLLAMA_BASE    = 'http://localhost:11434';

/**
 * Generate an Ollama Modelfile content string.
 * @param {string} baseModel  e.g. 'llama3.2'
 * @param {object[]} trainingData  array of { instruction, input, output }
 * @param {{ systemPrompt?: string, temperature?: number }} options
 * @returns {string}
 */
export function createModelfile(baseModel, trainingData, options = {}) {
  const systemPrompt = options.systemPrompt
    ?? 'You are an expert software engineering AI that helps fix bugs and improve code quality.';
  const temperature  = options.temperature ?? 0.2;

  const exampleSection = trainingData
    .slice(0, 20) // Modelfiles have size limits
    .map(ex => [
      'TEMPLATE """',
      `<|im_start|>user\n${ex.instruction}\n\n${ex.input}<|im_end|>`,
      `<|im_start|>assistant\n${ex.output}<|im_end|>`,
      '"""',
    ].join('\n'))
    .join('\n\n');

  return [
    `FROM ${baseModel}`,
    `PARAMETER temperature ${temperature}`,
    `SYSTEM """${systemPrompt}"""`,
    '',
    exampleSection,
  ].join('\n');
}

/**
 * Build a custom Ollama model from a Modelfile.
 * @param {string} name  custom model name
 * @param {string} modelfileContent
 * @param {{ dryRun?: boolean }} options
 * @returns {{ success: boolean, modelName: string, error?: string }}
 */
export function buildCustomModel(name, modelfileContent, options = {}) {
  if (!existsSync(MODELFILES_DIR)) mkdirSync(MODELFILES_DIR, { recursive: true });

  const modelfilePath = join(MODELFILES_DIR, `${name}.Modelfile`);
  writeFileSync(modelfilePath, modelfileContent, 'utf8');

  if (options.dryRun) {
    return { success: true, modelName: name, dryRun: true, modelfilePath };
  }

  try {
    execSync(`ollama create ${name} -f "${modelfilePath}"`, {
      stdio: 'pipe',
      timeout: 300_000, // 5 min
      env: { ...process.env },
    });
    return { success: true, modelName: name, modelfilePath };
  } catch (err) {
    return { success: false, modelName: name, error: err.message.slice(0, 300) };
  }
}

/**
 * List custom Ollama models.
 * @returns {Promise<object[]>}
 */
export async function listCustomModels() {
  try {
    const data = await ollamaGet('/api/tags');
    return (data?.models ?? []).filter(m => m.name && !m.name.startsWith('library/'));
  } catch {
    return [];
  }
}

/**
 * Delete a custom Ollama model.
 * @param {string} name
 * @returns {{ success: boolean }}
 */
export function deleteCustomModel(name) {
  try {
    execSync(`ollama rm ${name}`, { stdio: 'pipe', timeout: 30_000 });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function ollamaGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`${OLLAMA_BASE}${path}`, (res) => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on('error', reject).setTimeout(5000);
  });
}
