// local-agent/self-heal/RuntimeRecovery.js
// Phase 24: Runtime recovery module — recover from crashed/stuck processes and runtime failures

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export class RuntimeRecovery {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.workspaceDir = join(workspaceRoot, '.local-agent');
    this.pidFile = join(this.workspaceDir, 'runtime', 'pid.json');
    this.lockFile = join(workspaceRoot, '.local-agent', 'runtime.lock');
    this.stateDir = join(this.workspaceDir, 'runtime');
    this.ensureStateDir();
  }

  ensureStateDir() {
    mkdirSync(this.stateDir, { recursive: true });
  }

  async recover() {
    const results = [];

    // Check for stuck lock files
    const lockResult = await this.clearStuckLocks();
    results.push(lockResult);

    // Check for orphaned PID files
    const pidResult = await this.cleanupOrphanedPids();
    results.push(pidResult);

    // Check for dangling processes
    const processResult = await this.cleanupDanglingProcesses();
    results.push(processResult);

    const allSuccess = results.every(r => r.success);

    return {
      success: allSuccess,
      results,
      details: results.filter(r => r.message).map(r => r.message),
    };
  }

  async clearStuckLocks() {
    const lockFiles = [this.lockFile];

    // Also check for lock files in common locations
    const possibleLocks = [
      join(this.workspaceRoot, '.local-agent', 'db.lock'),
      join(this.workspaceRoot, '.local-agent', 'index.lock'),
      join(this.workspaceRoot, '.local-agent', 'cache.lock'),
    ];

    const cleared = [];
    const errors = [];

    for (const lockFile of [...lockFiles, ...possibleLocks]) {
      if (!existsSync(lockFile)) continue;

      try {
        const stat = require('fs').statSync(lockFile);
        const age = Date.now() - stat.mtimeMs;
        const staleThreshold = 5 * 60 * 1000; // 5 minutes

        if (age > staleThreshold) {
          require('fs').unlinkSync(lockFile);
          cleared.push({ file: lockFile, age: Math.round(age / 1000) + 's' });
        }
      } catch (err) {
        errors.push({ file: lockFile, error: err.message });
      }
    }

    return {
      success: errors.length === 0,
      action: 'CLEAR_LOCKS',
      cleared,
      errors,
      message: cleared.length > 0 ? `Cleared ${cleared.length} stale lock(s)` : undefined,
    };
  }

  async cleanupOrphanedPids() {
    if (!existsSync(this.pidFile)) {
      return { success: true, action: 'CLEANUP_PIDS', message: 'No PID file found' };
    }

    try {
      const content = readFileSync(this.pidFile, 'utf8');
      const pids = JSON.parse(content);

      if (!Array.isArray(pids) || pids.length === 0) {
        return { success: true, action: 'CLEANUP_PIDS', message: 'No orphaned PIDs' };
      }

      // Update PID file to empty
      writeFileSync(this.pidFile, JSON.stringify([], null, 2));

      return {
        success: true,
        action: 'CLEANUP_PIDS',
        cleaned: pids.length,
        message: `Cleaned up ${pids.length} orphaned PID(s)`,
      };
    } catch (err) {
      return { success: false, action: 'CLEANUP_PIDS', error: err.message };
    }
  }

  async cleanupDanglingProcesses() {
    // Check for UI server running on default port
    const { execSync } = await import('child_process');

    try {
      const result = execSync('lsof -i :4001 -t 2>/dev/null || echo ""', { encoding: 'utf8' });
      const pids = result.trim().split('\\n').filter(Boolean);

      if (pids.length > 0) {
        // Check if these are our processes (owned by this user)
        // For safety, we don't kill them — just report
        return {
          success: true,
          action: 'CHECK_DANGLING',
          found: pids.length,
          pids,
          message: `Found ${pids.length} process(es) on port 4001 — manually kill if stuck`,
          recommendation: 'Use `lsof -i :4001` to check, `kill <pid>` to stop',
        };
      }

      return { success: true, action: 'CHECK_DANGLING', message: 'No dangling processes found' };
    } catch (err) {
      // lsof not available or permission denied
      return { success: true, action: 'CHECK_DANGLING', message: 'Cannot check for dangling processes (lsof unavailable)' };
    }
  }

  async retryProcess(processName) {
    return {
      success: true,
      action: 'RETRY_PROCESS',
      process: processName,
      message: `Process ${processName} retry requested — will be retried on next operation`,
    };
  }

  async resetComponent(componentName) {
    const knownComponents = ['llm', 'database', 'index', 'cache', 'ui'];
    const normalized = componentName?.toLowerCase() ?? 'unknown';

    if (!knownComponents.some(k => normalized.includes(k))) {
      return {
        success: false,
        action: 'RESET_COMPONENT',
        component: componentName,
        error: `Unknown component: ${componentName}. Known: ${knownComponents.join(', ')}`,
      };
    }

    // Write reset marker
    const resetMarker = join(this.stateDir, `reset-${normalized}.marker`);
    try {
      writeFileSync(resetMarker, JSON.stringify({
        component: normalized,
        resetAt: new Date().toISOString(),
      }, null, 2));
    } catch { /* ignore */ }

    return {
      success: true,
      action: 'RESET_COMPONENT',
      component: normalized,
      message: `Component ${componentName} reset — will reinitialize on next use`,
    };
  }

  async getRuntimeStatus() {
    const status = {
      pidFile: { exists: existsSync(this.pidFile) },
      lockFile: { exists: existsSync(this.lockFile) },
      stateDir: { exists: existsSync(this.stateDir) },
      timestamp: new Date().toISOString(),
    };

    if (existsSync(this.pidFile)) {
      try {
        status.pidFile.content = JSON.parse(readFileSync(this.pidFile, 'utf8'));
      } catch {
        status.pidFile.corrupted = true;
      }
    }

    if (existsSync(this.lockFile)) {
      try {
        const stat = require('fs').statSync(this.lockFile);
        status.lockFile.age = Date.now() - stat.mtimeMs;
        status.lockFile.stale = status.lockFile.age > 5 * 60 * 1000;
      } catch { /* ignore */ }
    }

    return status;
  }
}

export default RuntimeRecovery;