/**
 * Phase 30: AI Civilization Core - Global Memory
 * Shared memory across ALL projects - fixes, learnings, patterns, reasoning, execution history
 */

import { readFile, writeFile, mkdir, access, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';

/**
 * @typedef {Object} GlobalMemoryEntry
 * @property {string} key
 * @property {any} value
 * @property {string} type
 * @property {string[]} tags
 * @property {string} sourceProject
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} accessCount
 * @property {number} successRate
 */

/**
 * @typedef {Object} SharedLearning
 * @property {string} id
 * @property {string} pattern
 * @property {string} solution
 * @property {number} occurrences
 * @property {number} successRate
 * @property {string[]} applicableContexts
 */

const DEFAULT_GLOBAL_DB_PATH = join(homedir(), '.local-agent', 'global-memory');

/** @type {Map<string, GlobalMemoryEntry>} */
const memoryCache = new Map();

/** @type {Map<string, number>} */
const accessCounts = new Map();

/**
 * Initialize global memory system
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Initialization result
 */
export async function initializeGlobalMemory(options = {}) {
    const dbPath = options.dbPath || DEFAULT_GLOBAL_DB_PATH;

    try {
        // Ensure directory exists
        await mkdir(dbPath, { recursive: true });

        // Initialize subdirectories
        await mkdir(join(dbPath, 'patterns'), { recursive: true });
        await mkdir(join(dbPath, 'fixes'), { recursive: true });
        await mkdir(join(dbPath, 'reasoning'), { recursive: true });
        await mkdir(join(dbPath, 'learnings'), { recursive: true });

        // Load existing memory into cache
        await loadMemoryCache(dbPath);

        return {
            success: true,
            dbPath,
            entriesLoaded: memoryCache.size,
            initializedAt: new Date().toISOString()
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Load memory cache from disk
 */
async function loadMemoryCache(dbPath) {
    try {
        const indexPath = join(dbPath, 'index.json');
        const indexContent = await readFile(indexPath, 'utf-8');
        const index = JSON.parse(indexContent);

        for (const key of Object.keys(index)) {
            try {
                const entryPath = join(dbPath, index[key].file);
                const content = await readFile(entryPath, 'utf-8');
                const entry = JSON.parse(content);
                memoryCache.set(key, entry);
                accessCounts.set(key, entry.accessCount || 0);
            } catch (e) {
                // Skip corrupted entries
            }
        }
    } catch (err) {
        // Index doesn't exist yet, start fresh
    }
}

/**
 * Save memory index to disk
 */
async function saveMemoryIndex(dbPath) {
    const index = {};
    for (const [key, entry] of memoryCache) {
        const fileName = `${key.replace(/[^a-z0-9]/gi, '_')}.json`;
        index[key] = { file: fileName };
    }
    await writeFile(join(dbPath, 'index.json'), JSON.stringify(index, null, 2));
}

/**
 * Get a value from global memory
 * @param {string} key - Memory key
 * @returns {Promise<any>} Memory value or null
 */
export async function getGlobalMemory(key) {
    const entry = memoryCache.get(key);

    if (entry) {
        // Update access count
        const count = (accessCounts.get(key) || 0) + 1;
        accessCounts.set(key, count);
        entry.accessCount = count;
        entry.lastAccessedAt = new Date().toISOString();

        return entry.value;
    }

    // Try to load from disk
    const dbPath = DEFAULT_GLOBAL_DB_PATH;
    try {
        const fileName = `${key.replace(/[^a-z0-9]/gi, '_')}.json`;
        const entryPath = join(dbPath, 'learnings', fileName);
        const content = await readFile(entryPath, 'utf-8');
        const entry = JSON.parse(content);

        memoryCache.set(key, entry);
        accessCounts.set(key, 1);

        return entry.value;
    } catch (err) {
        return null;
    }
}

/**
 * Store a value in global memory
 * @param {string} key - Memory key
 * @param {any} value - Value to store
 * @param {Object} options - Storage options
 * @returns {Promise<Object>} Storage result
 */
export async function storeGlobalMemory(key, value, options = {}) {
    const {
        type = 'general',
        tags = [],
        sourceProject = 'unknown',
        category = 'learnings'
    } = options;

    const entry = {
        key,
        value,
        type,
        tags,
        sourceProject,
        createdAt: memoryCache.get(key)?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accessCount: accessCounts.get(key) || 0,
        successRate: 1.0
    };

    memoryCache.set(key, entry);

    // Persist to disk
    try {
        const dbPath = DEFAULT_GLOBAL_DB_PATH;
        const fileName = `${key.replace(/[^a-z0-9]/gi, '_')}.json`;
        const entryPath = join(dbPath, category, fileName);

        await mkdir(dirname(entryPath), { recursive: true });
        await writeFile(entryPath, JSON.stringify(entry, null, 2));
        await saveMemoryIndex(dbPath);

        return { success: true, key, category, storedAt: entry.updatedAt };
    } catch (err) {
        return { success: false, error: err.message, key };
    }
}

/**
 * Store a fix pattern in global memory
 * @param {string} pattern - Error/issue pattern
 * @param {string} solution - Successful fix
 * @param {Object} context - Context information
 * @returns {Promise<Object>} Storage result
 */
export async function storeFix(pattern, solution, context = {}) {
    const key = `fix:${pattern}`;
    const entry = {
        pattern,
        solution,
        context: {
            ...context,
            sourceProject: context.project || 'unknown',
            fileType: context.fileType || 'unknown',
            language: context.language || 'unknown'
        },
        createdAt: new Date().toISOString(),
        occurrences: 1,
        successRate: 1.0,
        tags: ['fix', context.language || 'general']
    };

    memoryCache.set(key, entry);

    try {
        const dbPath = DEFAULT_GLOBAL_DB_PATH;
        const fileName = `fix_${pattern.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.json`;
        const entryPath = join(dbPath, 'fixes', fileName);

        await writeFile(entryPath, JSON.stringify(entry, null, 2));

        return { success: true, pattern: pattern.substring(0, 100), storedAt: entry.createdAt };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Store a learning pattern in global memory
 * @param {string} pattern - What was learned
 * @param {string} insight - The insight gained
 * @param {Object} context - Learning context
 * @returns {Promise<Object>} Storage result
 */
export async function storeLearning(pattern, insight, context = {}) {
    const key = `learning:${pattern}`;
    const entry = {
        pattern,
        insight,
        context: {
            ...context,
            sourceProject: context.project || 'unknown',
            domain: context.domain || 'general'
        },
        createdAt: new Date().toISOString(),
        accessCount: 0,
        successRate: 1.0,
        tags: ['learning', context.domain || 'general']
    };

    memoryCache.set(key, entry);

    try {
        const dbPath = DEFAULT_GLOBAL_DB_PATH;
        const fileName = `learning_${pattern.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.json`;
        const entryPath = join(dbPath, 'learnings', fileName);

        await writeFile(entryPath, JSON.stringify(entry, null, 2));

        return { success: true, pattern: pattern.substring(0, 100), storedAt: entry.createdAt };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Store reasoning in global memory
 * @param {string} problem - The problem being solved
 * @param {string} reasoning - The AI reasoning
 * @param {string} outcome - The outcome (success/failure)
 * @param {Object} context - Context information
 * @returns {Promise<Object>} Storage result
 */
export async function storeReasoning(problem, reasoning, outcome, context = {}) {
    const key = `reasoning:${problem.substring(0, 50)}`;
    const entry = {
        problem: problem.substring(0, 500),
        reasoning,
        outcome,
        context,
        createdAt: new Date().toISOString(),
        successRate: outcome === 'success' ? 1.0 : 0.0,
        tags: ['reasoning', context.type || 'general']
    };

    memoryCache.set(key, entry);

    try {
        const dbPath = DEFAULT_GLOBAL_DB_PATH;
        const fileName = `reasoning_${problem.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.json`;
        const entryPath = join(dbPath, 'reasoning', fileName);

        await writeFile(entryPath, JSON.stringify(entry, null, 2));

        return { success: true, problem: problem.substring(0, 100), storedAt: entry.createdAt };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Sync memory between two projects
 * @param {string} projectA - First project path
 * @param {string} projectB - Second project path
 * @param {Object} options - Sync options
 * @returns {Promise<Object>} Sync result
 */
export async function syncMemory(projectA, projectB, options = {}) {
    const { bidirectional = true, categories = ['fixes', 'learnings', 'patterns'] } = options;

    const results = {
        projectA,
        projectB,
        syncedEntries: [],
        conflicts: [],
        timestamp: new Date().toISOString()
    };

    try {
        // Scan project A's memory
        const projectAMemory = await scanProjectMemory(projectA);

        // Scan project B's memory
        const projectBMemory = await scanProjectMemory(projectB);

        // Find common patterns
        for (const entry of projectAMemory) {
            const matchingEntry = projectBMemory.find(
                b => b.pattern === entry.pattern || b.key === entry.key
            );

            if (matchingEntry) {
                // Conflict or merge needed
                if (matchingEntry.successRate !== entry.successRate) {
                    results.conflicts.push({
                        entryA: entry,
                        entryB: matchingEntry,
                        resolution: entry.successRate > matchingEntry.successRate ? 'keep_a' : 'keep_b'
                    });
                }
            } else {
                // New entry for project B
                results.syncedEntries.push(entry);
            }
        }

        // Bidirectional sync
        if (bidirectional) {
            for (const entry of projectBMemory) {
                const matchingEntry = projectAMemory.find(
                    a => a.pattern === entry.pattern || a.key === entry.key
                );

                if (!matchingEntry) {
                    results.syncedEntries.push(entry);
                }
            }
        }

        // Store synced entries
        for (const entry of results.syncedEntries) {
            await storeGlobalMemory(entry.key || entry.pattern, entry.value || entry, {
                type: entry.type,
                tags: [...(entry.tags || []), 'synced'],
                sourceProject: entry.sourceProject
            });
        }

        return {
            success: true,
            ...results,
            totalSynced: results.syncedEntries.length,
            totalConflicts: results.conflicts.length
        };
    } catch (err) {
        return { success: false, error: err.message, ...results };
    }
}

/**
 * Scan project memory
 */
async function scanProjectMemory(projectPath) {
    const memory = [];
    const memoryPath = join(projectPath, '.local-agent', 'memory');

    try {
        const files = await readdir(memoryPath);

        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const content = await readFile(join(memoryPath, file), 'utf-8');
                    memory.push(JSON.parse(content));
                } catch (e) {
                    // Skip invalid files
                }
            }
        }
    } catch (err) {
        // No memory directory
    }

    return memory;
}

/**
 * Get shared learnings from global memory
 * @param {Object} options - Query options
 * @returns {Promise<SharedLearning[]>} Shared learnings
 */
export async function getSharedLearnings(options = {}) {
    const { category = 'learnings', limit = 50, minSuccessRate = 0.7 } = options;

    const learnings = [];
    const dbPath = DEFAULT_GLOBAL_DB_PATH;

    try {
        const categoryPath = join(dbPath, category);
        const files = await readdir(categoryPath);

        for (const file of files.slice(0, limit)) {
            if (file.endsWith('.json')) {
                try {
                    const content = await readFile(join(categoryPath, file), 'utf-8');
                    const entry = JSON.parse(content);

                    if (!minSuccessRate || entry.successRate >= minSuccessRate) {
                        learnings.push({
                            id: file.replace('.json', ''),
                            pattern: entry.pattern || entry.key,
                            solution: entry.solution || entry.insight || entry.reasoning,
                            occurrences: entry.occurrences || entry.accessCount || 0,
                            successRate: entry.successRate || 0,
                            applicableContexts: entry.tags || [],
                            sourceProjects: entry.sourceProject || 'unknown',
                            createdAt: entry.createdAt
                        });
                    }
                } catch (e) {
                    // Skip invalid entries
                }
            }
        }
    } catch (err) {
        // Category doesn't exist
    }

    // Sort by success rate and occurrences
    return learnings.sort((a, b) => {
        const scoreA = a.successRate * a.occurrences;
        const scoreB = b.successRate * b.occurrences;
        return scoreB - scoreA;
    });
}

/**
 * Search global memory
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object[]>} Search results
 */
export async function searchGlobalMemory(query, options = {}) {
    const { category, limit = 20 } = options;
    const results = [];
    const lowerQuery = query.toLowerCase();

    // Search in cache
    for (const [key, entry] of memoryCache) {
        if (key.toLowerCase().includes(lowerQuery) ||
            JSON.stringify(entry.value).toLowerCase().includes(lowerQuery) ||
            (entry.tags && entry.tags.some(t => t.toLowerCase().includes(lowerQuery)))) {

            results.push({
                key,
                entry,
                relevance: calculateRelevance(key, entry, lowerQuery)
            });
        }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    return results.slice(0, limit);
}

/**
 * Calculate relevance score
 */
function calculateRelevance(key, entry, query) {
    let score = 0;

    if (key.toLowerCase().includes(query)) score += 10;
    if (entry.tags && entry.tags.some(t => t.toLowerCase().includes(query))) score += 5;
    if (entry.successRate >= 0.8) score += 3;
    if (entry.accessCount > 10) score += 2;

    return score;
}

/**
 * Get memory statistics
 * @returns {Promise<Object>} Memory statistics
 */
export async function getGlobalMemoryStats() {
    const stats = {
        totalEntries: memoryCache.size,
        byCategory: {
            fixes: 0,
            learnings: 0,
            patterns: 0,
            reasoning: 0
        },
        topAccessed: [],
        highestSuccessRate: []
    };

    // Count by category
    for (const [key, entry] of memoryCache) {
        if (key.startsWith('fix:')) stats.byCategory.fixes++;
        else if (key.startsWith('learning:')) stats.byCategory.learnings++;
        else if (key.startsWith('pattern:')) stats.byCategory.patterns++;
        else if (key.startsWith('reasoning:')) stats.byCategory.reasoning++;
    }

    // Top accessed entries
    const sortedByAccess = [...memoryCache.entries()]
        .sort((a, b) => (b[1].accessCount || 0) - (a[1].accessCount || 0))
        .slice(0, 10);

    stats.topAccessed = sortedByAccess.map(([key, entry]) => ({
        key,
        accessCount: entry.accessCount || 0,
        successRate: entry.successRate || 0
    }));

    // Highest success rate entries
    const sortedBySuccess = [...memoryCache.entries()]
        .filter(([_, entry]) => entry.successRate >= 0.7)
        .sort((a, b) => (b[1].successRate || 0) - (a[1].successRate || 0))
        .slice(0, 10);

    stats.highestSuccessRate = sortedBySuccess.map(([key, entry]) => ({
        key,
        successRate: entry.successRate || 0,
        accessCount: entry.accessCount || 0
    }));

    return stats;
}

/**
 * Clean up old/infrequent entries
 * @param {Object} options - Cleanup options
 * @returns {Promise<Object>} Cleanup result
 */
export async function cleanupGlobalMemory(options = {}) {
    const { maxAge = 90, minAccessCount = 1, dryRun = false } = options;

    const toDelete = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

    for (const [key, entry] of memoryCache) {
        const createdAt = new Date(entry.createdAt);
        const accessCount = entry.accessCount || 0;

        if (createdAt < cutoffDate && accessCount < minAccessCount) {
            toDelete.push(key);
        }
    }

    if (!dryRun) {
        for (const key of toDelete) {
            memoryCache.delete(key);
        }

        const dbPath = DEFAULT_GLOBAL_DB_PATH;
        await saveMemoryIndex(dbPath);
    }

    return {
        deleted: toDelete.length,
        dryRun,
        keysDeleted: toDelete
    };
}

export default {
    initializeGlobalMemory,
    getGlobalMemory,
    storeGlobalMemory,
    storeFix,
    storeLearning,
    storeReasoning,
    syncMemory,
    getSharedLearnings,
    searchGlobalMemory,
    getGlobalMemoryStats,
    cleanupGlobalMemory
};