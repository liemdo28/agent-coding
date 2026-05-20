// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../services/api.js';
import LanguageSwitcher from './LanguageSwitcher.tsx';
import { t } from '../i18n/index.js';

interface NavItem {
  path: string;
  label: string | (() => string);
  icon: string;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/',               label: () => t('nav.dashboard'),     icon: '📊', end: true },
  { path: '/command-center', label: () => t('nav.commandCenter'), icon: '⚡' },
  { path: '/project-health', label: 'Project Health',            icon: '🏥' },
  { path: '/activity-log',   label: () => t('nav.activityLog'),   icon: '📓' },
  { path: '/scanner',        label: () => t('nav.scanner'),       icon: '🔍' },
  { path: '/chat',           label: 'Chat',                       icon: '💬' },
  { path: '/patches',        label: 'Patches',                    icon: '🩹' },
  { path: '/qa',             label: () => t('nav.qa'),            icon: '✔️' },
  { path: '/reports',        label: () => t('nav.reports'),       icon: '📋' },
  { path: '/memory',         label: 'Memory',                     icon: '🧠' },
  { path: '/project-brain',  label: 'Project Brain',              icon: '🧠' },
  { path: '/world-model',    label: 'World Model',                icon: '🌍' },
  { path: '/execution-matrix', label: 'Execution Matrix',         icon: '🌌' },
  { path: '/civilization',   label: 'Civilization Health',        icon: '🪐' },
  { path: '/engineering-universe', label: 'Engineering Universe', icon: '🌌' },
  { path: '/reasoning',      label: 'AI Reasoning',               icon: '⚡' },
  { path: '/agents',         label: 'Live Agents',                icon: '🤖' },
  { path: '/workspace-graph',label: 'Workspace Graph',            icon: '◎' },
  { path: '/autonomous-queue',label: 'Task Queue',                icon: '⏳' },
  { path: '/knowledge-base', label: 'Knowledge Base',             icon: '📚' },
  { path: '/runtime-monitor',label: 'Runtime Monitor',            icon: '🖥' },
  { path: '/timeline',       label: 'Timeline',                   icon: '📅' },
  { path: '/security',       label: () => t('nav.security'),      icon: '🔒' },
  { path: '/architecture',   label: () => t('nav.architecture'),  icon: '🏗' },
  { path: '/kpi',            label: () => t('nav.kpi'),           icon: '📈' },
  { path: '/corporate',      label: () => t('nav.corporate'),     icon: '🏢' },
  { path: '/digital-twin',   label: 'Digital Twin',               icon: '◎' },
  { path: '/projects',       label: 'Projects',                   icon: '📂' },
  { path: '/active-tasks',   label: 'Active Tasks',               icon: '⚙️' },
  { path: '/simulation',     label: 'Simulation',                 icon: '🎛' },
];

export default function Layout() {
  const [collapsed,    setCollapsed]    = useState(false);
  const [projectName,  setProjectName]  = useState('...');
  const [llmStatus,    setLLMStatus]    = useState('');
  const [policyResult, setPolicyResult] = useState<string | null>(null);

  useEffect(() => {
    api.get('/project/status')
      .then((r: any) => {
        if (r.success) setProjectName(r.data.projectName ?? 'Unknown');
      })
      .catch(() => setProjectName('(offline)'));

    api.get('/policy/status')
      .then((r: any) => {
        if (r.success) setPolicyResult(r.data.result);
      })
      .catch(() => {});

    api.get('/health')
      .then((r: any) => {
        if (r.status === 'ok') setLLMStatus('Local');
      })
      .catch(() => setLLMStatus('?'));
  }, []);

  const policyColor =
    policyResult === 'PASS'    ? 'text-green   border-green/40   bg-green/10' :
    policyResult === 'WARNING' ? 'text-yellow  border-yellow/40  bg-yellow/10' :
    'text-red border-red/40 bg-red/10';

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text font-sans text-sm">

      {/* ── Sidebar ── */}
      <nav
        style={{ width: collapsed ? 64 : 200, minWidth: collapsed ? 64 : 200 }}
        className="flex flex-col bg-surface border-r border-border z-10 overflow-hidden transition-[width,min-width] duration-200 ease-in-out"
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border font-bold text-[13px] text-blue overflow-hidden whitespace-nowrap">
          <span className="text-xl flex-shrink-0 leading-none">[A]</span>
          {!collapsed && <span>Local Agent</span>}
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              style={{ textDecoration: 'none' }}
              className={({ isActive }) => [
                'flex items-center gap-2.5 px-4 py-2.5 overflow-hidden whitespace-nowrap',
                'transition-colors duration-200 cursor-pointer',
                isActive
                  ? 'bg-blue/10 text-blue'
                  : 'text-muted hover:bg-white/5 hover:text-text',
              ].join(' ')}
            >
              <span className="text-base flex-shrink-0 w-5 text-center leading-none">
                {item.icon}
              </span>
              {!collapsed && (
                <span className="text-[13px] overflow-hidden text-ellipsis">
                  {typeof item.label === 'function' ? item.label() : item.label}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="py-3 px-4 border-t border-border text-muted text-base text-center cursor-pointer transition-colors duration-200 hover:text-text w-full bg-transparent border-x-0 border-b-0"
          title="Toggle sidebar"
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </nav>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex-shrink-0 flex items-center gap-3 px-5 border-b border-border bg-surface"
          style={{ height: 48 }}>
          <span className="font-semibold text-[14px] text-text flex-1 truncate">{projectName}</span>

          <StatusBadge color="green">OFFLINE</StatusBadge>
          <StatusBadge color="blue">SANDBOXED</StatusBadge>

          {policyResult && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide border ${policyColor}`}>
              {policyResult}
            </span>
          )}

          {llmStatus && (
            <span className="text-[12px] text-muted">LLM: {llmStatus}</span>
          )}

          <LanguageSwitcher />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ── StatusBadge ── */
function StatusBadge({ color, children }: { color: string; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    green:  'bg-green/10  text-green  border-green/40',
    blue:   'bg-blue/10   text-blue   border-blue/40',
    yellow: 'bg-yellow/10 text-yellow border-yellow/40',
    red:    'bg-red/10    text-red    border-red/40',
    muted:  'bg-white/5   text-muted  border-white/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide border ${styles[color] ?? styles.muted}`}>
      {children}
    </span>
  );
}
