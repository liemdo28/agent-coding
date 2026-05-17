// local-agent/self-heal/SelfHealManager.js
// Phase 24: Local Self-Healing Engine — Core Manager

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { HealthWatcher } from './HealthWatcher.js';
import { RecoveryPlanner } from './RecoveryPlanner.js';
import { CacheRepair } from './CacheRepair.js';
import { IndexRepair } from './IndexRepair.js';
import { RuntimeRecovery } from './RuntimeRecovery.js';

export class SelfHealManager {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.healDir = join(workspaceRoot, '.local-agent', 'heal');
    this.logDir = join(this.healDir, 'logs');
    this.stateFile = join(this.healDir, 'heal-state.json');
    this.ensureDirs();
    this.healthWatcher = new HealthWatcher(workspaceRoot);
    this.recoveryPlanner = new RecoveryPlanner();
    this.cacheRepair = new CacheRepair(workspaceRoot);
    this.indexRepair = new IndexRepair(workspaceRoot);
    this.runtimeRecovery = new RuntimeRecovery(workspaceRoot);
    this.state = this.loadState();
  }

  ensureDirs() {
    mkdirSync(this.healDir, { recursive: true });
    mkdirSync(this.logDir, { recursive: true });
  }

  loadState() {
    if (existsSync(this.stateFile)) {
      try { return JSON.parse(readFileSync(this.stateFile, 'utf8')); } catch { /* ignore */ }
    }
    return { lastHeal: null, recoveryCount: 0, recoveryHistory: [], unhealthyComponents: [] };
  }

  saveState() {
    try { writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2)); } catch { /* ignore */ }
  }

  async checkHealth() {
    const healthReport = await this.healthWatcher.runHealthCheck();
    this.state.lastHeal = new Date().toISOString();
    this.saveState();
    return healthReport;
  }

  async getStatus() {
    const healthReport = await this.healthWatcher.runHealthCheck();
    return {
      lastHeal: this.state.lastHeal,
      recoveryCount: this.state.recoveryCount,
      unhealthyComponents: healthReport.components.filter(c => c.healthy === false).map(c => c.name),
      healthReport,
    };
  }

  async heal(flags = {}) {
    const healthReport = await this.checkHealth();
    const planner = this.recoveryPlanner;
    const results = [];

    const components = healthReport.components.filter(c => c.healthy === false);

    for (const component of components) {
      const actions = planner.planRecovery(component, flags);

      for (const action of actions) {
        if (action.risk === 'HIGH' && !flags.forceHighRisk) {
          results.push({ component: component.name, action: action.type, status: 'SKIPPED', reason: 'HIGH RISK — requires --force flag' });
          continue;
        }

        try {
          let result;
          switch (action.type) {
            case 'CLEAR_CACHE':
              result = await this.cacheRepair.clearCache();
              break;
            case 'REPAIR_INDEX':
              result = await this.indexRepair.repairIndex();
              break;
            case 'RECOVER_RUNTIME':
              result = await this.runtimeRecovery.recover();
              break;
            case 'RETRY':
              result = await this.runtimeRecovery.retryProcess(action.process);
              break;
            case 'RESET':
              result = await this.runtimeRecovery.resetComponent(action.component);
              break;
            case 'REBUILD':
              result = await this.indexRepair.rebuild();
              break;
            default:
              result = { success: false, error: 'Unknown action type' };
          }

          const recoveryEntry = {
            timestamp: new Date().toISOString(),
            component: component.name,
            action: action.type,
            success: result.success,
            details: result.details ?? [],
            risk: action.risk,
          };

          this.state.recoveryHistory.unshift(recoveryEntry);
          if (this.state.recoveryHistory.length > 100) this.state.recoveryHistory.pop();
          if (result.success) this.state.recoveryCount++;
          this.saveState();
          this.logRecovery(recoveryEntry);

          results.push({
            component: component.name,
            action: action.type,
            status: result.success ? 'SUCCESS' : 'FAILED',
            details: result.details ?? [],
            error: result.error,
          });
        } catch (err) {
          results.push({ component: component.name, action: action.type, status: 'ERROR', error: err.message });
        }
      }
    }

    return {
      healthReport,
      recoveryResults: results,
      summary: {
        total: results.length,
        succeeded: results.filter(r => r.status === 'SUCCESS').length,
        failed: results.filter(r => r.status === 'FAILED' || r.status === 'ERROR').length,
        skipped: results.filter(r => r.status === 'SKIPPED').length,
      },
    };
  }

  async repairIndex() {
    const result = await this.indexRepair.repairIndex();
    this.logRecovery({ timestamp: new Date().toISOString(), action: 'REPAIR_INDEX', ...result });
    return result;
  }

  async clearCache() {
    const result = await this.cacheRepair.clearCache();
    this.logRecovery({ timestamp: new Date().toISOString(), action: 'CLEAR_CACHE', ...result });
    return result;
  }

  async recoverRuntime() {
    const result = await this.runtimeRecovery.recover();
    this.logRecovery({ timestamp: new Date().toISOString(), action: 'RECOVER_RUNTIME', ...result });
    return result;
  }

  async rebuildIndex() {
    const result = await this.indexRepair.rebuild();
    this.logRecovery({ timestamp: new Date().toISOString(), action: 'REBUILD_INDEX', ...result });
    return result;
  }

  logRecovery(entry) {
    const logFile = join(this.logDir, `recovery-${new Date().toISOString().split('T')[0]}.jsonl`);
    try {
      writeFileSync(logFile, JSON.stringify(entry) + '\n', { flag: 'a' });
    } catch { /* ignore */ }
  }

  getRecoveryHistory(limit = 50) {
    return this.state.recoveryHistory.slice(0, limit);
  }

  getRecoveryLogs() {
    if (!existsSync(this.logDir)) return [];
    try {
      const files = readdirSync(this.logDir).filter(f => f.endsWith('.jsonl')).sort().reverse();
      const logs = [];
      for (const file of files.slice(0, 7)) {
        const content = readFileSync(join(this.logDir, file), 'utf8');
        content.split('\n').filter(Boolean).forEach(line => {
          try { logs.push(JSON.parse(line)); } catch { /* ignore */ }
        });
      }
      return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch {
      return [];
    }
  }
}

export default SelfHealManager;