// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { t } from '../i18n/index.js';

const TABS = [
  { id: 'twin', label: 'Digital Twin' },
  { id: 'companies', label: 'Companies' },
  { id: 'projects', label: 'Projects' },
  { id: 'tasks', label: 'Active Tasks' },
  { id: 'simulation', label: 'Simulation' },
];

const RISK = {
  safe:   { label: 'Safe',   color: '#3fb950' },
  warn:   { label: 'Warn',   color: '#d29922' },
  alert:  { label: 'Alert',  color: '#ff8c42' },
  danger: { label: 'Danger', color: '#f85149' },
};

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, normal: 3, low: 4 };

function riskMeta(band) {
  return RISK[band] ?? RISK.safe;
}

function pct(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function sortTasks(tasks, sortKey) {
  return [...tasks].sort((a, b) => {
    if (sortKey === 'priority') return (PRIORITY_ORDER[a.priority] ?? 5) - (PRIORITY_ORDER[b.priority] ?? 5);
    if (sortKey === 'risk') return b.riskScore - a.riskScore;
    if (sortKey === 'batch') return a.batch.localeCompare(b.batch);
    return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
  });
}

function StatCard({ label, value, tone = 'blue', detail }) {
  return (
    <div className={`dt-stat dt-stat-${tone}`}>
      <div className="dt-stat-value">{value}</div>
      <div className="dt-stat-label">{label}</div>
      {detail && <div className="dt-stat-detail">{detail}</div>}
    </div>
  );
}

function RiskPill({ band, value }) {
  const meta = riskMeta(band);
  return (
    <span className="dt-risk-pill" style={{ '--risk': meta.color }}>
      {meta.label}{value !== undefined ? ` ${pct(value)}` : ''}
    </span>
  );
}

function Tooltip({ item, type }) {
  if (!item) return null;
  const risk = item.predictedRisk ?? item.riskScore ?? 0;
  return (
    <div className="dt-tooltip">
      <div className="dt-tooltip-title">{item.name ?? item.title ?? item.id}</div>
      <div>SLA risk: <strong>{pct(risk)}</strong></div>
      {type === 'company' && (
        <>
          <div>Batch: {item.currentBatch}</div>
          <div>High priority: {item.highPriorityTasks}</div>
          <div>QA fail rate: {pct(item.qaFailRate)}</div>
          <div>Workers: {item.workerPool}</div>
        </>
      )}
      {type === 'batch' && (
        <>
          <div>Tasks: {item.taskCount}</div>
          <div>High priority: {item.highPriorityTasks}</div>
          <div>QA fail rate: {pct(item.qaFailRate)}</div>
          <div>Worker allocation: {item.workerAllocation}</div>
        </>
      )}
      {type === 'task' && (
        <>
          <div>Priority: {item.priority}</div>
          <div>Batch: {item.batch}</div>
          <div>QA: {item.qaStatus}</div>
          <div>Rollback: {item.rollback ? 'yes' : 'no'}</div>
        </>
      )}
    </div>
  );
}

function SimulationControls({ controls, setControls, refresh }) {
  const set = (key, value) => setControls((prev) => ({ ...prev, [key]: Number(value) }));
  return (
    <div className="dt-controls">
      <label>
        <span>Priority weighting</span>
        <input type="range" min="0" max="100" value={controls.priorityWeight} onChange={(e) => set('priorityWeight', e.target.value)} />
        <strong>{controls.priorityWeight}%</strong>
      </label>
      <label>
        <span>Worker allocation</span>
        <input type="range" min="16" max="512" step="8" value={controls.workerAllocation} onChange={(e) => set('workerAllocation', e.target.value)} />
        <strong>{controls.workerAllocation}</strong>
      </label>
      <label>
        <span>Batch factor</span>
        <input type="range" min="10" max="100" value={controls.batchFactor} onChange={(e) => set('batchFactor', e.target.value)} />
        <strong>{controls.batchFactor}%</strong>
      </label>
      <button className="btn btn-primary" onClick={refresh}>Run offline simulation</button>
    </div>
  );
}

function DigitalTwinOverlay({ data }) {
  const [hover, setHover] = useState(null);
  const companies = data?.companies ?? [];
  const batches = data?.batches ?? [];

  return (
    <div className="dt-twin">
      <div className="dt-twin-grid">
        <section className="dt-layer">
          <div className="dt-layer-title">Predictive SLA Alert Overlay</div>
          <div className="dt-company-map">
            {companies.map((company) => {
              const meta = riskMeta(company.riskBand);
              return (
                <div
                  key={company.id}
                  className={`dt-node dt-node-${company.riskBand}`}
                  style={{ '--risk': meta.color, '--riskScore': company.predictedRisk }}
                  onMouseEnter={() => setHover({ type: 'company', item: company })}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="dt-node-name">{company.name}</div>
                  <div className="dt-node-meta">{company.currentBatch} · {company.workerPool} workers</div>
                  <div className="dt-node-risk">{pct(company.predictedRisk)}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="dt-layer">
          <div className="dt-layer-title">Interactive Multi-Batch Simulation</div>
          <div className="dt-batch-grid">
            {batches.map((batch) => {
              const meta = riskMeta(batch.riskBand);
              return (
                <div
                  key={batch.id}
                  className="dt-batch-card"
                  style={{ '--risk': meta.color }}
                  onMouseEnter={() => setHover({ type: 'batch', item: batch })}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="dt-batch-head">
                    <strong>{batch.id}</strong>
                    <RiskPill band={batch.riskBand} value={batch.predictedRisk} />
                  </div>
                  <div className="dt-progress"><span style={{ width: `${batch.progress}%` }} /></div>
                  <div className="dt-batch-metrics">
                    <span>High: {batch.highPriorityTasks}</span>
                    <span>QA: {pct(batch.qaFailRate)}</span>
                    <span>Workers: {batch.workerAllocation}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <div className="dt-iframe-shell">
        <iframe title="Offline Digital Twin dashboard" src="/dashboard_digital_twin_final.html" />
        <div className="dt-iframe-fallback">
          Offline dashboard iframe layer. Overlay above stays live from local JSON/API.
        </div>
      </div>
      {hover && <Tooltip type={hover.type} item={hover.item} />}
    </div>
  );
}

function CompaniesTab({ data, onDropTask }) {
  return (
    <div className="dt-company-list">
      {(data?.companies ?? []).map((company) => (
        <div
          key={company.id}
          className="dt-company-card"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDropTask(e.dataTransfer.getData('text/task-id'), company.id)}
        >
          <div className="dt-company-card-head">
            <div>
              <h3>{company.name}</h3>
              <span>{company.currentBatch} đang xử lý</span>
            </div>
            <RiskPill band={company.riskBand} value={company.predictedRisk} />
          </div>
          <div className="dt-progress"><span style={{ width: `${Math.round(company.predictedRisk * 100)}%` }} /></div>
          <div className="dt-card-grid">
            <span>Active tasks <strong>{company.activeTasks}</strong></span>
            <span>High priority <strong>{company.highPriorityTasks}</strong></span>
            <span>QA fail <strong>{pct(company.qaFailRate)}</strong></span>
            <span>Worker pool <strong>{company.workerPool}</strong></span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectsTab({ data, onShortcut }) {
  const companies = data?.companies ?? [];
  const tasks = data?.tasks ?? [];
  return (
    <div className="dt-project-grid">
      {(data?.projects ?? []).map((project) => (
        <div key={project.id} className="dt-project-card">
          <div className="dt-project-head">
            <div>
              <h3>{project.name}</h3>
              <span>{project.status} · owner {project.companyId}</span>
            </div>
            <span className="badge badge-sandbox">{project.tasks} tasks</span>
          </div>
          <div className="dt-drop-columns">
            {companies.slice(0, 4).map((company) => (
              <div key={company.id} className="dt-drop-zone">
                <strong>{company.name}</strong>
                <span>Drop task here</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="dt-project-card">
        <div className="dt-project-head">
          <div>
            <h3>Task drag source</h3>
            <span>Kéo task sang Companies hoặc dùng shortcut sandbox.</span>
          </div>
        </div>
        <div className="dt-task-mini-list">
          {tasks.slice(0, 8).map((task) => (
            <div key={task.id} className="dt-task-chip" draggable onDragStart={(e) => e.dataTransfer.setData('text/task-id', task.id)}>
              <span>{task.title}</span>
              <button className="btn btn-sm" onClick={() => onShortcut(task)}>Sandbox build/fix</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActiveTasksTab({ data, sortKey, setSortKey, filter, setFilter, onShortcut }) {
  const filtered = useMemo(() => {
    const tasks = data?.tasks ?? [];
    return sortTasks(tasks.filter((task) => filter === 'all' || task.priority === filter || task.riskBand === filter || task.batch === filter), sortKey);
  }, [data, filter, sortKey]);

  return (
    <div className="card dt-table-card">
      <div className="dt-toolbar">
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
          <option value="risk">Sort by SLA risk</option>
          <option value="priority">Sort by priority</option>
          <option value="batch">Sort by batch</option>
          <option value="time">Sort by time</option>
        </select>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All tasks</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="danger">Danger risk</option>
          <option value="alert">Alert risk</option>
          <option value="B1">Batch B1</option>
          <option value="B2">Batch B2</option>
          <option value="B3">Batch B3</option>
          <option value="B4">Batch B4</option>
        </select>
      </div>
      <div className="dt-table">
        {filtered.map((task) => (
          <div key={`${task.id}-${task.companyId}`} className="dt-task-row" draggable onDragStart={(e) => e.dataTransfer.setData('text/task-id', task.id)}>
            <div>
              <strong>{task.title}</strong>
              <span>{task.companyId} · {task.batch} · QA {task.qaStatus}</span>
            </div>
            <span className={`dt-priority dt-priority-${task.priority}`}>{task.priority}</span>
            <RiskPill band={task.riskBand} value={task.riskScore} />
            <button className="btn btn-sm" onClick={() => onShortcut(task)}>Sandbox build/fix</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SimulationTab({ data, controls, setControls, refresh }) {
  return (
    <div>
      <div className="card">
        <div className="card-title">Slider Simulation</div>
        <SimulationControls controls={controls} setControls={setControls} refresh={refresh} />
      </div>
      <DigitalTwinOverlay data={data} />
    </div>
  );
}

export default function CorporateDashboard() {
  const [activeTab, setActiveTab] = useState('twin');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [controls, setControls] = useState({ priorityWeight: 62, workerAllocation: 192, batchFactor: 48 });
  const [sortKey, setSortKey] = useState('risk');
  const [filter, setFilter] = useState('all');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      const json = await api.post('/simulation', controls);
      setData(json);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [controls]);

  useEffect(() => { refresh(); }, [refresh]);

  const assignTask = async (taskId, companyId) => {
    if (!taskId || !companyId) return;
    await api.post('/task', { taskId, companyId });
    setNotice(`Assigned ${taskId} -> ${companyId}`);
    refresh();
  };

  const runShortcut = async (task) => {
    await api.post('/execution', { taskId: task.id, companyId: task.companyId, action: 'sandbox-build-fix' });
    setNotice(`Queued sandbox build/fix for ${task.title}`);
    refresh();
  };

  const summary = data?.summary ?? { totalProjects: 0, activeTasks: 0, totalWorkers: 0, systemHealth: 'PASS', qaWarnings: 0, rollbacks: 0 };

  return (
    <div className="dt-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.corporate')} · Digital Twin v3.0</h1>
          <p className="dt-subtitle">Predictive SLA overlay, multi-batch simulation, sandbox shortcuts và local API offline.</p>
        </div>
        <button className="btn" onClick={refresh}>Refresh</button>
      </div>

      {error && <div className="dt-alert dt-alert-danger">Lỗi tải Digital Twin: {error}</div>}
      {notice && <div className="dt-alert dt-alert-info">{notice}</div>}

      <div className="dt-stats">
        <StatCard label="Projects" value={summary.totalProjects} />
        <StatCard label="Active tasks" value={summary.activeTasks} tone="green" />
        <StatCard label="Total workers" value={summary.totalWorkers} tone="purple" />
        <StatCard label="System health" value={summary.systemHealth} tone={summary.systemHealth === 'FAIL' ? 'red' : summary.systemHealth === 'WARN' ? 'yellow' : 'green'} detail={`${summary.qaWarnings} QA warnings · ${summary.rollbacks} rollbacks`} />
      </div>

      <div className="dt-topline">
        <SimulationControls controls={controls} setControls={setControls} refresh={refresh} />
        <div className="dt-notifications">
          {(data?.alerts ?? []).slice(0, 4).map((alert, index) => (
            <span key={`${alert.message}-${index}`} className={`dt-notification dt-notification-${alert.severity}`}>{alert.message}</span>
          ))}
          {(data?.alerts ?? []).length === 0 && <span className="dt-notification dt-notification-safe">No SLA warnings</span>}
        </div>
      </div>

      <div className="dt-tabs">
        {TABS.map((tab) => (
          <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'twin' && <DigitalTwinOverlay data={data} />}
      {activeTab === 'companies' && <CompaniesTab data={data} onDropTask={assignTask} />}
      {activeTab === 'projects' && <ProjectsTab data={data} onShortcut={runShortcut} />}
      {activeTab === 'tasks' && <ActiveTasksTab data={data} sortKey={sortKey} setSortKey={setSortKey} filter={filter} setFilter={setFilter} onShortcut={runShortcut} />}
      {activeTab === 'simulation' && <SimulationTab data={data} controls={controls} setControls={setControls} refresh={refresh} />}

      <div className="dt-footer">Offline API: /task · /execution · /analytics · /simulation · Updated {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('vi-VN') : '-'}</div>
    </div>
  );
}
