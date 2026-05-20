/**
 * Global Memory Manager
 * Stores and searches semantic memory, prompts, tasks, and fixes under ~/.super-agent-ai/memory/
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const MEMORY_DIR = '/Users/liemdo/.super-agent-ai/memory';
const MEMORY_FILE = join(MEMORY_DIR, 'global-memory.json');

export class GlobalMemoryManager {
  constructor() {
    this.memory = {
      version: '1.0.0',
      semantic: {}, // key -> value
      tasks: [],    // Array of { taskId, task, status, timestamp }
      prompts: [],  // Array of { prompt, response, timestamp }
      fixes: [],    // Array of { patchId, task, filesChanged, status, timestamp }
    };
    this._load();
  }

  _load() {
    if (existsSync(MEMORY_FILE)) {
      try {
        const raw = readFileSync(MEMORY_FILE, 'utf8');
        const data = JSON.parse(raw);
        this.memory = { ...this.memory, ...data };
      } catch (err) {
        console.error('[GlobalMemoryManager] Failed to load memory:', err.message);
      }
    }
  }

  _save() {
    try {
      if (!existsSync(MEMORY_DIR)) {
        mkdirSync(MEMORY_DIR, { recursive: true });
      }
      writeFileSync(MEMORY_FILE, JSON.stringify(this.memory, null, 2), 'utf8');
    } catch (err) {
      console.error('[GlobalMemoryManager] Failed to save memory:', err.message);
    }
  }

  // Semantic Memory K/V store
  storeSemantic(key, value) {
    this.memory.semantic[key] = value;
    this._save();
  }

  getSemantic(key) {
    return this.memory.semantic[key] || null;
  }

  searchSemantic(query) {
    const q = query.toLowerCase();
    const results = [];
    for (const [k, v] of Object.entries(this.memory.semantic)) {
      if (k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q)) {
        results.push({ key: k, value: v });
      }
    }
    return results;
  }

  // Task Memory
  logTask(task, status = 'success') {
    this.memory.tasks.push({
      taskId: 'task-' + Math.random().toString(36).substring(2, 9),
      task,
      status,
      timestamp: new Date().toISOString(),
    });
    // Limit to last 500 items
    if (this.memory.tasks.length > 500) this.memory.tasks.shift();
    this._save();
  }

  // Prompt History
  logPrompt(prompt, response) {
    this.memory.prompts.push({
      prompt,
      response,
      timestamp: new Date().toISOString(),
    });
    if (this.memory.prompts.length > 500) this.memory.prompts.shift();
    this._save();
  }

  // Fixes History
  logFix(patchId, task, filesChanged, status = 'proposed') {
    this.memory.fixes.push({
      patchId,
      task,
      filesChanged,
      status,
      timestamp: new Date().toISOString(),
    });
    if (this.memory.fixes.length > 500) this.memory.fixes.shift();
    this._save();
  }

  getStats() {
    return {
      semanticCount: Object.keys(this.memory.semantic).length,
      taskCount: this.memory.tasks.length,
      promptCount: this.memory.prompts.length,
      fixCount: this.memory.fixes.length,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const globalMemory = new GlobalMemoryManager();
export default globalMemory;
