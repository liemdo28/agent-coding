class PatchMergeEngine {
  merge(patches) { return patches.map(p => ({ id: p.patchId })); }
  detectConflicts() { return []; }
}
module.exports = { PatchMergeEngine };