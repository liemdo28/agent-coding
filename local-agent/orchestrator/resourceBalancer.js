// orchestrator/resourceBalancer.js — balances CPU/memory across active sessions
// Phase 12: assigns resource budgets based on priority and activity

/**
 * Allocate CPU and memory budgets across sessions.
 * @param {object[]} sessions  — array of session objects with { sessionId, priority?, lastActivity?, healthScore? }
 * @param {number} totalCpu     — total CPU % available (e.g. 400 for 4 cores)
 * @param {number} totalMemoryMB
 * @returns {{ allocations: object[], unallocated: object }}
 */
export function allocateResources(sessions, totalCpu = 400, totalMemoryMB = 4096) {
  if (!sessions || sessions.length === 0) {
    return { allocations: [], unallocated: { cpu: totalCpu, memoryMB: totalMemoryMB } };
  }

  // Score each session for its share
  const scored = sessions.map(s => ({
    ...s,
    _score: computeSessionScore(s),
  }));

  const totalScore = scored.reduce((sum, s) => sum + s._score, 0);
  const allocations = scored.map(s => {
    const share  = totalScore > 0 ? s._score / totalScore : 1 / sessions.length;
    const cpu    = Math.floor(share * totalCpu);
    const memory = Math.floor(share * totalMemoryMB);
    return {
      sessionId: s.sessionId,
      projectId: s.projectId,
      cpu,
      memoryMB: memory,
      share:    +(share * 100).toFixed(1),
      priority: s.priority ?? 'normal',
    };
  });

  const usedCpu    = allocations.reduce((s, a) => s + a.cpu, 0);
  const usedMemory = allocations.reduce((s, a) => s + a.memoryMB, 0);

  return {
    allocations,
    unallocated: {
      cpu:      totalCpu - usedCpu,
      memoryMB: totalMemoryMB - usedMemory,
    },
  };
}

/**
 * Re-balance allocations based on current usage vs budget.
 * @param {object[]} sessions  — sessions with _currentCpu? and _currentMemoryMB?
 * @returns {{ allocations: object[], pressure: string, recommendations: string[] }}
 */
export function rebalance(sessions) {
  const result = allocateResources(sessions);
  const recommendations = [];
  let pressure = 'normal';

  for (const alloc of result.allocations) {
    const sess    = sessions.find(s => s.sessionId === alloc.sessionId);
    const curCpu  = sess?._currentCpu ?? 0;
    const curMem  = sess?._currentMemoryMB ?? 0;

    if (curCpu > alloc.cpu * 1.2) {
      recommendations.push(`Session ${alloc.sessionId}: CPU over-budget (${curCpu}% vs ${alloc.cpu}%)`);
      pressure = 'high';
    }
    if (curMem > alloc.memoryMB * 1.2) {
      recommendations.push(`Session ${alloc.sessionId}: Memory over-budget (${curMem}MB vs ${alloc.memoryMB}MB)`);
      pressure = 'high';
    }
  }

  if (sessions.length === 0) recommendations.push('No active sessions');

  return { allocations: result.allocations, pressure, recommendations };
}

/**
 * Return a resource usage report.
 * @param {object[]} sessions
 * @returns {{ allocations: object[], pressure: string, recommendations: string[] }}
 */
export function getResourceReport(sessions) {
  return rebalance(sessions);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeSessionScore(session) {
  const now      = Date.now();
  const lastAct  = new Date(session.lastActivity ?? 0).getTime();
  const idleSec  = (now - lastAct) / 1000;
  // More recently active → higher score
  const actScore = Math.max(0, 1 - idleSec / 3600); // drops to 0 after 1 hour

  const health   = session.healthScore ?? 0.5;
  const priority = session.priority === 'high' ? 1.5
    : session.priority === 'low' ? 0.5 : 1.0;

  return (actScore * 0.5 + health * 0.3 + 0.2) * priority;
}
