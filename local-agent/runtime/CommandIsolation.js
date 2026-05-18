/**
 * CommandIsolation.js - Isolate dangerous commands with detection and sanitization
 * Phase 22: Local Runtime Sandbox + Safe Execution Engine
 */

class CommandIsolation {
  constructor() {
    this.blocklist = new Map();
    this.requireApprovalList = new Map();

    // Critical: system destruction
    this.dangerousPatterns = [
      { pattern: /^rm\s+-rf\s+\/(f)?/i, level: 'critical', reason: 'Recursive force delete from root' },
      { pattern: /^sudo\s+/i, level: 'critical', reason: 'Privilege escalation' },
      { pattern: /^mkfs/i, level: 'critical', reason: 'Filesystem format' },
      { pattern: /^dd\s+if=/i, level: 'critical', reason: 'Raw disk write' },
      { pattern: /^:\(\)\s*\{\s*:\|:\s*&\s*\};/i, level: 'critical', reason: 'Fork bomb' },
      { pattern: /^chmod\s+-R\s+777\s+\/(system|boot|etc)/i, level: 'critical', reason: 'Dangerous permission change' },
      { pattern: />\s*\/dev\/sda/i, level: 'critical', reason: 'Direct block device write' },
      { pattern: /^kill\s+-9\s+-1/i, level: 'critical', reason: 'Kill all processes' },
    ];

    // High: external network or system changes
    this.highDangerPatterns = [
      { pattern: /curl\s+https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/i, level: 'high', reason: 'External network request via curl' },
      { pattern: /wget\s+https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/i, level: 'high', reason: 'External network request via wget' },
      { pattern: /fetch\s+https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/i, level: 'high', reason: 'External network request via fetch' },
      { pattern: /^npm\s+i\s+-g/i, level: 'high', reason: 'Global npm install' },
      { pattern: /^pip\s+install\s+--user/i, level: 'high', reason: 'User pip install' },
      { pattern: /^chmod\s+[47]777/i, level: 'high', reason: 'World-writable permission' },
      { pattern: /eval\s+\$\(/i, level: 'high', reason: 'Command injection via eval' },
    ];

    // Medium: file modifications
    this.mediumDangerPatterns = [
      { pattern: /^rm\s+-r/i, level: 'medium', reason: 'Recursive delete' },
      { pattern: /^chmod\s+-R/i, level: 'medium', reason: 'Recursive permission change' },
      { pattern: /^chown\s+-R/i, level: 'medium', reason: 'Recursive owner change' },
      { pattern: /\|\s*sh$/i, level: 'medium', reason: 'Pipe to shell' },
      { pattern: /\bsh\s+-c\b/i, level: 'medium', reason: 'Explicit shell invocation' },
    ];

    // Build full pattern list
    this.allPatterns = [
      ...this.dangerousPatterns,
      ...this.highDangerPatterns,
      ...this.mediumDangerPatterns,
    ];

    // Suspicious argument combinations
    this.suspiciousArgPatterns = [
      { pattern: /--version\s+.*--debug/i, level: 'medium' },
      { pattern: /--help\s+.*\|/i, level: 'low' },
      { pattern: /\.exe\s+--payload/i, level: 'high' },
    ];
  }

  isDangerous(command) {
    if (!command || typeof command !== 'string') return true;
    const trimmed = command.trim();
    for (const { pattern } of this.allPatterns) {
      if (pattern.test(trimmed)) return true;
    }
    for (const { pattern } of this.suspiciousArgPatterns) {
      if (pattern.test(trimmed)) return true;
    }
    return false;
  }

  getDangerLevel(command) {
    if (!command || typeof command !== 'string') return 'critical';
    const trimmed = command.trim();

    for (const item of this.dangerousPatterns) {
      if (item.pattern.test(trimmed)) return { level: 'critical', reason: item.reason };
    }
    for (const item of this.highDangerPatterns) {
      if (item.pattern.test(trimmed)) return { level: 'high', reason: item.reason };
    }
    for (const item of this.mediumDangerPatterns) {
      if (item.pattern.test(trimmed)) return { level: 'medium', reason: item.reason };
    }
    for (const item of this.suspiciousArgPatterns) {
      if (item.pattern.test(trimmed)) return { level: item.level, reason: 'Suspicious arguments' };
    }
    return { level: 'low', reason: 'No danger detected' };
  }

  sanitizeCommand(command) {
    if (!command || typeof command !== 'string') return { sanitized: '', warnings: ['Empty command'] };

    const warnings = [];
    let sanitized = command.trim();

    // Remove dangerous patterns
    sanitized = sanitized.replace(/;?\s*\|\s*sh$/i, '');
    sanitized = sanitized.replace(/;?\s*\$\([^)]+\)/g, '');
    sanitized = sanitized.replace(/\beval\s+/i, '// eval ');

    // Check for backtick substitution
    if (sanitized.includes('`')) {
      warnings.push('Backtick command substitution removed');
      sanitized = sanitized.replace(/`[^`]+`/g, '');
    }

    // Check for dollar parentheses not removed
    if (/\$ \(/.test(sanitized)) {
      warnings.push('Unquoted command substitution may be dangerous');
    }

    return { sanitized: sanitized.trim(), warnings };
  }

  blockCommand(command, reason) {
    if (!command || typeof command !== 'string') return false;
    const key = command.trim().toLowerCase();
    this.blocklist.set(key, {
      reason: reason || 'Manually blocked',
      blockedAt: Date.now(),
    });
    return true;
  }

  unblockCommand(command) {
    if (!command || typeof command !== 'string') return false;
    const key = command.trim().toLowerCase();
    return this.blocklist.delete(key);
  }

  getBlocklist() {
    return Array.from(this.blocklist.entries()).map(([command, info]) => ({
      command,
      reason: info.reason,
      blockedAt: info.blockedAt,
    }));
  }

  isBlocked(command) {
    if (!command || typeof command !== 'string') return false;
    const key = command.trim().toLowerCase();
    return this.blocklist.has(key);
  }

  shouldRequireApproval(command) {
    if (!command || typeof command !== 'string') return true;
    if (this.isBlocked(command)) return true;

    const danger = this.getDangerLevel(command);
    if (danger.level === 'critical') return true;
    if (danger.level === 'high') return true;
    if (danger.level === 'medium') return true;

    // Check manual approval list
    const key = command.trim().toLowerCase();
    if (this.requireApprovalList.has(key)) return true;

    return false;
  }

  addToApprovalList(command, reason = '') {
    if (!command || typeof command !== 'string') return false;
    const key = command.trim().toLowerCase();
    this.requireApprovalList.set(key, {
      reason: reason || 'Added to approval list',
      addedAt: Date.now(),
    });
    return true;
  }

  removeFromApprovalList(command) {
    if (!command || typeof command !== 'string') return false;
    const key = command.trim().toLowerCase();
    return this.requireApprovalList.delete(key);
  }

  getApprovalList() {
    return Array.from(this.requireApprovalList.entries()).map(([command, info]) => ({
      command,
      reason: info.reason,
      addedAt: info.addedAt,
    }));
  }

  analyzeCommand(command) {
    const danger = this.getDangerLevel(command);
    const blocked = this.isBlocked(command);
    const requiresApproval = this.shouldRequireApproval(command);
    const sanitized = this.sanitizeCommand(command);

    return {
      command,
      danger,
      blocked,
      requiresApproval,
      sanitized: sanitized.sanitized,
      sanitizationWarnings: sanitized.warnings,
      analyzedAt: Date.now(),
    };
  }

  clearBlocklist() {
    this.blocklist.clear();
  }

  clearApprovalList() {
    this.requireApprovalList.clear();
  }
}

module.exports = CommandIsolation;
