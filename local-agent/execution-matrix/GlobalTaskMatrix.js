// local-agent/execution-matrix/GlobalTaskMatrix.js
export class GlobalTaskMatrix {
  constructor() {}

  buildMatrix() {
    // Generate a graph of tasks and their cross-project dependencies
    const tasks = [
      { id: 'task-100', name: 'Migrate DB to Postgres', status: 'in-progress', impact: { infra: 'high', business: 'critical', org: 'high' } },
      { id: 'task-101', name: 'Update Auth Schema', status: 'pending', impact: { infra: 'medium', business: 'high', org: 'medium' } },
      { id: 'task-102', name: 'Deploy new UI components', status: 'pending', impact: { infra: 'low', business: 'medium', org: 'low' } },
      { id: 'task-103', name: 'Scale websocket workers', status: 'in-progress', impact: { infra: 'high', business: 'medium', org: 'low' } },
      { id: 'task-104', name: 'Update Dashboard API', status: 'pending', impact: { infra: 'medium', business: 'high', org: 'medium' } }
    ];

    const dependencies = [
      { source: 'task-100', target: 'task-101', type: 'blocks' },
      { source: 'task-101', target: 'task-104', type: 'blocks' },
      { source: 'task-100', target: 'task-103', type: 'competes-for-resources' }
    ];

    return { tasks, dependencies };
  }
}
