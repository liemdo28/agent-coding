// self-heal/SelfHealManager.js — top-level coordinator for Phase 24 self-healing
import { HealthWatcher }   from './HealthWatcher.js';
import { buildRecoveryPlan } from './RecoveryPlanner.js';
import { clearCache, scanCache } from './CacheRepair.js';
import { repairIndex, verifyIndex } from './IndexRepair.js';
import { recoverRuntime, detectRuntimeIssues } from './RuntimeRecovery.js';

export class SelfHealManager {
  constructor(workspaceRoot, { watch = false, intervalMs = 60_000 } = {}) {
    this.root    = workspaceRoot;
    this.watcher = new HealthWatcher(workspaceRoot, { intervalMs });
    this._watch  = watch;
  }

  /** Start continuous health monitoring */
  startWatch(onUnhealthy) {
    this.watcher.on('unhealthy', (report) => {
      if (typeof onUnhealthy === 'function') onUnhealthy(report);
    });
    this.watcher.start();
    return this;
  }

  stopWatch() { this.watcher.stop(); }

  /** Return full health status + recovery plan */
  status() {
    const health = this.watcher.getHealth();
    const plan   = buildRecoveryPlan(this.root, health);
    return { health, plan };
  }

  /** Run repair-index */
  repairIndex({ dryRun = false } = {}) {
    return repairIndex(this.root, { dryRun });
  }

  /** Run clear-cache */
  clearCache({ dryRun = false } = {}) {
    return clearCache(this.root, { dryRun });
  }

  /** Run recover-runtime */
  recoverRuntime({ dryRun = false } = {}) {
    return recoverRuntime(this.root, { dryRun });
  }

  /** Run all auto-fixable recovery steps from the plan */
  autoHeal({ dryRun = false } = {}) {
    const { plan } = this.status();
    const results  = [];

    for (const step of plan.steps.filter((s) => s.auto)) {
      let result;
      if (step.action === 'repair-index')      result = this.repairIndex({ dryRun });
      else if (step.action === 'clear-cache')  result = this.clearCache({ dryRun });
      else if (step.action === 'recover-runtime') result = this.recoverRuntime({ dryRun });
      results.push({ step: step.action, type: step.type, result });
    }

    return { healed: results.length, results, dryRun };
  }
}
