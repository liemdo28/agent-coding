// local-agent/plugins/PluginRegistry.js
// Phase 27: Plugin registry — manages approved and enabled plugins

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export class PluginRegistry {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.registryFile = join(workspaceRoot, '.local-agent', 'plugin-registry.json');
    this.registry = this.load();
  }

  load() {
    if (existsSync(this.registryFile)) {
      try { return JSON.parse(readFileSync(this.registryFile, 'utf8')); } catch { /* ignore */ }
    }
    return { plugins: {}, approved: [], history: [] };
  }

  save() {
    try { writeFileSync(this.registryFile, JSON.stringify(this.registry, null, 2)); } catch { /* ignore */ }
  }

  listApproved() {
    return this.registry.approved.map(name => ({
      name,
      ...this.registry.plugins[name],
    }));
  }

  listEnabled() {
    return Object.entries(this.registry.plugins)
      .filter(([, p]) => p.enabled)
      .map(([name, p]) => ({ name, ...p }));
  }

  approve(name) {
    if (!this.registry.approved.includes(name)) {
      this.registry.approved.push(name);
      this.logAction(name, 'APPROVED');
      this.save();
    }
    return { name, approved: true };
  }

  revoke(name) {
    this.registry.approved = this.registry.approved.filter(n => n !== name);
    if (this.registry.plugins[name]) {
      this.registry.plugins[name].enabled = false;
    }
    this.logAction(name, 'REVOKED');
    this.save();
    return { name, approved: false };
  }

  enable(name) {
    if (!this.registry.plugins[name]) {
      this.registry.plugins[name] = {};
    }
    this.registry.plugins[name].enabled = true;
    this.logAction(name, 'ENABLED');
    this.save();
    return { name, enabled: true };
  }

  disable(name) {
    if (this.registry.plugins[name]) {
      this.registry.plugins[name].enabled = false;
    }
    this.logAction(name, 'DISABLED');
    this.save();
    return { name, enabled: false };
  }

  logAction(name, action) {
    this.registry.history = this.registry.history || [];
    this.registry.history.unshift({
      plugin: name,
      action,
      timestamp: new Date().toISOString(),
    });
    if (this.registry.history.length > 100) {
      this.registry.history = this.registry.history.slice(0, 100);
    }
  }

  getHistory(limit = 50) {
    return (this.registry.history || []).slice(0, limit);
  }

  isApproved(name) {
    return this.registry.approved.includes(name);
  }

  isEnabled(name) {
    return this.registry.plugins[name]?.enabled === true;
  }
}

export default PluginRegistry;