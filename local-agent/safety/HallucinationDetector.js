class HallucinationDetector {
  detect(code) {
    const fakePatterns = ['TODO: implement', 'FIXME', 'undefined variable', 'fake function'];
    return { isFake: fakePatterns.some(p => code.includes(p)), confidence: 0.8 };
  }
}
module.exports = { HallucinationDetector };