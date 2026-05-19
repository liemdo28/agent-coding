import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../services/api.js';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import { t } from '../i18n/index.js';

const NAV_ITEMS = [
  { path: '/',              label: () => t('nav.dashboard'),      icon: '\u{1F4CA}', end: true },
  { path: '/command-center',label: () => t('nav.commandCenter'),  icon: '\u{26A1}' },
  { path: '/activity-log',  label: () => t('nav.activityLog'),    icon: '\u{1F4D3}' },
  { path: '/scanner',       label: () => t('nav.scanner'),        icon: '\u{1F50D}' },
  { path: '/chat',          label: 'Chat',                        icon: '\u{1F4AC}' },
  { path: '/patches',       label: 'Patches',                     icon: '\u{1FA79}' },
  { path: '/qa',            label: () => t('nav.qa'),             icon: '✔️' },
  { path: '/reports',       label: () => t('nav.reports'),        icon: '\u{1F4CB}' },
  { path: '/memory',        label: 'Memory',                      icon: '\u{1F9E0}' },
  { path: '/security',      label: () => t('nav.security'),       icon: '\u{1F512}' },
  { path: '/architecture',  label: () => t('nav.architecture'),   icon: '\u{1F3D7}' },
  { path: '/kpi',           label: () => t('nav.kpi'),            icon: '\u{1F4CA}' },
  { path: '/corporate',    label: () => t('nav.corporate'),      icon: '\u{1F3E2}' },
  { path: '/projects',     label: 'Projects',                    icon: '📂' },
  { path: '/active-tasks', label: 'Active Tasks',                icon: '⚙️' },
  { path: '/simulation',   label: 'Simulation',                  icon: '🎛' },
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
              {!collapsed && <span className="nav-label">{typeof item.label === 'function' ? item.label() : item.label}</span>}
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
          <LanguageSwitcher />
        </div>

        {/* Page content */}
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
