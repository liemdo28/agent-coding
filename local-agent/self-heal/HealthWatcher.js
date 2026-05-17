// local-agent/self-heal/HealthWatcher.js
// Phase 24: Health watcher — monitors component health and detects failures

import { existsSync, readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { CacheRepair } from './CacheRepair.js';
import { IndexRepair } from './IndexRepair.js';
import { RuntimeRecovery } from './RuntimeRecovery.js';

export class HealthWatcher {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.workspaceDir = join(workspaceRoot, '.local-agent');
    this.cacheRepair = new CacheRepair(workspaceRoot);
    this.indexRepair = new IndexRepair(workspaceRoot);
    this.runtimeRecovery = new RuntimeRecovery(workspaceRoot);
  }

  async runHealthCheck() {
    const components = [];

    // Check workspace initialization
    const workspaceHealth = this.checkWorkspaceHealth();
    components.push(workspaceHealth);

    // Check index health
    const indexHealth = await this.checkIndexHealth();
    components.push(indexHealth);

    // Check cache health
    const cacheHealth = await this.checkCacheHealth();
    components.push(cacheHealth);

    // Check runtime health
    const runtimeHealth = await this.checkRuntimeHealth();
    components.push(runtimeHealth);

    // Check lock files
    const lockHealth = this.checkLockFiles();
    components.push(lockHealth);

    // Check database health (if SQLite)
    const dbHealth = this.checkDatabaseHealth();
    components.push(dbHealth);

    // Check LLM provider health
    const llmHealth = await this.checkLLMHealth();
    components.push(llmHealth);

    const healthyCount = components.filter(c => c.healthy === true).length;
    const unhealthyCount = components.filter(c => c.healthy === false).length;

    return {
      timestamp: new Date().toISOString(),
      workspace: this.workspaceRoot,
      components,
      summary: {
        total: components.length,
        healthy: healthyCount,
        unhealthy: unhealthyCount,
        overallHealthy: unhealthyCount === 0,
      },
    };
  }

  checkWorkspaceHealth() {
    const issues = [];

    if (!existsSync(this.workspaceRoot)) {
      return { name: 'workspace', healthy: false, issues: ['Workspace root does not exist'], failureType: 'MISSING' };
    }

    if (!existsSync(this.workspaceDir)) {
      return { name: 'workspace', healthy: false, issues: ['.local-agent directory missing'], failureType: 'MISSING' };
    }

    const essentialFiles = [
      join(this.workspaceDir, 'config.json'),
    ];

    for (const file of essentialFiles) {
      if (!existsSync(file)) {
        issues.push(`Missing: ${file.split('/').pop()}`);
      }
    }

    return {
      name: 'workspace',
      healthy: issues.length === 0,
      issues,
      failureType: issues.length > 0 ? 'MISSING' : null,
    };
  }

  async checkIndexHealth() {
    const issues = [];
    const indexFile = join(this.workspaceDir, 'project-map.json');

    if (!existsSync(indexFile)) {
      return {
        name: 'index',
        healthy: false,
        issues: ['Index file missing'],
        failureType: 'MISSING',
      };
    }

    try {
      const stat = statSync(indexFile);
      const content = readFileSync(indexFile, 'utf8');
      const data = JSON.parse(content);

      if (!data.files || !Array.isArray(data.files)) {
        issues.push('Invalid index structure');
      }

      if (!data.scannedAt) {
        issues.push('Missing scan timestamp');
      } else {
        const age = Date.now() - new Date(data.scannedAt).getTime();
        if (age > 7 * 24 * 60 * 60 * 1000) {
          issues.push(`Index is ${Math.round(age / (24 * 60 * 60 * 1000))} days old`);
        }
      }

      return {
        name: 'index',
        healthy: issues.length === 0,
        issues,
        failureType: issues.length > 0 ? 'STALE' : null,
        details: { fileCount: data.files?.length ?? 0 },
      };
    } catch (err) {
      return {
        name: 'index',
        healthy: false,
        issues: [`Corrupted: ${err.message}`],
        failureType: 'CORRUPTED',
      };
    }
  }

  async checkCacheHealth() {
    const issues = [];
    const cacheRoot = join(this.workspaceDir, 'cache');

    if (!existsSync(cacheRoot)) {
      // Cache not initialized yet — not a failure
      return { name: 'cache', healthy: true, issues: [], details: { initialized: false } };
    }

    try {
      const files = readdirSync(cacheRoot);
      let totalSize = 0;
      let zeroSizeFiles = 0;

      for (const file of files) {
        if (file === '.gitkeep') continue;
        try {
          const stat = statSync(join(cacheRoot, file));
          totalSize += stat.size;
          if (stat.size === 0) zeroSizeFiles++;
        } catch { /* ignore */ }
      }

      if (totalSize > 500 * 1024 * 1024) {
        issues.push(`Cache is large: ${Math.round(totalSize / 1024 / 1024)}MB`);
      }

      if (zeroSizeFiles > 0) {
        issues.push(`${zeroSizeFiles} corrupted (zero-size) cache file(s)`);
      }

      return {
        name: 'cache',
        healthy: issues.length === 0,
        issues,
        failureType: zeroSizeFiles > 0 ? 'CORRUPTED' : issues.length > 0 ? 'OVERFLOW' : null,
        details: { files: files.length, totalSize },
      };
    } catch (err) {
      return {
        name: 'cache',
        healthy: false,
        issues: [`Cannot read cache: ${err.message}`],
        failureType: 'UNKNOWN',
      };
    }
  }

  async checkRuntimeHealth() {
    const issues = [];
    const runtimeDir = join(this.workspaceDir, 'runtime');

    if (!existsSync(runtimeDir)) {
      return { name: 'runtime', healthy: true, issues: [], details: { initialized: false } };
    }

    // Check for stale lock files
    const lockFile = join(this.workspaceDir, 'runtime.lock');
    if (existsSync(lockFile)) {
      try {
        const stat = statSync(lockFile);
        const age = Date.now() - stat.mtimeMs;
        if (age > 5 * 60 * 1000) {
          issues.push(`Stale runtime lock (age: ${Math.round(age / 1000)}s)`);
        }
      } catch { /* ignore */ }
    }

    // Check for broken PID file
    const pidFile = join(this.workspaceDir, 'runtime', 'pid.json');
    if (existsSync(pidFile)) {
      try {
        const content = readFileSync(pidFile, 'utf8');
        JSON.parse(content);
      } catch (err) {
        issues.push(`Corrupted PID file: ${err.message}`);
      }
    }

    return {
      name: 'runtime',
      healthy: issues.length === 0,
      issues,
      failureType: issues.some(i => i.includes('Stale')) ? 'LOCKED' : null,
      details: { runtimeDir: existsSync(runtimeDir) },
    };
  }

  checkLockFiles() {
    const lockFiles = [
      join(this.workspaceDir, 'db.lock'),
      join(this.workspaceDir, 'index.lock'),
      join(this.workspaceDir, 'cache.lock'),
      join(this.workspaceDir, 'runtime.lock'),
    ];

    const staleLocks = [];
    const threshold = 5 * 60 * 1000; // 5 minutes

    for (const lockFile of lockFiles) {
      if (!existsSync(lockFile)) continue;

      try {
        const stat = statSync(lockFile);
        const age = Date.now() - stat.mtimeMs;
        if (age > threshold) {
          staleLocks.push({ file: lockFile.split('/').pop(), age: Math.round(age / 1000) + 's' });
        }
      } catch { /* ignore */ }
    }

    return {
      name: 'locks',
      healthy: staleLocks.length === 0,
      issues: staleLocks.map(l => `Stale: ${l.file} (${l.age})`),
      failureType: staleLocks.length > 0 ? 'LOCKED' : null,
      details: { staleCount: staleLocks.length },
    };
  }

  checkDatabaseHealth() {
    // Check for SQLite database
    const dbFile = join(this.workspaceDir, 'agent.db');
    const dbShmFile = join(this.workspaceDir, 'agent.db-shm');
    const dbWalFile = join(this.workspaceDir, 'agent.db-wal');

    const issues = [];

    if (!existsSync(dbFile)) {
      // DB not created yet — not a failure
      return { name: 'database', healthy: true, issues: [], details: { initialized: false } };
    }

    try {
      const stat = statSync(dbFile);
      if (stat.size === 0) {
        issues.push('Database file is empty');
      }

      // Check for orphaned WAL/SHM files (should not exist without active connection)
      if (existsSync(dbShmFile) && !existsSync(dbWalFile)) {
        issues.push('Orphaned SHM file');
      }

      return {
        name: 'database',
        healthy: issues.length === 0,
        issues,
        failureType: issues.length > 0 ? 'CORRUPTED' : null,
        details: { size: stat.size },
      };
    } catch (err) {
      return {
        name: 'database',
        healthy: false,
        issues: [`Cannot access database: ${err.message}`],
        failureType: 'UNKNOWN',
      };
    }
  }

  async checkLLMHealth() {
    // Check if LLM provider is accessible
    const configFile = join(this.workspaceDir, 'config.json');
    const issues = [];

    if (!existsSync(configFile)) {
      return { name: 'llm', healthy: false, issues: ['Config not found'], failureType: 'UNKNOWN' };
    }

    try {
      const content = readFileSync(configFile, 'utf8');
      const config = JSON.parse(content);

      if (!config.llm?.baseUrl) {
        issues.push('LLM base URL not configured');
      }

      return {
        name: 'llm',
        healthy: issues.length === 0,
        issues,
        failureType: issues.length > 0 ? 'UNCONFIGURED' : null,
        details: { configured: !!config.llm?.baseUrl },
      };
    } catch (err) {
      return {
        name: 'llm',
        healthy: false,
        issues: [`Cannot read config: ${err.message}`],
        failureType: 'UNKNOWN',
      };
    }
  }

  async getHealthSummary() {
    const report = await this.runHealthCheck();
    return {
      healthy: report.summary.overallHealthy,
      unhealthyComponents: report.components.filter(c => !c.healthy).map(c => c.name),
      totalComponents: report.summary.total,
      issuesCount: report.summary.unhealthy,
      timestamp: report.timestamp,
    };
  }
}

export default HealthWatcher;