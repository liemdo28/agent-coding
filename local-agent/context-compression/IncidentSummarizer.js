/**
 * Phase 54 - Incident Summarizer
 * Summarize incidents and errors for quick context
 */
const fs = require('fs');
const path = require('path');

class IncidentSummarizer {
  constructor() {
    this.maxIncidents = 50;
  }

  /**
   * Summarize incidents
   */
  summarize(incidents, options = {}) {
    const { maxIncidents = 30, groupByType = true } = options;

    const sorted = this.sortBySeverity(incidents);
    const top = sorted.slice(0, maxIncidents);

    const summary = {
      total: incidents.length,
      incidents: top.map(i => this.summarizeIncident(i)),
      bySeverity: this.groupBySeverity(incidents),
      byStatus: this.groupByStatus(incidents),
      summary: this.generateSummary(incidents)
    };

    if (groupByType) {
      summary.byType = this.groupByType(incidents);
    }

    return summary;
  }

  /**
   * Sort incidents by severity
   */
  sortBySeverity(incidents) {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
    return [...incidents].sort((a, b) => {
      const orderA = severityOrder[a.severity] ?? 5;
      const orderB = severityOrder[b.severity] ?? 5;
      return orderA - orderB;
    });
  }

  /**
   * Summarize a single incident
   */
  summarizeIncident(incident) {
    return {
      id: incident.id || incident.incidentId,
      type: incident.type || incident.errorType,
      severity: incident.severity,
      status: incident.status || 'open',
      summary: incident.summary || incident.message?.slice(0, 100) || 'No summary',
      affectedFiles: incident.affectedFiles?.slice(0, 5) || [],
      occurrenceCount: incident.occurrenceCount || 1,
      firstSeen: incident.firstSeen || incident.createdAt,
      lastSeen: incident.lastSeen || incident.updatedAt
    };
  }

  /**
   * Group incidents by severity
   */
  groupBySeverity(incidents) {
    const groups = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [], INFO: [] };
    for (const i of incidents) {
      const sev = i.severity || 'INFO';
      if (groups[sev]) groups[sev].push(i);
    }
    return Object.entries(groups)
      .filter(([, arr]) => arr.length > 0)
      .reduce((acc, [sev, arr]) => {
        acc[sev] = { count: arr.length, ids: arr.map(i => i.id || i.incidentId) };
        return acc;
      }, {});
  }

  /**
   * Group incidents by status
   */
  groupByStatus(incidents) {
    const groups = {};
    for (const i of incidents) {
      const status = i.status || 'open';
      if (!groups[status]) groups[status] = [];
      groups[status].push(i.id || i.incidentId);
    }
    return Object.entries(groups)
      .reduce((acc, [status, ids]) => {
        acc[status] = { count: ids.length };
        return acc;
      }, {});
  }

  /**
   * Group incidents by type
   */
  groupByType(incidents) {
    const groups = {};
    for (const i of incidents) {
      const type = i.type || i.errorType || 'unknown';
      if (!groups[type]) groups[type] = [];
      groups[type].push(i.id || i.incidentId);
    }
    return Object.entries(groups)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .reduce((acc, [type, ids]) => {
        acc[type] = { count: ids.length };
        return acc;
      }, {});
  }

  /**
   * Generate text summary
   */
  generateSummary(incidents) {
    const bySev = this.groupBySeverity(incidents);
    const critical = bySev.CRITICAL?.count || 0;
    const high = bySev.HIGH?.count || 0;
    const medium = bySev.MEDIUM?.count || 0;

    let status = 'Healthy';
    if (critical > 0) status = 'Critical incidents active';
    else if (high > 0) status = 'High severity incidents active';
    else if (medium > 0) status = 'Medium severity issues';

    return {
      total: incidents.length,
      status,
      criticalCount: critical,
      highCount: high,
      mediumCount: medium
    };
  }
}

module.exports = { IncidentSummarizer };