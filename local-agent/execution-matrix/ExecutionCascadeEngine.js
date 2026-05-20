// local-agent/execution-matrix/ExecutionCascadeEngine.js
export class ExecutionCascadeEngine {
  constructor() {}

  predictCascade(taskId, matrix) {
    // Traverse the graph from taskId to find cascading impacts
    const visited = new Set([taskId]);
    const cascade = [];
    const queue = [taskId];

    while (queue.length > 0) {
      const current = queue.shift();
      const outbound = matrix.dependencies.filter(d => d.source === current);
      
      for (const dep of outbound) {
        if (!visited.has(dep.target)) {
          visited.add(dep.target);
          queue.push(dep.target);
          
          const targetTask = matrix.tasks.find(t => t.id === dep.target);
          cascade.push({
            taskId: dep.target,
            taskName: targetTask?.name,
            reason: dep.type === 'blocks' ? 'Starvation Risk' : 'Resource Contention',
            predictedImpact: targetTask?.impact?.business
          });
        }
      }
    }

    return {
      sourceTask: taskId,
      blastRadius: cascade.length,
      cascadeSteps: cascade
    };
  }
}
