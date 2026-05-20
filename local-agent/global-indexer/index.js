// Global Indexer CLI entry point
import { GlobalFileIndexer } from './GlobalFileIndexer.js';

const indexer = new GlobalFileIndexer();
const action = process.argv[2] || 'scan';

switch (action) {
  case 'scan':
    console.log('[GlobalIndexer] Starting global scan...');
    await indexer.scan();
    const stats = indexer.getStats();
    console.log('[GlobalIndexer] Stats:', JSON.stringify(stats, null, 2));
    break;
  case 'stats':
    const loaded = indexer.loadIndex();
    if (loaded) {
      console.log('[GlobalIndexer] Loaded index:', JSON.stringify(indexer.getStats(), null, 2));
    } else {
      console.log('[GlobalIndexer] No index found. Run "scan" first.');
    }
    break;
  case 'search':
    const query = process.argv[3];
    if (!query) {
      console.log('[GlobalIndexer] Usage: indexer search <query>');
      break;
    }
    const idx = indexer.loadIndex();
    if (idx) indexer.index = idx;
    const results = indexer.searchProjects(query);
    console.log(`[GlobalIndexer] Found ${results.length} projects for "${query}":`);
    results.forEach(p => console.log(`  - ${p.name} (${p.type}) @ ${p.path}`));
    break;
  default:
    console.log('[GlobalIndexer] Usage: node index.js [scan|stats|search <query>]');
}