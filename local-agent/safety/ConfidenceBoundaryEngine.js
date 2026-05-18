class ConfidenceBoundaryEngine {
  check(confidence) {
    if (confidence < 0.5) return { level: 'LOW', warning: 'Low confidence - verify manually' };
    if (confidence < 0.8) return { level: 'MEDIUM', warning: null };
    return { level: 'HIGH', warning: null };
  }
}
module.exports = { ConfidenceBoundaryEngine };