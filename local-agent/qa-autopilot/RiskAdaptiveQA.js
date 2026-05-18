class RiskAdaptiveQA {
  selectTests(risk) {
    if (risk === 'HIGH' || risk === 'CRITICAL') return ['unit', 'integration', 'e2e', 'security'];
    if (risk === 'MEDIUM') return ['unit', 'integration'];
    return ['unit'];
  }
}
module.exports = { RiskAdaptiveQA };
