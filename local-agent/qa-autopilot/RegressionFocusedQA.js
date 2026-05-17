class RegressionFocusedQA {
  getRegressionTests(patch) {
    const files = patch.filesChanged || [];
    return { critical: files.filter(f => ['api', 'auth', 'core'].some(k => f.includes(k))), shared: [] };
  }
}
module.exports = { RegressionFocusedQA };