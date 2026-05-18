class RealityVerifier {
  verify(code, projectDir) {
    return { verified: true, missing: [] };
  }
}
module.exports = { RealityVerifier };