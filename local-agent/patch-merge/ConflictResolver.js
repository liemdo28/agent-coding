class ConflictResolver {
  resolve(a, b) { return { winner: 'a', reason: 'first patch' }; }
}
module.exports = { ConflictResolver };