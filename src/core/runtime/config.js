/**
 * config.js — Runtime configuration loader
 * Merges defaults with user overrides, enforces offline policy.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DEFAULTS = {
    maxWorkers: 8,
    offline: true,
    telemetry: false,

    pipeline: {
        maxConcurrent: 4,
        defaultTimeout: 60_000,
        retryAttempts: 2,
        phases: ['plan', 'execute', 'qa', 'validate'],
    },

    memory: {
        storageDir: join(homedir(), '.super-agent-ai', 'memory'),
        maxEntries: 10_000,
        compactionInterval: 300_000, // 5 min
    },

    intelligence: {
        parsers: ['readme', 'package-json', 'dependency-graph', 'architecture'],
    },

    semantic: {
        storageDir: join(homedir(), '.super-agent-ai', 'semantic'),
        embeddingModel: 'nomic-embed-text',
        chunkSize: 2048,
        topK: 10,
    },

    sandbox: {
        maxConcurrent: 10,
        defaultTimeout: 30_000,
        blockedPatterns: [
            'rm -rf /',
            'sudo ',
            'mkfs',
            'dd if=',
            'chmod -R 777 /',
        ],
    },

    selfHeal: {
        checkInterval: 30_000,
        maxRecoveryAttempts: 3,
        memoryThreshold: 0.85,
    },

    observability: {
        bufferSize: 1000,
        flushInterval: 5_000,
        storageDir: join(homedir(), '.super-agent-ai', 'telemetry'),
    },
};

/**
 * Load runtime config — merges defaults with workspace overrides.
 * @param {object} overrides - Direct overrides from constructor
 * @returns {object} merged config
 */
export function loadRuntimeConfig(overrides = {}) {
    let fileConfig = {};

    // Check workspace-level config
    const workspaceConfig = join(process.cwd(), '.super-agent-ai', 'runtime.json');
    if (existsSync(workspaceConfig)) {
        try {
            fileConfig = JSON.parse(readFileSync(workspaceConfig, 'utf8'));
        } catch {
            // Ignore parse errors, use defaults
        }
    }

    // Check user-level config
    const userConfig = join(homedir(), '.super-agent-ai', 'runtime.json');
    if (existsSync(userConfig)) {
        try {
            const user = JSON.parse(readFileSync(userConfig, 'utf8'));
            fileConfig = deepMerge(user, fileConfig);
        } catch {
            // Ignore
        }
    }

    const merged = deepMerge(DEFAULTS, deepMerge(fileConfig, overrides));

    // Enforce offline policy — cannot be overridden
    merged.offline = true;
    merged.telemetry = false;

    return merged;
}

function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (
            source[key] &&
            typeof source[key] === 'object' &&
            !Array.isArray(source[key]) &&
            target[key] &&
            typeof target[key] === 'object'
        ) {
            result[key] = deepMerge(target[key], source[key]);
        } else if (source[key] !== undefined) {
            result[key] = source[key];
        }
    }
    return result;
}
