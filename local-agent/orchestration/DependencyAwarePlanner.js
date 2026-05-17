/**
 * Phase 55 - Dependency Aware Planner
 * Plan tasks while respecting dependencies
 */
const fs = require('fs');
const path = require('path');

class DependencyAwarePlanner {
  constructor() {
    this.dependencyGraph = new Map();
  }

  /**
   * Build dependency graph from tasks
   */
  buildGraph(tasks) {
    this.dependencyGraph.clear();

    for (const task of tasks) {
      const taskId = task.id || task.task;
      const deps = this.extractDependencies(task);
      this.dependencyGraph.set(taskId, deps);
    }

    return this;
  }

  /**
   * Extract dependencies from task
   */
  extractDependencies(task) {
    const deps = [];
    const taskStr = typeof task === 'string' ? task : task.task;
    
    // Look for explicit dependencies
    const depPatterns = [
      /depends on ([A-Z][a-zA-Z]+)/gi,
      /after ([A-Z][a-zA-Z]+)/gi,
      /requires ([A-Z][a-zA-Z]+)/gi,
      /blocked by ([A-Z][a-zA-Z]+)/gi
    ];

    for (const pattern of depPatterns) {
      const matches = taskStr.matchAll(pattern);
      for (const match of matches) {
        deps.push(match[1]);
      }
    }

    // Implicit dependencies based on file changes
    if (task.files) {
      for (const file of task.files) {
        const implicitDep = this.findImplicitDependency(file);
        if (implicitDep) deps.push(implicitDep);
      }
    }

    return [...new Set(deps)];
  }

  /**
   * Find implicit dependencies
   */
  findImplicitDependency(file) {
    // Common patterns: model before controller, etc.
    const patterns = {
      'Controller': 'Model',
      'Service': ['Model', 'Controller'],
      'Component': 'Service'
    };

    for (const [type, deps] of Object.entries(patterns)) {
      if (file.includes(type)) {
        if (Array.isArray(deps)) {
          return deps[0];
        }
        return deps;
      }
    }

    return null;
  }

  /**
   * Check for circular dependencies
   */
  detectCycles() {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const dfs = (node, path) => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const deps = this.dependencyGraph.get(node) || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          const subCycle = dfs(dep, [...path]);
          if (subCycle) return subCycle;
        } else if (recursionStack.has(dep)) {
          const cycleStart = path.indexOf(dep);
          cycles.push(path.slice(cycleStart));
        }
      }

      recursionStack.delete(node);
      return null;
    };

    for (const node of this.dependencyGraph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Topological sort for execution order
   */
  getExecutionOrder() {
    const order = [];
    const visited = new Set();
    const temp = new Set();

    const visit = (node) => {
      if (temp.has(node)) return; // Cycle detected, skip
      if (visited.has(node)) return;
      
      temp.add(node);
      const deps = this.dependencyGraph.get(node) || [];
      for (const dep of deps) {
        visit(dep);
      }
      temp.delete(node);
      visited.add(node);
      order.unshift(node);
    };

    for (const node of this.dependencyGraph.keys()) {
      visit(node);
    }

    return order;
  }

  /**
   * Check if task is blocked
   */
  isBlocked(taskId) {
    const deps = this.dependencyGraph.get(taskId) || [];
    return deps.some(dep => !this.isCompleted(dep));
  }

  /**
   * Mark task as completed
   */
  markCompleted(taskId) {
    this.completedTasks = this.completedTasks || new Set();
    this.completedTasks.add(taskId);
  }

  /**
   * Check if task is completed
   */
  isCompleted(taskId) {
    return this.completedTasks?.has(taskId) || false;
  }

  /**
   * Get executable tasks
   */
  getExecutableTasks(tasks) {
    return tasks.filter(t => {
      const taskId = t.id || t.task;
      return !this.isBlocked(taskId);
    });
  }

  /**
   * Plan with dependencies
   */
  plan(tasks, options = {}) {
    this.buildGraph(tasks);
    const cycles = this.detectCycles();
    
    if (cycles.length > 0 && !options.allowCycles) {
      return {
        valid: false,
        cycles,
        error: 'Circular dependencies detected'
      };
    }

    const executionOrder = this.getExecutionOrder();
    const executable = this.getExecutableTasks(tasks);

    return {
      valid: true,
      executionOrder,
      executable,
      blocked: tasks.filter(t => this.isBlocked(t.id || t.task)),
      cycles: cycles.length > 0 ? cycles : undefined
    };
  }
}

module.exports = { DependencyAwarePlanner };