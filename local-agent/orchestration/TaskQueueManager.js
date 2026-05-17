/**
 * Phase 55 - Task Queue Manager
 * Manages prioritized task queue
 */
const fs = require('fs');
const path = require('path');

class TaskQueueManager {
  constructor() {
    this.queue = [];
    this.history = [];
    this.maxQueueSize = 100;
  }

  /**
   * Add task to queue
   */
  addTask(task, priority = {}) {
    const taskEntry = {
      id: this.generateId(),
      task,
      priority: priority.level || 'MEDIUM',
      score: priority.score || 5,
      factors: priority.factors || {},
      addedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    };

    this.queue.push(taskEntry);
    this.queue.sort((a, b) => b.score - a.score);
    this.trimQueue();

    return taskEntry;
  }

  /**
   * Get next task to execute
   */
  getNextTask() {
    const task = this.queue.find(t => t.status === 'pending');
    return task || null;
  }

  /**
   * Complete a task
   */
  completeTask(taskId, result = {}) {
    const task = this.queue.find(t => t.id === taskId);
    if (task) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.result = result;
      this.history.push(task);
      this.queue = this.queue.filter(t => t.id !== taskId);
      return true;
    }
    return false;
  }

  /**
   * Fail a task
   */
  failTask(taskId, error = {}) {
    const task = this.queue.find(t => t.id === taskId);
    if (task) {
      task.attempts++;
      task.lastError = error.message;
      if (task.attempts >= 3) {
        task.status = 'failed';
        this.history.push(task);
        this.queue = this.queue.filter(t => t.id !== taskId);
      }
      return true;
    }
    return false;
  }

  /**
   * Group related tasks
   */
  groupRelatedTasks(tasks) {
    const groups = {};
    const keywords = {
      'security': ['auth', 'permission', 'password', 'token', 'security'],
      'performance': ['performance', 'memory', 'speed', 'optimize', 'cache'],
      'testing': ['test', 'qa', 'regression', 'spec'],
      'api': ['api', 'endpoint', 'route', 'request', 'response'],
      'ui': ['ui', 'component', 'render', 'style', 'css']
    };

    for (const task of tasks) {
      const taskLower = task.task.toLowerCase();
      let groupKey = 'general';

      for (const [key, kws] of Object.entries(keywords)) {
        if (kws.some(kw => taskLower.includes(kw))) {
          groupKey = key;
          break;
        }
      }

      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(task);
    }

    return groups;
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      pending: this.queue.filter(t => t.status === 'pending').length,
      inProgress: this.queue.filter(t => t.status === 'in_progress').length,
      completed: this.history.filter(t => t.status === 'completed').length,
      failed: this.history.filter(t => t.status === 'failed').length,
      byPriority: {
        CRITICAL: this.queue.filter(t => t.priority === 'CRITICAL').length,
        HIGH: this.queue.filter(t => t.priority === 'HIGH').length,
        MEDIUM: this.queue.filter(t => t.priority === 'MEDIUM').length,
        LOW: this.queue.filter(t => t.priority === 'LOW').length
      }
    };
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Trim queue to max size
   */
  trimQueue() {
    if (this.queue.length > this.maxQueueSize) {
      const removed = this.queue.splice(this.maxQueueSize);
      this.history.push(...removed.map(t => ({ ...t, status: 'trimmed' })));
    }
  }

  /**
   * Export queue state
   */
  export() {
    return {
      queue: this.queue,
      history: this.history.slice(-50),
      exportedAt: new Date().toISOString()
    };
  }
}

module.exports = { TaskQueueManager };