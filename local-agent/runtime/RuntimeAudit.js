/**
 * RuntimeAudit.js - Audit runtime execution with logging and statistics
 * Phase 22: Local Runtime Sandbox + Safe Execution Engine
 */

const fs = require('fs');
const path = require('path');

class RuntimeAudit {
  constructor(logDir = null) {
    this.logDir = logDir || path.join(process.cwd(), 'runtime-audit-logs');
    this.executionLog = [];
    this.blockedAttempts = [];
    this.resourceHistory = [];
    this.maxLogSize = 10000;
    this.sessionStartTime = Date.now();
    this.sessionId = this._generateSessionId();

    // Ensure log directory exists
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (e) {
      // Log dir creation failed, continue without file persistence
    }

    // Load existing logs if available
    this._loadLogs();
  }

  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  _loadLogs() {
    try {
      const logFile = path.join(this.logDir, 'audit.log');
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.type === 'execution') {
              this.executionLog.push(entry);
            } else if (entry.type === 'blocked') {
              this.blockedAttempts.push(entry);
            }
          } catch (e) {
            // Skip malformed lines
          }
        }
        // Trim to max size
        if (this.executionLog.length > this.maxLogSize) {
          this.executionLog = this.executionLog.slice(-this.maxLogSize);
        }
        if (this.blockedAttempts.length > this.maxLogSize) {
          this.blockedAttempts = this.blockedAttempts.slice(-this.maxLogSize);
        }
      }
    } catch (e) {
      // Ignore load errors
    }
  }

  _appendToFile(entry) {
    try {
      const logFile = path.join(this.logDir, 'audit.log');
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(logFile, line, 'utf8');
    } catch (e) {
      // Ignore write errors
    }
  }

  logExecution(command, result, metadata = {}) {
    const entry = {
      type: 'execution',
      sessionId: this.sessionId,
      timestamp: Date.now(),
      command: command,
      success: result.success,
      exitCode: result.exitCode,
      executionTime: result.executionTime,
      processId: result.processId,
      blocked: result.blocked || false,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      metadata: metadata,
    };

    this.executionLog.push(entry);
    if (this.executionLog.length > this.maxLogSize) {
      this.executionLog.shift();
    }

    this._appendToFile(entry);
    return entry;
  }

  logBlocked(command, reason, metadata = {}) {
    const entry = {
      type: 'blocked',
      sessionId: this.sessionId,
      timestamp: Date.now(),
      command: command,
      reason: reason || 'Unknown',
      metadata: metadata,
    };

    this.blockedAttempts.push(entry);
    if (this.blockedAttempts.length > this.maxLogSize) {
      this.blockedAttempts.shift();
    }

    this._appendToFile(entry);
    return entry;
  }

  getAuditLog(limit = 100) {
    return this.executionLog.slice(-limit);
  }

  getBlockedAttempts(limit = 100) {
    return this.blockedAttempts.slice(-limit);
  }

  getResourceUsage(limit = 100) {
    return this.resourceHistory.slice(-limit);
  }

  recordResourceUsage(resourceSnapshot) {
    const entry = {
      type: 'resource',
      sessionId: this.sessionId,
      timestamp: Date.now(),
      ...resourceSnapshot,
    };
    this.resourceHistory.push(entry);
    if (this.resourceHistory.length > this.maxLogSize) {
      this.resourceHistory.shift();
    }
    return entry;
  }

  getExecutionStats() {
    const total = this.executionLog.length;
    const successful = this.executionLog.filter(e => e.success && !e.blocked).length;
    const failed = this.executionLog.filter(e => !e.success && !e.blocked).length;
    const blocked = this.executionLog.filter(e => e.blocked).length + this.blockedAttempts.length;
    const totalBlockedAttempts = this.blockedAttempts.length;

    const timedOut = this.executionLog.filter(e => e.stderr && e.stderr.includes('timed out')).length;
    
    const execTimes = this.executionLog
      .filter(e => e.executionTime > 0)
      .map(e => e.executionTime);
    
    const avgExecutionTime = execTimes.length > 0
      ? execTimes.reduce((a, b) => a + b, 0) / execTimes.length
      : 0;
    
    const maxExecutionTime = execTimes.length > 0
      ? Math.max(...execTimes)
      : 0;
    
    const minExecutionTime = execTimes.length > 0
      ? Math.min(...execTimes)
      : 0;

    const now = Date.now();
    const uptime = now - this.sessionStartTime;

    return {
      sessionId: this.sessionId,
      sessionStartTime: this.sessionStartTime,
      uptime,
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: failed,
      blockedExecutions: blocked,
      totalBlockedAttempts: totalBlockedAttempts,
      timedOutExecutions: timedOut,
      averageExecutionTime: Math.round(avgExecutionTime),
      maxExecutionTime,
      minExecutionTime,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      byHour: this._getExecutionsByHour(),
    };
  }

  _getExecutionsByHour() {
    const hours = {};
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    for (const entry of this.executionLog) {
      if (entry.timestamp >= oneDayAgo) {
        const hour = new Date(entry.timestamp).toISOString().substring(0, 13);
        if (!hours[hour]) {
          hours[hour] = { total: 0, successful: 0, failed: 0 };
        }
        hours[hour].total++;
        if (entry.success) hours[hour].successful++;
        else hours[hour].failed++;
      }
    }

    return hours;
  }

  exportAudit(format = 'json', outputPath = null) {
    const data = {
      sessionId: this.sessionId,
      sessionStartTime: this.sessionStartTime,
      exportTime: Date.now(),
      stats: this.getExecutionStats(),
      executions: this.executionLog,
      blockedAttempts: this.blockedAttempts,
      resourceHistory: this.resourceHistory,
    };

    if (format === 'json') {
      const content = JSON.stringify(data, null, 2);
      if (outputPath) {
        fs.writeFileSync(outputPath, content, 'utf8');
        return outputPath;
      }
      return content;
    }

    if (format === 'csv') {
      const lines = ['timestamp,command,success,exitCode,executionTime,blocked'];
      for (const entry of this.executionLog) {
        lines.push(`${entry.timestamp},"${entry.command}",${entry.success},${entry.exitCode},${entry.executionTime},${entry.blocked}`);
      }
      const content = lines.join('\n');
      if (outputPath) {
        fs.writeFileSync(outputPath, content, 'utf8');
        return outputPath;
      }
      return content;
    }

    if (format === 'summary') {
      const stats = this.getExecutionStats();
      let summary = `Runtime Audit Summary\n`;
      summary += `==================\n`;
      summary += `Session: ${stats.sessionId}\n`;
      summary += `Started: ${new Date(stats.sessionStartTime).toISOString()}\n`;
      summary += `Uptime: ${Math.round(stats.uptime / 1000)}s\n\n`;
      summary += `Total Executions: ${stats.totalExecutions}\n`;
      summary += `Successful: ${stats.successfulExecutions}\n`;
      summary += `Failed: ${stats.failedExecutions}\n`;
      summary += `Blocked: ${stats.blockedExecutions}\n`;
      summary += `Success Rate: ${stats.successRate}%\n\n`;
      summary += `Avg Execution Time: ${stats.averageExecutionTime}ms\n`;
      summary += `Max Execution Time: ${stats.maxExecutionTime}ms\n`;
      summary += `Min Execution Time: ${stats.minExecutionTime}ms\n`;
      
      if (outputPath) {
        fs.writeFileSync(outputPath, summary, 'utf8');
        return outputPath;
      }
      return summary;
    }

    return null;
  }

  clearLogs() {
    this.executionLog = [];
    this.blockedAttempts = [];
    this.resourceHistory = [];
    this.sessionStartTime = Date.now();
    this.sessionId = this._generateSessionId();

    try {
      const logFile = path.join(this.logDir, 'audit.log');
      if (fs.existsSync(logFile)) {
        fs.unlinkSync(logFile);
      }
    } catch (e) {
      // Ignore errors
    }
  }

  getLogSize() {
    return {
      executions: this.executionLog.length,
      blockedAttempts: this.blockedAttempts.length,
      resourceHistory: this.resourceHistory.length,
      maxSize: this.maxLogSize,
    };
  }
}

module.exports = RuntimeAudit;
