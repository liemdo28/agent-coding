// timeline/TimelineStore.js — append-only JSONL event store for source timeline
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const STORE_FILE = '.local-agent/timeline.jsonl';

export function appendEvent(workspaceRoot, type, payload) {
  mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
  const entry = { ts: new Date().toISOString(), type, ...payload };
  appendFileSync(join(workspaceRoot, STORE_FILE), JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

export function queryEvents(workspaceRoot, { type, file, limit = 200, since } = {}) {
  const p = join(workspaceRoot, STORE_FILE);
  if (!existsSync(p)) return [];
  const sinceMs = since ? new Date(since).getTime() : 0;
  return readFileSync(p, 'utf8')
    .split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((e) => e &&
      (!type  || e.type  === type)  &&
      (!file  || e.file  === file)  &&
      (!since || new Date(e.ts).getTime() >= sinceMs))
    .slice(-limit);
}
