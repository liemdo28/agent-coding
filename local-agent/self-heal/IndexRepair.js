// local-agent/self-heal/IndexRepair.js
// Phase 24: Index repair module — detect and repair broken file indexes

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export class IndexRepair {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.workspaceDir = join(workspaceRoot, '.local-agent');
    this.indexFile = join(this.workspaceDir, 'project-map.json');
    this.backupDir = join(this.workspaceDir, 'index-backup');
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    mkdirSync(this.backupDir, { recursive: true });
  }

  async checkIndexHealth() {
    const report = { healthy: true, issues: [], indexFile: this.indexFile, size: 0, entries: 0 };

    if (!existsSync(this.indexFile)) {
      report.healthy = false;
      report.issues.push({ type: 'MISSING', path: this.indexFile });
      return report;
    }

    try {
      const stat = statSync(this.indexFile);
      report.size = stat.size;

      const content = readFileSync(this.indexFile, 'utf8');
      const data = JSON.parse(content);

      // Check for required fields
      if (!data.files) {
        report.healthy = false;
        report.issues.push({ type: 'MISSING_FIELD', field: 'files' });
      } else if (!Array.isArray(data.files)) {
        report.healthy = false;
        report.issues.push({ type: 'INVALID_FIELD', field: 'files', reason: 'not an array' });
      } else {
        report.entries = data.files.length;
      }

      if (!data.scannedAt) {
        report.issues.push({ type: 'MISSING_FIELD', field: 'scannedAt', severity: 'WARN' });
      }

      if (!data.projectTypes) {
        report.issues.push({ type: 'MISSING_FIELD', field: 'projectTypes', severity: 'WARN' });
      }

      // Check for stale index (> 7 days old)
      if (data.scannedAt) {
        const age = Date.now() - new Date(data.scannedAt).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (age > sevenDays) {
          report.issues.push({ type: 'STALE', age: Math.round(age / (24 * 60 * 60 * 1000)) + ' days', severity: 'WARN' });
        }
      }

      // Validate entries
      if (data.files && Array.isArray(data.files)) {
        const invalidEntries = data.files.filter(f => !f.path || typeof f.path !== 'string');
        if (invalidEntries.length > 0) {
          report.healthy = false;
          report.issues.push({ type: 'INVALID_ENTRIES', count: invalidEntries.length });
        }

        // Check for null/undefined values
        const nullEntries = data.files.filter(f => f.path === null || f.path === undefined);
        if (nullEntries.length > 0) {
          report.healthy = false;
          report.issues.push({ type: 'NULL_PATHS', count: nullEntries.length });
        }
      }

    } catch (err) {
      report.healthy = false;
      report.issues.push({ type: 'CORRUPTED', error: err.message });
    }

    return report;
  }

  async repairIndex() {
    const health = await this.checkIndexHealth();
    if (health.healthy) {
      return { success: true, message: 'Index is healthy — no repair needed', health };
    }

    const repaired = [];
    const issues = health.issues;

    // Create backup before any repair
    this.backupIndex();

    // Fix null/undefined paths
    if (issues.some(i => i.type === 'NULL_PATHS')) {
      try {
        const content = readFileSync(this.indexFile, 'utf8');
        const data = JSON.parse(content);
        const originalCount = data.files.length;
        data.files = data.files.filter(f => f.path !== null && f.path !== undefined);
        const removed = originalCount - data.files.length;
        writeFileSync(this.indexFile, JSON.stringify(data, null, 2));
        repaired.push(`Removed ${removed} invalid entries with null/undefined paths`);
      } catch (err) {
        return { success: false, error: 'Failed to repair null paths: ' + err.message };
      }
    }

    // Fix invalid entries
    if (issues.some(i => i.type === 'INVALID_ENTRIES')) {
      try {
        const content = readFileSync(this.indexFile, 'utf8');
        const data = JSON.parse(content);
        const originalCount = data.files.length;
        data.files = data.files.filter(f => f.path && typeof f.path === 'string');
        const removed = originalCount - data.files.length;
        writeFileSync(this.indexFile, JSON.stringify(data, null, 2));
        repaired.push(`Removed ${removed} entries with invalid paths`);
      } catch (err) {
        return { success: false, error: 'Failed to repair invalid entries: ' + err.message };
      }
    }

    return {
      success: true,
      issues: issues.length,
      repaired,
      details: repaired.length > 0 ? repaired : ['Index repaired successfully'],
    };
  }

  async rebuild() {
    // Backup current index
    this.backupIndex();

    // Clear index file — next scan will rebuild it
    try {
      const content = readFileSync(this.indexFile, 'utf8');
      const data = JSON.parse(content);
      // Reset to minimal state
      data.files = [];
      data.scannedAt = new Date().toISOString();
      data.rebuilt = true;
      data.rebuildAt = new Date().toISOString();
      writeFileSync(this.indexFile, JSON.stringify(data, null, 2));

      return {
        success: true,
        message: 'Index cleared — run `local-agent scan` to rebuild',
        backupPath: this.getLatestBackup(),
        details: ['Index reset to empty state', 'Next scan will rebuild from scratch'],
      };
    } catch (err) {
      return { success: false, error: 'Failed to rebuild index: ' + err.message };
    }
  }

  backupIndex() {
    if (!existsSync(this.indexFile)) return null;
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = join(this.backupDir, `project-map-${timestamp}.json`);
      const content = readFileSync(this.indexFile, 'utf8');
      writeFileSync(backupPath, content, 'utf8');

      // Clean up old backups (keep last 5)
      this.cleanOldBackups();

      return backupPath;
    } catch (err) {
      return null;
    }
  }

  getLatestBackup() {
    try {
      const files = readdirSync(this.backupDir)
        .filter(f => f.startsWith('project-map-') && f.endsWith('.json'))
        .sort()
        .reverse();
      return files.length > 0 ? join(this.backupDir, files[0]) : null;
    } catch {
      return null;
    }
  }

  cleanOldBackups() {
    try {
      const files = readdirSync(this.backupDir)
        .filter(f => f.startsWith('project-map-') && f.endsWith('.json'))
        .sort()
        .reverse();
      // Remove all but last 5
      for (const file of files.slice(5)) {
        try { unlinkSync(join(this.backupDir, file)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  async getIndexStats() {
    if (!existsSync(this.indexFile)) {
      return { exists: false, entries: 0, size: 0 };
    }

    try {
      const stat = statSync(this.indexFile);
      const content = readFileSync(this.indexFile, 'utf8');
      const data = JSON.parse(content);
      return {
        exists: true,
        entries: data.files?.length ?? 0,
        size: stat.size,
        scannedAt: data.scannedAt,
        stale: data.scannedAt ? (Date.now() - new Date(data.scannedAt).getTime()) > 7 * 24 * 60 * 60 * 1000 : true,
        backups: readdirSync(this.backupDir).filter(f => f.startsWith('project-map-') && f.endsWith('.json')).length,
      };
    } catch {
      return { exists: false, entries: 0, size: 0, corrupted: true };
    }
  }
}

export default IndexRepair;