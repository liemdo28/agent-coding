// local-agent/replay/ReplayEngine.js
// Phase 108 — Reality Reconstruction
// Reconstructs an ordered event stream for a past time window by merging
// KPI task records with timeline events.

import { existsSync, readFileSync,
         writeFileSync, mkdirSync }  from 'fs';
import { resolve, join, dirname }    from 'path';
import { fileURLToPath }             from 'url';
import { randomUUID }                from 'crypto';
import { detectGaps }                from './TimelineGapDetector.js';

const ROOT      = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const KPI_DIR   = resolve(ROOT, '.super-agent-fullauto-kpi');
const REPLAY_DIR = resolve(ROOT, '.local-agent', 'replays');

function loadJSON(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function toMs(ts) { return new Date(ts).getTime(); }

export class ReplayEngine {
  /**
   * @param {object} options
   * @param {string} [options.kpiPath]      path to .super-agent-fullauto-kpi/
   * @param {string} [options.replayDir]    path to replays/ directory
   * @param {string} [options.timelineRoot] workspace root for TimelineStore (optional)
   */
  constructor(options = {}) {
    this.kpiPath     = options.kpiPath     ?? KPI_DIR;
    this.replayDir   = options.replayDir   ?? REPLAY_DIR;
    this.timelineRoot = options.timelineRoot ?? ROOT;
    mkdirSync(this.replayDir, { recursive: true });
  }

  /**
   * Build a ReplaySession for the given time window.
   * Sources events from KPI task records; optionally merges TimelineStore events.
   *
   * @param {string|Date} from  — ISO8601 or Date
   * @param {string|Date} to    — ISO8601 or Date
   * @returns {ReplaySession}
   */
  buildSession(from, to) {
    const fromMs = toMs(from instanceof Date ? from.toISOString() : from);
    const toMs_  = toMs(to   instanceof Date ? to.toISOString()   : to);

    const tasks  = loadJSON(resolve(this.kpiPath, 'execution_summary.json')) ?? [];

    // Build events from task records.
    const events = [];
    for (const t of tasks) {
      const startMs = t.started_at ? toMs(t.started_at) : null;
      if (!startMs || startMs < fromMs || startMs > toMs_) continue;

      // Task-start event
      events.push({ ts: t.started_at, type: 'task_start',
                    payload: { task_id: t.task_id, company: t.company,
                               priority: t.priority, worker: t.assigned_worker } });

      // Completion/failure event (estimated: start + duration)
      if (t.duration_h != null) {
        const endMs  = startMs + t.duration_h * 3600_000;
        const endTs  = new Date(endMs).toISOString();
        const type   = t.dev_status === 'DEV_FAILED' ? 'task_failed' : 'task_done';
        events.push({ ts: endTs, type,
                      payload: { task_id: t.task_id, dev_status: t.dev_status,
                                 sla_breach: t.sla_breach } });
      }

      if (t.sla_breach) {
        events.push({ ts: t.started_at, type: 'sla_breach',
                      payload: { task_id: t.task_id, priority: t.priority, company: t.company } });
      }
    }

    // Try to load TimelineStore events if available.
    const timelineEvents = this._loadTimelineEvents(fromMs, toMs_);
    events.push(...timelineEvents);

    // Sort ascending by ts.
    events.sort((a, b) => toMs(a.ts) - toMs(b.ts));

    // Assign sequential causal parent stubs (same-worker task chains).
    const workerLast = {};
    for (const e of events) {
      const w = e.payload?.worker;
      if (w) {
        if (workerLast[w]) e.causal_parent = workerLast[w];
        workerLast[w] = e.ts;
      }
    }

    const gaps = detectGaps(events, 300_000);
    const failures = events.filter((e) => e.type === 'task_failed' || e.type === 'sla_breach').length;
    const breaches = events.filter((e) => e.type === 'sla_breach').length;

    return {
      id:     randomUUID(),
      window: { from: from instanceof Date ? from.toISOString() : from,
                to:   to   instanceof Date ? to.toISOString()   : to },
      events,
      kpi_snapshot: loadJSON(resolve(this.kpiPath, 'analytics.json')) ?? {},
      summary: {
        total_events:   events.length,
        failure_events: failures,
        sla_breaches:   breaches,
        timeline_gaps:  gaps,
      },
    };
  }

  /**
   * Persist a session to disk.
   *
   * @param {object} session
   * @returns {{ path: string }}
   */
  saveSession(session) {
    const path = join(this.replayDir, `${session.id}.json`);
    writeFileSync(path, JSON.stringify(session, null, 2), 'utf8');
    return { path };
  }

  /**
   * Load a previously saved session.
   *
   * @param {string} sessionId
   * @returns {object|null}
   */
  loadSession(sessionId) {
    const path = join(this.replayDir, `${sessionId}.json`);
    return loadJSON(path);
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _loadTimelineEvents(fromMs, toMs_) {
    const timelinePath = resolve(this.timelineRoot, '.local-agent', 'timeline.jsonl');
    if (!existsSync(timelinePath)) return [];

    try {
      return readFileSync(timelinePath, 'utf8')
        .split('\n').filter(Boolean)
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter((e) => {
          if (!e?.ts) return false;
          const ms = toMs(e.ts);
          return ms >= fromMs && ms <= toMs_;
        })
        .map((e) => ({ ts: e.ts, type: e.type ?? 'timeline_event', payload: e }));
    } catch { return []; }
  }
}
