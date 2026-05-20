/* src/memory/UniversalMemoryCore.js */
class UniversalMemoryCore {
  constructor() {
    this.log = [];
    this.indexes = {
      patches: new Map(),
      architectures: new Map(),
      decisions: new Map(),
      failures: new Map(),
      optimizations: new Map()
    };
  }

  // Append a record to the log and update indexes
  appendRecord(type, id, data) {
    const entry = { timestamp: Date.now(), type, id, data };
    this.log.push(entry);
    if (this.indexes[type]) {
      this.indexes[type].set(id, entry);
    }
    return entry;
  }

  // Query by type and optional filter function
  query(type, filterFn = null) {
    const collection = this.indexes[type];
    if (!collection) return [];
    const results = [];
    for (const [id, entry] of collection.entries()) {
      if (!filterFn || filterFn(entry)) {
        results.push(entry);
      }
    }
    return results;
  }

  // Export entire log (for snapshot)
  exportLog() {
    return JSON.stringify(this.log);
  }
}

export default UniversalMemoryCore;
