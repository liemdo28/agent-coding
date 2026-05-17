import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../services/api.js';

const NAV_ITEMS = [
  { path: '/',         label: 'Dashboard',  icon: '\u{1F4CA}', end: true },
  { path: '/scanner',  label: 'Scanner',    icon: '\u{1F50D}' },
  { path: '/chat',     label: 'Chat',       icon: '\u{1F4AC}' },
  { path: '/patches',  label: 'Patches',    icon: '\u{1FA79}' },
  { path: '/qa',       label: 'QA',         icon: '✔️' },
  { path: '/reports',  label: 'Reports',    icon: '\u{1F4CB}' },
  { path: '/memory',   label: 'Memory',     icon: '\u{1F9E0}' },
  { path: '/security', label: 'Security',   icon: '\u{1F512}' },
];

export default function Layout() {
  const [collapsed,    setCollapsed]    = useState(false);
  const [projectName,  setProjectName]  = useState('...');
  const [llmStatus,    setLLMStatus]    = useState('');
  const [policyResult, setPolicyResult] = useState(null);

  useEffect(() => {
    api.get('/project/status')
      .then((r) => {
        if (r.success) setProjectName(r.data.projectName ?? 'Unknown');
      })
      .catch(() => setProjectName('(offline)'));

    api.get('/policy/status')
      .then((r) => {
        if (r.success) setPolicyResult(r.data.result);
      })
      .catch(() => {});

    api.get('/health')
      .then((r) => {
        if (r.status === 'ok') setLLMStatus('Local');
      })
      .catch(() => setLLMStatus('?'));
  }, []);

  return (
    <div className="layout">
      {/* Sidebar */}
      <nav className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-icon">[A]</span>
          {!collapsed && <span>Local Agent</span>}
        </div>

        <div className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </div>

        <div className="sidebar-toggle" onClick={() => setCollapsed((c) => !c)} title="Toggle sidebar">
          {collapsed ? '▶' : '◀'}
        </div>
      </nav>

      {/* Main */}
      <div className="main-area">
        {/* Top status bar */}
        <div className="topbar">
          <span className="topbar-title">{projectName}</span>
          <span className="badge badge-offline">OFFLINE</span>
          <span className="badge badge-sandbox">SANDBOXED</span>
          {policyResult && (
            <span className={`badge badge-${policyResult === 'PASS' ? 'pass' : policyResult === 'WARNING' ? 'warn' : 'fail'}`}>
              {policyResult}
            </span>
          )}
          {llmStatus && (
            <span className="topbar-llm">LLM: {llmStatus}</span>
          )}
        </div>

        {/* Page content */}
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
