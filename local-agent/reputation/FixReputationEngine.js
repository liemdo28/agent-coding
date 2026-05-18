class FixReputationEngine {
  track(fixId, success) {
    return { fixId, success, score: success ? 1 : -1 };
  }
  getScore(fixId) { return { fixId, score: 0.8 }; }
}
module.exports = { FixReputationEngine };