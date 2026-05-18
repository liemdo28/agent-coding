class WorkflowReliabilityTracker {
  track(workflowId, success) {
    return { workflowId, success, reliability: success ? 1 : 0 };
  }
}
module.exports = { WorkflowReliabilityTracker };