// logs/TimelineBuilder.js - Build timeline events from log files

import { readFileSync } from 'fs';
import { analyzeLogContent } from './LogAnalyzer.js';

/**
 * Extract timestamped events from log content.
 * @param {string} content - Raw log content
 * @param {string} sourcePath - Source file path
 * @returns {{ events: TimelineEvent[], timeRange: TimeRange, summary: object }}
 */
export function buildTimelineFromContent(content, sourcePath = '') {
  const { entries } = analyzeLogContent(content, sourcePath);

  const events = [];
  const timeRange = { start: null, end: null };

  for (const entry of entries) {
    if (!entry.timestamp) continue;

    const ts = new Date(entry.timestamp).getTime();
    if (!timeRange.start || ts < new Date(timeRange.start).getTime()) {
      timeRange.start = entry.timestamp;
    }
    if (!timeRange.end || ts > new Date(timeRange.end).getTime()) {
      timeRange.end = entry.timestamp;
    }

    events.push({
      timestamp: entry.timestamp,
      ms: ts,
      level: entry.level,
      message: entry.message,
      source: sourcePath,
      lineNum: entry.lineNum,
      type: classifyEvent(entry),
    });
  }

  // Sort by timestamp
  events.sort((a, b) => a.ms - b.ms);

  // Group into phases
  const phases = groupIntoPhases(events);

  return {
    events,
    timeRange,
    phaseCount: phases.length,
    phases,
    summary: buildTimelineSummary(events, timeRange),
  };
}

/**
 * Classify a log entry into an event type.
 */
function classifyEvent(entry) {
  const msg = entry.message.toLowerCase();
  const lvl = entry.level;

  if (lvl === 'error' || lvl === 'fatal' || lvl === 'critical') {
    if (/timeout|timed? ?out|connection/i.test(msg))  return 'timeout_error';
    if (/auth|permission|denied|forbidden/i.test(msg)) return 'auth_error';
    if (/not found|404|missing/i.test(msg))            return 'notfound_error';
    if (/syntax|parse|invalid.*json|unexpected/i.test(msg)) return 'parse_error';
    if (/import|module|require/i.test(msg))           return 'import_error';
    return 'general_error';
  }

  if (lvl === 'warn') {
    if (/deprecated/i.test(msg))  return 'deprecation_warn';
    if (/memory|heap|cpu/i.test(msg)) return 'resource_warn';
    return 'general_warn';
  }

  // Info-level events that signal lifecycle
  if (/starting|started|initializing|boot/i.test(msg)) return 'startup';
  if (/ready|listening|started.*port|server.*up/i.test(msg)) return 'ready';
  if (/shutting down|stopping|exiting|shutdown/i.test(msg)) return 'shutdown';
  if (/build|bundle|compile|transpile/i.test(msg)) return 'build';
  if (/test|running.*spec|jest|mocha|vitest/i.test(msg)) return 'test';
  if (/deploy|deployed|push|release/i.test(msg)) return 'deploy';
  if (/request|response|api|http/i.test(msg)) return 'http_event';

  return 'info';
}

/**
 * Group events into logical phases.
 */
function groupIntoPhases(events) {
  if (!events.length) return [];

  const phases = [];
  let currentPhase = null;

  for (const event of events) {
    if (!currentPhase || currentPhase.type !== event.type) {
      if (currentPhase) phases.push(currentPhase);
      currentPhase = {
        type: event.type,
        startTime: event.timestamp,
        startMs: event.ms,
        events: [event],
        errorCount: event.level === 'error' ? 1 : 0,
        warnCount: event.level === 'warn' ? 1 : 0,
      };
    } else {
      currentPhase.events.push(event);
      if (event.level === 'error') currentPhase.errorCount++;
      if (event.level === 'warn')  currentPhase.warnCount++;
    }
  }

  if (currentPhase) {
    currentPhase.endTime = events[events.length - 1].timestamp;
    currentPhase.endMs   = events[events.length - 1].ms;
    currentPhase.durationMs = currentPhase.endMs - currentPhase.startMs;
    phases.push(currentPhase);
  }

  return phases;
}

/**
 * Build a summary of the timeline.
 */
function buildTimelineSummary(events, timeRange) {
  const byType = {};
  for (const e of events) {
    byType[e.type] = (byType[e.type] || 0) + 1;
  }

  const errors = events.filter((e) => e.level === 'error').length;
  const warns  = events.filter((e) => e.level === 'warn').length;

  let durationMs = 0;
  if (timeRange.start && timeRange.end) {
    durationMs = new Date(timeRange.end).getTime() - new Date(timeRange.start).getTime();
  }

  return {
    totalEvents: events.length,
    errors,
    warns,
    durationMs,
    byType,
  };
}

/**
 * Build a combined timeline from multiple log files.
 */
export function buildCombinedTimeline(logFileResults) {
  const allEvents = [];
  const timeRange = { start: null, end: null };

  for (const result of logFileResults) {
    const { events } = buildTimelineFromContent(result.content, result.source);
    allEvents.push(...events);
  }

  allEvents.sort((a, b) => a.ms - b.ms);

  if (allEvents.length > 0) {
    timeRange.start = allEvents[0].timestamp;
    timeRange.end   = allEvents[allEvents.length - 1].timestamp;
  }

  const phases = groupIntoPhases(allEvents);

  return {
    events: allEvents,
    timeRange,
    phases,
    summary: buildTimelineSummary(allEvents, timeRange),
    fileCount: logFileResults.length,
  };
}