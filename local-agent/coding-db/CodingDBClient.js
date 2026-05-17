// coding-db/CodingDBClient.js - HTTP client for optional local Coding DB service
import { assertLocalUrl } from '../security/OfflineGuard.js';

const DEFAULT_PORTS = [7341, 8765];
const TIMEOUT_MS = 5000;

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    assertLocalUrl(url);
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function detectCodingDB() {
  for (const port of DEFAULT_PORTS) {
    const url = `http://localhost:${port}`;
    try {
      const res = await fetchWithTimeout(`${url}/health`, {}, 2000);
      if (res.ok) return { available: true, port, url };
    } catch {
      // not running on this port
    }
  }
  return { available: false };
}

export async function searchRemote(query, url) {
  try {
    const res = await fetchWithTimeout(`${url}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getStatus(workspaceRoot) {
  const { getDbPath } = await import('./CodingKnowledgeDB.js');
  const { existsSync } = await import('fs');
  const remote = await detectCodingDB();
  const dbPath = getDbPath(workspaceRoot);
  return {
    localDb: existsSync(dbPath),
    remoteService: remote.available,
    port: remote.port ?? null,
    url: remote.url ?? null,
    dbPath,
  };
}
