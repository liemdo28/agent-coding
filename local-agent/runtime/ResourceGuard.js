/**
 * ResourceGuard.js - Guard system resources with monitoring and alerts
 * Phase 22: Local Runtime Sandbox + Safe Execution Engine
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

class ResourceGuard {
  constructor(cpuLimit = 80, memoryLimitMB = 512, diskLimitMB = 1000) {
    this.limits = {
      cpuLimit,
      memoryLimitMB,
      diskLimitMB,
    };

    this.alerts = [];
    this.alertCallbacks = [];
    this.history = [];
    this.maxHistorySize = 1000;
    this.checkInterval = null;
    this.lastCPUIdle = null;
    this.lastCPUTotal = null;

    this._startMonitoring();
  }

  _startMonitoring() {
    this.checkInterval = setInterval(() => {
      this._recordSnapshot();
      this.alertIfHigh();
    }, 2000);
    if (this.checkInterval.unref) this.checkInterval.unref();
  }

  _getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    return { idle: totalIdle, total: totalTick };
  }

  _calculateCPUPercent() {
    const current = this._getCPUUsage();
    if (this.lastCPUIdle === null) {
      this.lastCPUIdle = current.idle;
      this.lastCPUTotal = current.total;
      return 0;
    }

    const idleDiff = current.idle - this.lastCPUIdle;
    const totalDiff = current.total - this.lastCPUTotal;
    this.lastCPUIdle = current.idle;
    this.lastCPUTotal = current.total;

    if (totalDiff === 0) return 0;
    return Math.round((1 - idleDiff / totalDiff) * 100);
  }

  checkCPU() {
    const usage = this._calculateCPUPercent();
    return {
      usagePercent: usage,
      limit: this.limits.cpuLimit,
      isHigh: usage > this.limits.cpuLimit,
      cores: os.cpus().length,
    };
  }

  checkMemory() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedMB = Math.round(usedMem / (1024 * 1024));

    return {
      usedMB,
      totalMB: Math.round(totalMem / (1024 * 1024)),
      freeMB: Math.round(freeMem / (1024 * 1024)),
      usagePercent: Math.round((usedMem / totalMem) * 100),
      limitMB: this.limits.memoryLimitMB,
      isHigh: usedMB > this.limits.memoryLimitMB,
    };
  }

  checkDisk(diskPath = '/') {
    try {
      const stat = fs.statfsSync(diskPath);
      const totalMB = Math.round(stat.bsize * stat.blocks / (1024 * 1024));
      const freeMB = Math.round(stat.bsize * stat.bfree / (1024 * 1024));
      const usedMB = totalMB - freeMB;

      return {
        usedMB,
        totalMB,
        freeMB,
        usagePercent: Math.round((usedMB / totalMB) * 100),
        limitMB: this.limits.diskLimitMB,
        isHigh: usedMB > this.limits.diskLimitMB,
        path: diskPath,
      };
    } catch (e) {
      return {
        error: e.message,
        path: diskPath,
        isHigh: false,
      };
    }
  }

  enforceLimits() {
    const results = {
      cpu: this.checkCPU(),
      memory: this.checkMemory(),
      disk: this.checkDisk(),
    };

    const violations = [];
    if (results.cpu.isHigh) violations.push({ type: 'cpu', current: results.cpu.usagePercent, limit: results.cpu.limit });
    if (results.memory.isHigh) violations.push({ type: 'memory', current: results.memory.usedMB, limit: results.memory.limitMB });
    if (results.disk.isHigh) violations.push({ type: 'disk', current: results.disk.usedMB, limit: results.disk.limitMB });

    return { results, violations, hasViolations: violations.length > 0 };
  }

  getResourceStatus() {
    const cpu = this.checkCPU();
    const memory = this.checkMemory();
    const disk = this.checkDisk();

    return {
      timestamp: Date.now(),
      uptime: os.uptime(),
      cpu,
      memory,
      disk,
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
    };
  }

  alertIfHigh() {
    const status = this.getResourceStatus();
    const alertLevel = this._getAlertLevel(status);

    if (alertLevel !== 'normal') {
      const alert = {
        timestamp: Date.now(),
        level: alertLevel,
        cpu: status.cpu.usagePercent,
        memory: status.memory.usagePercent,
        disk: status.disk.usagePercent,
      };
      this.alerts.push(alert);
      if (this.alerts.length > 100) this.alerts.shift();

      for (const callback of this.alertCallbacks) {
        try { callback(alert); } catch (e) { /* ignore callback errors */ }
      }
    }
  }

  _getAlertLevel(status) {
    const cpuPct = status.cpu.usagePercent;
    const memPct = status.memory.usagePercent;
    const diskPct = status.disk.usagePercent;

    if (cpuPct > 90 || memPct > 90 || diskPct > 90) return 'critical';
    if (cpuPct > 80 || memPct > 80 || diskPct > 80) return 'high';
    if (cpuPct > 70 || memPct > 70 || diskPct > 70) return 'medium';
    return 'normal';
  }

  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  getAlerts(limit = 50) {
    return this.alerts.slice(-limit);
  }

  _recordSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      cpu: this.checkCPU().usagePercent,
      memory: this.checkMemory().usedMB,
      disk: this.checkDisk().usedMB,
    };
    this.history.push(snapshot);
    if (this.history.length > this.maxHistorySize) this.history.shift();
  }

  getHistory(limit = 100) {
    return this.history.slice(-limit);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

module.exports = ResourceGuard;
