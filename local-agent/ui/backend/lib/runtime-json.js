import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, copyFileSync } from 'fs';
import { dirname } from 'path';

const writeQueues = new Map();

export function readJsonSafe(path, fallback) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    const backup = `${path}.bak`;
    try {
      if (existsSync(backup)) return JSON.parse(readFileSync(backup, 'utf8'));
    } catch {
      // Fall through to fallback when both primary and backup are unusable.
    }
    return fallback;
  }
}

export function writeJsonAtomic(path, value) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  if (existsSync(path)) {
    try { copyFileSync(path, `${path}.bak`); } catch { /* backup is best effort */ }
  }

  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  renameSync(tmp, path);
}

export function enqueueJsonWrite(path, mutator, fallback) {
  const previous = writeQueues.get(path) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(() => {
      const current = readJsonSafe(path, fallback);
      const updated = mutator(current);
      writeJsonAtomic(path, updated);
      return updated;
    });
  writeQueues.set(path, next.finally(() => {
    if (writeQueues.get(path) === next) writeQueues.delete(path);
  }));
  return next;
}
