// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

export default function RuntimeMonitor() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMetrics = async () => {
    try {
      const res = await api.get('/metrics');
      setMetrics(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const getSystemStatus = () => {
    if (!metrics) return 'unknown';
    if (metrics.cpuUsage > 80 || (metrics.memoryUsage?.rss / (1024 * 1024) > 400)) return 'high-load';
    return 'healthy';
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title neon-text-cyan">Runtime Monitor</h1>
          <p className="text-muted text-sm mt-1">Real-time telemetry and resource usage statistics of the local agent host server.</p>
        </div>
        {metrics && (
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded">
            <span className={`h-2 w-2 rounded-full ${getSystemStatus() === 'healthy' ? 'pulse-green' : 'pulse-orange'}`} />
            <span className="text-xs font-mono font-bold capitalize text-slate-200">
              Host Status: {getSystemStatus()}
            </span>
          </div>
        )}
      </div>

      {error && <div className="card border-red-500/50 text-red-400 bg-red-950/20">{error}</div>}

      {loading && !metrics ? (
        <div className="loading-row"><div className="spinner" />Connecting telemetry...</div>
      ) : (
        <div className="space-y-6">
          {/* Main Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="neon-card">
              <div className="text-xs text-muted font-semibold uppercase mb-1">RSS Memory Usage</div>
              <div className="text-2xl font-bold font-mono text-cyan-400">
                {metrics.memoryUsage?.rss ? `${(metrics.memoryUsage.rss / (1024 * 1024)).toFixed(1)} MB` : 'N/A'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                Heap: {(metrics.memoryUsage?.heapUsed / (1024 * 1024)).toFixed(1)}MB / External: {(metrics.memoryUsage?.external / (1024 * 1024)).toFixed(1)}MB
              </div>
            </div>

            <div className="neon-card">
              <div className="text-xs text-muted font-semibold uppercase mb-1">Process CPU Usage</div>
              <div className="text-2xl font-bold font-mono text-green-400">
                {metrics.cpuUsage != null ? `${metrics.cpuUsage.toFixed(2)}%` : '0.00%'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                User CPU: {metrics.cpuSystemTime ? `${(metrics.cpuSystemTime / 1000).toFixed(1)}s` : '0s'}
              </div>
            </div>

            <div className="neon-card">
              <div className="text-xs text-muted font-semibold uppercase mb-1">System Uptime</div>
              <div className="text-2xl font-bold font-mono text-purple-400">
                {formatUptime(metrics.uptime)}
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                PID: {metrics.pid || '—'} | Node: {metrics.nodeVersion || '—'}
              </div>
            </div>
          </div>

          {/* HTTP Telemetry details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="neon-card">
              <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-1.5">
                <span>🌐</span> API Endpoint Load
              </h3>
              <div className="grid grid-cols-2 gap-4 text-center border border-slate-800 rounded p-4 bg-slate-900/30">
                <div>
                  <div className="text-lg font-bold font-mono text-cyan-400">{metrics.totalRequests || 0}</div>
                  <div className="text-xs text-muted">Total Requests</div>
                </div>
                <div>
                  <div className="text-lg font-bold font-mono text-green-400">
                    {metrics.requestRate ? `${metrics.requestRate.toFixed(1)}/s` : '0.0/s'}
                  </div>
                  <div className="text-xs text-muted">Req Frequency</div>
                </div>
              </div>
            </div>

            <div className="neon-card flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-1.5">
                  <span>🛡️</span> Security & Sandbox State
                </h3>
                <div className="text-xs space-y-2 text-slate-400 font-mono">
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span>Offline Mode Gate:</span>
                    <span className="text-green-400 font-bold">100% OFFLINE</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span>Disk Access Scope:</span>
                    <span className="text-cyan-400">/Users/liemdo/</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1">
                    <span>Telemetry Output:</span>
                    <span className="text-red-400 font-bold">DISABLED</span>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-muted italic mt-4">
                Powered by Local AI Engineering OS Sandbox.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
