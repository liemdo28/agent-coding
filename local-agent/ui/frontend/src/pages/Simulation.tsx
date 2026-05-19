// @ts-nocheck
// pages/Simulation.jsx
// Slider controls + corp:simulate integration.
// Sliders affect the task description sent to corp:simulate.
// Output is streamed live via SSE from /api/run/:jobId/stream.

import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api.js';

const PRIORITY_LABELS = { 0: 'Low', 25: 'Normal', 50: 'High', 75: 'Critical', 100: 'Emergency' };
function nearestLabel(val) {
  const keys = Object.keys(PRIORITY_LABELS).map(Number);
  const closest = keys.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a);
  return PRIORITY_LABELS[closest];
}

const TEMPLATES = [
  { label: 'Fix bug payment',   task: 'Fix bug module thanh toán — lỗi timeout khi xử lý giao dịch lớn' },
  { label: 'Audit bảo mật',     task: 'Audit toàn bộ security compliance, kiểm tra lỗ hổng API và xác thực' },
  { label: 'Marketing Q3',      task: 'Lên kế hoạch marketing Q3 — chiến dịch social media và SEO local' },
  { label: 'Legal review',      task: 'Review hợp đồng pháp lý và kiểm tra tuân thủ GDPR' },
  { label: 'Deploy pipeline',   task: 'Thiết lập CI/CD pipeline cho môi trường staging và production' },
];

export default function Simulation() {
  const [priority, setPriority]   = useState(50);
  const [workers,  setWorkers]    = useState(100);
  const [batch,    setBatch]      = useState(4);
  const [task,     setTask]       = useState('');
  const [running,  setRunning]    = useState(false);
  const [lines,    setLines]      = useState([]);
  const [status,   setStatus]     = useState(null); // null | 'running' | 'done' | 'error'
  const [jobId,    setJobId]      = useState(null);
  const [slaAlert, setSlaAlert]   = useState(false);
  const cancelRef  = useRef(null);
  const bottomRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  // Detect SLA risk based on priority + batch settings
  useEffect(() => {
    setSlaAlert(priority >= 75 && batch >= 6);
  }, [priority, batch]);

  const buildTaskDescription = () => {
    const prioLabel = nearestLabel(priority);
    return [
      task.trim(),
      `[Priority: ${prioLabel} (${priority}%)]`,
      `[Workers: ${workers}%]`,
      `[Batch: ${batch}]`,
    ].join(' ');
  };

  const handleRun = async () => {
    const desc = buildTaskDescription();
    if (!desc.trim()) return;

    setRunning(true);
    setStatus('running');
    setLines([`[Simulation start — ${new Date().toLocaleTimeString('vi-VN')}]`]);
    setJobId(null);

    let jId;
    try {
      // Step 1: POST to start the job, get jobId back
      const data = await api.post('/run', {
        script: 'corp:simulate',
        label:  'Simulation',
        args:   ['--save', desc],
      });
      if (!data.jobId) throw new Error(data.error ?? 'No jobId returned');
      jId = data.jobId;
      setJobId(jId);
    } catch (err) {
      setLines((prev) => [...prev, `[Lỗi khởi động: ${err.message}]`]);
      setRunning(false);
      setStatus('error');
      return;
    }

    // Step 2: Connect to SSE stream for output
    const ctrl = new AbortController();
    cancelRef.current = () => ctrl.abort();

    try {
      const res = await fetch(`/api/run/${jId}/stream`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`Stream error ${res.status}`);
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop();
        for (const part of parts) {
          if (!part.startsWith('data:')) continue;
          try {
            const obj = JSON.parse(part.slice(5).trim());
            if (obj.line)  setLines((p) => [...p, obj.line]);
            if (obj.done) {
              setStatus(obj.exitCode === 0 ? 'done' : 'error');
              setRunning(false);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setLines((prev) => [...prev, `[Lỗi stream: ${err.message}]`]);
        setStatus('error');
      }
    }
    setRunning(false);
  };

  const handleStop = () => {
    cancelRef.current?.();
    if (jobId) fetch(`/api/run/${jobId}/stop`, { method: 'POST' });
    setRunning(false);
    setStatus('stopped');
  };

  // Live gradient color for priority slider
  const prioGradient = `linear-gradient(to right, var(--green) 0%, var(--yellow) 50%, var(--red) 100%)`;
  const prioThumbColor = priority < 40 ? 'var(--green)' : priority < 70 ? 'var(--yellow)' : 'var(--red)';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Simulation</h1>
        <div className="badge badge-offline" style={{ fontSize: 11 }}>corp:simulate</div>
      </div>

      {/* SLA Alert */}
      {slaAlert && (
        <div className="card" style={{ borderColor: 'var(--red)', background: 'rgba(248,81,73,0.07)', marginBottom: 14, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--red)', fontSize: 13 }}>SLA Risk Alert</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Priority ≥ 75% + Batch ≥ 6 — nguy cơ vi phạm SLA. Cân nhắc giảm batch size hoặc tăng workers.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Controls panel */}
        <div style={{ flex: '0 0 340px', minWidth: 0 }}>
          <div className="card">
            <div className="card-title">Simulation Controls</div>

            {/* Priority slider */}
            <div className="sim-slider-group">
              <div className="sim-slider-header">
                <label className="sim-slider-label">Priority Weight</label>
                <span className="sim-slider-val" style={{ color: prioThumbColor }}>
                  {priority}% — <strong>{nearestLabel(priority)}</strong>
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ height: 4, borderRadius: 2, background: prioGradient, marginBottom: 6 }} />
                <input
                  type="range" min="0" max="100" value={priority}
                  className="sim-range"
                  onChange={(e) => setPriority(Number(e.target.value))}
                  style={{ '--pct': `${priority}%` }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>Low</span><span>Normal</span><span>High</span><span>Critical</span><span>Emergency</span>
              </div>
            </div>

            {/* Workers slider */}
            <div className="sim-slider-group">
              <div className="sim-slider-header">
                <label className="sim-slider-label">Worker Allocation</label>
                <span className="sim-slider-val" style={{ color: workers < 50 ? 'var(--red)' : workers > 150 ? 'var(--green)' : 'var(--text)' }}>
                  {workers}%
                </span>
              </div>
              <input
                type="range" min="1" max="200" value={workers}
                className="sim-range"
                onChange={(e) => setWorkers(Number(e.target.value))}
                style={{ '--pct': `${workers / 2}%` }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>1%</span><span>50%</span><span>100%</span><span>150%</span><span>200%</span>
              </div>
            </div>

            {/* Batch slider */}
            <div className="sim-slider-group">
              <div className="sim-slider-header">
                <label className="sim-slider-label">Batch Size</label>
                <span className="sim-slider-val" style={{ color: batch >= 6 ? 'var(--yellow)' : 'var(--text)' }}>
                  {batch} {batch >= 6 ? '⚠' : ''}
                </span>
              </div>
              <input
                type="range" min="1" max="8" value={batch}
                className="sim-range"
                onChange={(e) => setBatch(Number(e.target.value))}
                style={{ '--pct': `${((batch - 1) / 7) * 100}%` }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                {[1,2,3,4,5,6,7,8].map(n => <span key={n}>{n}</span>)}
              </div>
            </div>

            {/* Task description */}
            <div style={{ marginTop: 16 }}>
              <label className="sim-slider-label" style={{ display: 'block', marginBottom: 6 }}>Task Description</label>
              <textarea
                className="chat-input"
                style={{ width: '100%', minHeight: 72, maxHeight: 120, resize: 'vertical' }}
                placeholder="Nhập task cần điều phối qua các division..."
                value={task}
                onChange={(e) => setTask(e.target.value)}
                disabled={running}
              />
            </div>

            {/* Templates */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Quick templates:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    className="btn btn-sm"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => setTask(tpl.task)}
                    disabled={running}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generated request preview */}
            <div style={{ marginTop: 14, padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius)', fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', lineHeight: 1.55 }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 10, textTransform: 'uppercase' }}>Preview request:</div>
              {buildTaskDescription() || <em>Nhập task description...</em>}
            </div>

            {/* Run / Stop */}
            <div style={{ marginTop: 14 }}>
              {running ? (
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleStop}>
                  ⏹ Dừng simulation
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={handleRun}
                  disabled={!task.trim()}
                >
                  ▶ Chạy Simulation
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Output panel */}
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="card" style={{ height: 520, display: 'flex', flexDirection: 'column', padding: 0 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                Output
                {status === 'running' && <span className="badge badge-warn" style={{ marginLeft: 8, fontSize: 10 }}>Đang chạy</span>}
                {status === 'done'    && <span className="badge badge-pass" style={{ marginLeft: 8, fontSize: 10 }}>Hoàn thành</span>}
                {status === 'error'   && <span className="badge badge-fail" style={{ marginLeft: 8, fontSize: 10 }}>Lỗi</span>}
              </span>
              {lines.length > 0 && (
                <button className="btn btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setLines([])}>
                  Xóa
                </button>
              )}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}>
              {lines.length === 0 && (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>
                  Chọn slider + task rồi nhấn <strong>Chạy Simulation</strong>
                </div>
              )}
              {lines.map((line, i) => (
                <div key={i} style={{
                  color: line.startsWith('[Lỗi') ? 'var(--red)'
                       : line.includes('✓') || line.includes('success') || line.includes('done') ? 'var(--green)'
                       : line.includes('warn') || line.includes('⚠') ? 'var(--yellow)'
                       : line.startsWith('[Simulation') ? 'var(--purple)'
                       : 'var(--text)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {line}
                </div>
              ))}
              {status === 'running' && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, color: 'var(--purple)' }}>
                  <div className="spinner" /> Đang xử lý...
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Stats overlay — shows slider values as visual cards */}
          <div className="card-grid" style={{ marginTop: 12 }}>
            <div className="card" style={{ padding: '10px 14px', textAlign: 'center', borderColor: prioThumbColor }}>
              <div className="stat-label">Priority</div>
              <div className="stat-value" style={{ color: prioThumbColor, fontSize: 22, fontWeight: 700 }}>{priority}%</div>
              <div style={{ fontSize: 11, color: prioThumbColor }}>{nearestLabel(priority)}</div>
            </div>
            <div className="card" style={{ padding: '10px 14px', textAlign: 'center' }}>
              <div className="stat-label">Workers</div>
              <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, color: workers < 50 ? 'var(--red)' : 'var(--green)' }}>{workers}%</div>
            </div>
            <div className="card" style={{ padding: '10px 14px', textAlign: 'center', borderColor: batch >= 6 ? 'var(--yellow)' : 'var(--border)' }}>
              <div className="stat-label">Batch</div>
              <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, color: batch >= 6 ? 'var(--yellow)' : 'var(--text)' }}>{batch}</div>
              {batch >= 6 && <div style={{ fontSize: 11, color: 'var(--yellow)' }}>SLA Risk</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
