// local-agent/team/CollaborationAudit.js
// Phase 28: Collaboration audit — audit trail for team collaboration activities

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export class CollaborationAudit {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.auditDir = join(workspaceRoot, '.local-agent', 'team', 'audit');
    this.ensureAuditDir();
  }

  ensureAuditDir() {
    mkdirSync(this.auditDir, { recursive: true });
  }

  log(event) {
    const entry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    const auditFile = join(this.auditDir, `audit-${new Date().toISOString().split('T')[0]}.jsonl`);
    try {
      writeFileSync(auditFile, JSON.stringify(entry) + '\n', { flag: 'a' });
    } catch { /* ignore */ }
    return entry;
  }

  logExport(packId, type, user) {
    return this.log({
      type: 'EXPORT',
      action: 'TEAM_PACK_EXPORT',
      packId,
      packType: type,
      user: user || 'local-agent',
    });
  }

  logImport(packId, type, user) {
    return this.log({
      type: 'IMPORT',
      action: 'TEAM_PACK_IMPORT',
      packId,
      packType: type,
      user: user || 'local-agent',
    });
  }

  logSync(direction, partnerId) {
    return this.log({
      type: 'SYNC',
      action: direction === 'OUTBOUND' ? 'MEMORY_SYNC_OUTBOUND' : 'MEMORY_SYNC_INBOUND',
      partnerId,
    });
  }

  logPolicyShare(policyName, recipientId) {
    return this.log({
      type: 'SHARE',
      action: 'POLICY_SHARED',
      policyName,
      recipientId,
    });
  }

  getAuditLogs(limit = 100) {
    const logs = [];
    const { readdirSync, readFileSync } = require('fs');
    if (!existsSync(this.auditDir)) return logs;
    try {
      const files = readdirSync(this.auditDir)
        .filter(f => f.startsWith('audit-') && f.endsWith('.jsonl'))
        .sort()
        .reverse()
        .slice(0, 7);
      for (const file of files) {
        const content = readFileSync(join(this.auditDir, file), 'utf8');
        content.split('\n').filter(Boolean).forEach(line => {
          try { logs.push(JSON.parse(line)); } catch { /* ignore */ }
        });
      }
    } catch { /* ignore */ }
    return logs.slice(0, limit);
  }

  generateAuditReport() {
    const logs = this.getAuditLogs(1000);
    const report = {
      generatedAt: new Date().toISOString(),
      totalEvents: logs.length,
      byType: {},
      byAction: {},
      recentExports: logs.filter(l => l.type === 'EXPORT').length,
      recentImports: logs.filter(l => l.type === 'IMPORT').length,
      recentSyncs: logs.filter(l => l.type === 'SYNC').length,
    };
    for (const log of logs) {
      report.byType[log.type] = (report.byType[log.type] || 0) + 1;
      report.byAction[log.action] = (report.byAction[log.action] || 0) + 1;
    }
    return report;
  }
}

export default CollaborationAudit;