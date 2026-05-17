// local-agent/self-heal/RecoveryPlanner.js
// Phase 24: Recovery action planner — classifies failure type and plans safe recovery steps

export class RecoveryPlanner {
  constructor() {
    this.maxRetries = 3;
    // Action definitions keyed by component + failureType
    this.actionRegistry = {
      'database': {
        'LOCKED':        [{ type: 'RETRY',        risk: 'LOW',  maxRetries: 3, delayMs: 2000 }],
        'CORRUPTED':     [{ type: 'REBUILD',      risk: 'HIGH', maxRetries: 1 }],
        'TIMEOUT':       [{ type: 'RETRY',        risk: 'LOW',  maxRetries: 2, delayMs: 5000 }],
      },
      'index': {
        'BROKEN':        [{ type: 'REPAIR_INDEX', risk: 'MEDIUM', maxRetries: 1 }],
        'STALE':         [{ type: 'REBUILD',      risk: 'MEDIUM', maxRetries: 1 }],
        'MISSING':       [{ type: 'REBUILD',      risk: 'LOW',   maxRetries: 1 }],
      },
      'cache': {
        'CORRUPTED':     [{ type: 'CLEAR_CACHE',  risk: 'LOW',   maxRetries: 1 }],
        'OVERFLOW':      [{ type: 'CLEAR_CACHE',  risk: 'LOW',   maxRetries: 1 }],
        'STALE':         [{ type: 'CLEAR_CACHE',  risk: 'LOW',   maxRetries: 1 }],
      },
      'runtime': {
        'CRASHED':       [{ type: 'RECOVER_RUNTIME', risk: 'MEDIUM', maxRetries: 2 }],
        'STUCK':         [{ type: 'RESET',          risk: 'HIGH',   maxRetries: 1 }],
        'TIMEOUT':       [{ type: 'RETRY',           risk: 'LOW',   maxRetries: 2, delayMs: 3000 }],
        'WEBSOCKET_DISCONNECTED': [{ type: 'RECOVER_RUNTIME', risk: 'MEDIUM', maxRetries: 2 }],
      },
      'llm': {
        'UNRESPONSIVE':  [{ type: 'RETRY',           risk: 'LOW', maxRetries: 3, delayMs: 5000 }],
        'CRASHED':       [{ type: 'RECOVER_RUNTIME', risk: 'MEDIUM', maxRetries: 1 }],
        'TIMEOUT':       [{ type: 'RETRY',            risk: 'LOW',  maxRetries: 2, delayMs: 10000 }],
      },
    };
  }

  planRecovery(component, flags = {}) {
    const { name, failureType, retryCount = 0, lastError } = component;

    // Determine component key and failure type
    const compKey = this.normalizeComponent(name);
    const failure = this.normalizeFailureType(failureType ?? lastError);

    const actions = this.resolveActions(compKey, failure);

    // Respect max retries
    const cappedActions = actions.map(action => ({
      ...action,
      maxRetries: Math.min(action.maxRetries ?? this.maxRetries, this.maxRetries - retryCount),
    }));

    // Add safety guard for high-risk actions
    return cappedActions.map(action => {
      if (action.risk === 'HIGH' && !flags.forceHighRisk) {
        return { ...action, status: 'BLOCKED', blockReason: 'HIGH_RISK_REQUIRES_APPROVAL' };
      }
      return action;
    });
  }

  resolveActions(componentKey, failureType) {
    const compActions = this.actionRegistry[componentKey];
    if (!compActions) {
      // Default fallback actions for unknown components
      return [
        { type: 'RETRY', risk: 'LOW', maxRetries: 2, delayMs: 3000 },
        { type: 'RECOVER_RUNTIME', risk: 'MEDIUM', maxRetries: 1 },
      ];
    }

    const failureActions = compActions[failureType];
    if (!failureActions) {
      // Fallback to generic recovery for unknown failure types
      return [
        { type: 'RETRY', risk: 'LOW', maxRetries: 2, delayMs: 3000 },
      ];
    }

    return failureActions;
  }

  normalizeComponent(name) {
    if (!name) return 'unknown';
    const lower = name.toLowerCase();
    if (lower.includes('sqlite') || lower.includes('db') || lower.includes('database')) return 'database';
    if (lower.includes('index')) return 'index';
    if (lower.includes('cache')) return 'cache';
    if (lower.includes('runtime') || lower.includes('process') || lower.includes('llm')) return 'runtime';
    if (lower.includes('llm') || lower.includes('model')) return 'llm';
    return 'runtime';
  }

  normalizeFailureType(failureType) {
    if (!failureType) return 'UNKNOWN';
    const upper = failureType.toUpperCase();
    if (upper.includes('LOCK')) return 'LOCKED';
    if (upper.includes('CORRUPT')) return 'CORRUPTED';
    if (upper.includes('STALE') || upper.includes('OLD')) return 'STALE';
    if (upper.includes('MISSING') || upper.includes('NOT FOUND')) return 'MISSING';
    if (upper.includes('BROKEN') || upper.includes('INVALID')) return 'BROKEN';
    if (upper.includes('CRASH') || upper.includes('FATAL')) return 'CRASHED';
    if (upper.includes('STUCK') || upper.includes('HANG') || upper.includes('DEADLOCK')) return 'STUCK';
    if (upper.includes('TIMEOUT') || upper.includes('SLOW')) return 'TIMEOUT';
    if (upper.includes('OVERFLOW') || upper.includes('OOM') || upper.includes('MEMORY')) return 'OVERFLOW';
    if (upper.includes('DISCONNECT') || upper.includes('WEBSOCKET')) return 'WEBSOCKET_DISCONNECTED';
    if (upper.includes('UNRESPONSIVE') || upper.includes('NO_RESPONSE')) return 'UNRESPONSIVE';
    return 'UNKNOWN';
  }

  classifyFailure(errorMessage) {
    if (!errorMessage) return { component: 'unknown', failureType: 'UNKNOWN', confidence: 0 };

    const msg = errorMessage.toLowerCase();
    let component = 'runtime';
    let failureType = 'UNKNOWN';
    let confidence = 0.5;

    if (msg.includes('sqlite') || msg.includes('database is locked')) {
      component = 'database'; failureType = 'LOCKED'; confidence = 0.9;
    } else if (msg.includes('corrupt') || msg.includes('malformed')) {
      component = 'database'; failureType = 'CORRUPTED'; confidence = 0.85;
    } else if (msg.includes('broken') || msg.includes('index is corrupted')) {
      component = 'index'; failureType = 'BROKEN'; confidence = 0.8;
    } else if (msg.includes('cache') && (msg.includes('corrupt') || msg.includes('invalid'))) {
      component = 'cache'; failureType = 'CORRUPTED'; confidence = 0.8;
    } else if (msg.includes('cache') && (msg.includes('overflow') || msg.includes('too large'))) {
      component = 'cache'; failureType = 'OVERFLOW'; confidence = 0.75;
    } else if (msg.includes('stuck') || msg.includes('deadlock') || msg.includes('hang')) {
      component = 'runtime'; failureType = 'STUCK'; confidence = 0.7;
    } else if (msg.includes('timeout') || msg.includes('etimedout')) {
      component = 'runtime'; failureType = 'TIMEOUT'; confidence = 0.7;
    } else if (msg.includes('crash') || msg.includes('segfault') || msg.includes('fatal')) {
      component = 'runtime'; failureType = 'CRASHED'; confidence = 0.8;
    }

    return { component, failureType, confidence };
  }
}

export default RecoveryPlanner;