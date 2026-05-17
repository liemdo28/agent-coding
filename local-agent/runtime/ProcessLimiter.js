/**
 * ProcessLimiter.js - Limit process resources with enforcement
 * Phase 22: Local Runtime Sandbox + Safe Execution Engine
 */

const os = require('os');

class ProcessLimiter {
  constructor(maxProcesses = 50, maxMemoryMB = 512, maxCpuPercent = 80) {
    this.limits = {
      maxProcesses: maxProcesses,
      maxMemoryMB: maxMemoryMB,
      maxCpuPercent: maxCpuPercent,
    };

    this.currentUsage = {
      processCount: 0,
      memoryUsageMB: 0,
      cpuUsagePercent: 0,
    };

    this.processList = new Map();
    this.processIdCounter = 0;
    this._startMonitoring();
  }

  _startMonitoring() {
    this._monitorInterval = setInterval(() => {
      this._updateUsage();
    }, 1000);
    this._monitorInterval.unref();
  }

  _updateUsage() {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      this.currentUsage.memoryUsageMB = Math.round(usedMem / (1024 * 1024));

      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      }
      this.currentUsage.cpuUsagePercent = Math.round(
        ((1 - totalIdle / totalTick) * 100) / cpus.length
      );
    } catch (e) {
      // Ignore monitoring errors
    }
  }

  registerProcess(process) {
    const pid = ++this.processIdCounter;
    this.processList.set(pid, {
      process,
      startTime: Date.now(),
      memoryUsageMB: 0,
    });
    this.currentUsage.processCount = this.processList.size;
    return pid;
  }

  unregisterProcess(pid) {
    this.processList.delete(pid);
    this.currentUsage.processCount = this.processList.size;
  }

  checkLimits() {
    this._updateUsage();
    return {
      processCount: {
        current: this.currentUsage.processCount,
        limit: this.limits.maxProcesses,
        overLimit: this.currentUsage.processCount > this.limits.maxProcesses,
      },
      memory: {
        currentMB: this.currentUsage.memoryUsageMB,
        limitMB: this.limits.maxMemoryMB,
        overLimit: this.currentUsage.memoryUsageMB > this.limits.maxMemoryMB,
      },
      cpu: {
        currentPercent: this.currentUsage.cpuUsagePercent,
        limitPercent: this.limits.maxCpuPercent,
        overLimit: this.currentUsage.cpuUsagePercent > this.limits.maxCpuPercent,
      },
      isOverLimit:
        this.currentUsage.processCount > this.limits.maxProcesses ||
        this.currentUsage.memoryUsageMB > this.limits.maxMemoryMB ||
        this.currentUsage.cpuUsagePercent > this.limits.maxCpuPercent,
    };
  }

  isOverLimit() {
    return this.checkLimits().isOverLimit;
  }

  killExcess(strategy = 'oldest') {
    const limits = this.checkLimits();
    let excess = 0;

    if (limits.processCount.overLimit) {
      excess = limits.processCount.current - limits.processCount.limit;
    } else if (limits.memory.overLimit) {
      excess = Math.ceil(this.processList.size * 0.3);
    } else if (limits.cpu.overLimit) {
      excess = Math.ceil(this.processList.size * 0.2);
    }

    if (excess <= 0) return 0;

    let processes = Array.from(this.processList.entries());

    switch (strategy) {
      case 'oldest':
        processes.sort((a, b) => a[1].startTime - b[1].startTime);
        break;
      case 'newest':
        processes.sort((a, b) => b[1].startTime - a[1].startTime);
        break;
      case 'largest':
        processes.sort((a, b) => b[1].memoryUsageMB - a[1].memoryUsageMB);
        break;
    }

    let killed = 0;
    for (let i = 0; i < excess && i < processes.length; i++) {
      const [pid, entry] = processes[i];
      try {
        entry.process.kill('SIGKILL');
        this.processList.delete(pid);
        killed++;
      } catch (e) {
        // Process already dead
      }
    }

    this.currentUsage.processCount = this.processList.size;
    return killed;
  }

  setLimits(maxProcesses, maxMemoryMB, maxCpuPercent) {
    if (maxProcesses !== undefined) this.limits.maxProcesses = maxProcesses;
    if (maxMemoryMB !== undefined) this.limits.maxMemoryMB = maxMemoryMB;
    if (maxCpuPercent !== undefined) this.limits.maxCpuPercent = maxCpuPercent;
  }

  getProcessList() {
    return Array.from(this.processList.entries()).map(([pid, entry]) => ({
      pid,
      uptime: Date.now() - entry.startTime,
      memoryUsageMB: entry.memoryUsageMB,
      isRunning: entry.process?.killed === false,
    }));
  }

  getLimits() {
    return { ...this.limits };
  }

  stop() {
    if (this._monitorInterval) {
      clearInterval(this._monitorInterval);
      this._monitorInterval = null;
    }
    for (const [pid, entry] of this.processList) {
      try { entry.process.kill('SIGKILL'); } catch (e) { /* already dead */ }
    }
    this.processList.clear();
  }

  getSystemResources() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    return {
      memory: {
        totalMB: Math.round(totalMem / (1024 * 1024)),
        usedMB: Math.round(usedMem / (1024 * 1024)),
        freeMB: Math.round(freeMem / (1024 * 1024)),
        usedPercent: Math.round((usedMem / totalMem) * 100),
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'unknown',
        currentUsagePercent: this.currentUsage.cpuUsagePercent,
      },
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
    };
  }
}

module.exports = ProcessLimiter;
