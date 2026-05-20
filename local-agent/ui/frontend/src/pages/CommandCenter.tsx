// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { t } from '../i18n/index.js';
import { COMMAND_GROUPS } from '../../../shared/commands.js';

const GROUP_ICONS = {
  kb: '🧠',
  eval: '📊',
  accounting: '💰',
  build: '🔧',
  agent: '🤖',
};

const STATUS_COLORS = {
  idle:      'var(--text-muted)',
  running:   'var(--blue)',
  completed: 'var(--green)',
  failed:    'var(--red)',
  stopped:   'var(--yellow)',
};

const SUGGESTIONS = [
  { cmd: '/fix rawwebsite build', desc: 'Planning, Sandboxed execution & QA build check for rawwebsite' },
  { cmd: '/fix dashboard build', desc: 'Planning, Sandboxed execution & QA build check for dashboard' },
  { cmd: '/fix agent-coding build', desc: 'Planning, Sandboxed execution & QA build check for agent-coding' },
  { cmd: '/test rawwebsite', desc: 'Run complete verification test suites for rawwebsite' },
  { cmd: '/test dashboard', desc: 'Run complete verification test suites for dashboard' },
  { cmd: '/post rawwebsite linkedin', desc: 'Generate marketing LinkedIn post for rawwebsite' },
  { cmd: '/post rawwebsite facebook', desc: 'Generate marketing Facebook post for rawwebsite' },
  { cmd: '/post dashboard linkedin', desc: 'Generate marketing LinkedIn post for dashboard' },
];

function lineColor(line) {
  if (!line) return 'var(--text-muted)';
  const l = line.toLowerCase();
  if (l.includes('[stderr]') || l.includes('error') || l.includes('err:')) return 'var(--red)';
  if (l.includes('warn') || l.includes('warning')) return 'var(--yellow)';
  if (l.includes('done') || l.includes('success') || l.includes('completed') || l.includes('✓')) return 'var(--green)';
  return 'var(--text)';
}

export default function CommandCenter() {
  // Autocomplete & Command palette state
  const [commandInput, setCommandInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(0);

  // Filter suggestions
  const filteredSuggestions = SUGGESTIONS.filter(item => 
    item.cmd.toLowerCase().includes(commandInput.toLowerCase())
  );

  // Build grouped list from shared COMMAND_GROUPS, resolving i18n labels at render time
  const grouped = COMMAND_GROUPS.map((group) => ({
    key: group.id,
    label: t(group.labelKey),
    icon: GROUP_ICONS[group.id],
    items: group.commands.map((cmd) => ({
      scriptKey: cmd.script,
      label: t(cmd.labelKey),
      desc: t(cmd.descKey),
      warn: cmd.warn,
      estTime: cmd.estTime ?? null,
      requiresInput: cmd.requiresInput ?? false,
      inputPrompt: cmd.inputPrompt ?? '',
      inputPlaceholder: cmd.inputPlaceholder ?? '',
    })),
  })).filter((g) => g.items.length > 0);

  // Job state
  const [activeJobId, setActiveJobId]   = useState(null);
  const [activeScript, setActiveScript] = useState(null);
  const [jobStatus, setJobStatus]       = useState('idle'); // idle|running|completed|failed|stopped
  const [exitCode, setExitCode]         = useState(null);
  const [lines, setLines]               = useState([]);
  const [confirm, setConfirm]           = useState(null); // { scriptKey, meta }
  const [inputModal, setInputModal]     = useState(null); // { scriptKey, meta }
  const [inputValue, setInputValue]     = useState('');
  const outputRef = useRef(null);
  const cancelSSERef = useRef(null);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  function handleScriptClick(scriptKey, meta) {
    if (jobStatus === 'running') return; // ignore while running
    if (meta.requiresInput) {
      setInputValue('');
      setInputModal({ scriptKey, meta });
    } else if (meta.warn) {
      setConfirm({ scriptKey, meta });
    } else {
      runScript(scriptKey, meta);
    }
  }

  function handleInputConfirm() {
    if (!inputModal) return;
    const { scriptKey, meta } = inputModal;
    setInputModal(null);
    runScript(scriptKey, meta, inputValue.trim());
  }

  // Handle execute slash command
  async function executeSlashCommand(cmdStr) {
    if (jobStatus === 'running') return;
    setLines([]);
    setJobStatus('running');
    setActiveScript(cmdStr);
    setExitCode(null);

    // Initial logs simulation
    setLines([`[AOS Console] Initializing command dispatch for: "${cmdStr}"`]);

    try {
      const resp = await fetch('/api/commandcenter/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmdStr }),
      });
      const resData = await resp.json();
      if (!resData.success) {
        setJobStatus('failed');
        setLines(prev => [...prev, `[error] Execution failed: ${resData.error || 'unknown error'}`]);
        if (resData.logs) {
          setLines(prev => [...prev, ...resData.logs]);
        }
        return;
      }

      // Simulate streaming log lines beautifully
      const outputLogs = resData.logs || [];
      let i = 0;
      const interval = setInterval(() => {
        if (i < outputLogs.length) {
          setLines(prev => [...prev, outputLogs[i]]);
          i++;
        } else {
          clearInterval(interval);
          setJobStatus('completed');
          setExitCode(0);
        }
      }, 200);

    } catch (err) {
      setJobStatus('failed');
      setLines(prev => [...prev, `[error] Fetch fault: ${err.message}`]);
    }
  }

  async function runScript(scriptKey, meta, taskInput) {
    setConfirm(null);
    setActiveScript(scriptKey);
    setLines([]);
    setJobStatus('running');
    setExitCode(null);
    setActiveJobId(null);

    const body = { script: scriptKey, label: meta.label };
    if (taskInput) body.args = ['--save', taskInput];

    try {
      const resp = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!data.jobId) {
        setJobStatus('failed');
        setLines((l) => [...l, '[error] Failed to start job: ' + (data.error ?? 'unknown')]);
        return;
      }
      const jobId = data.jobId;
      setActiveJobId(jobId);

      // SSE stream
      const es = new EventSource(`/api/run/${jobId}/stream`);
      cancelSSERef.current = () => es.close();

      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          if (parsed.done) {
            es.close();
            setJobStatus(parsed.status ?? 'completed');
            setExitCode(parsed.exitCode ?? null);
            cancelSSERef.current = null;
          } else if (parsed.line !== undefined) {
            setLines((l) => [...l, parsed.line]);
          }
        } catch { /* ignore */ }
      };
      es.onerror = () => {
        es.close();
        setJobStatus('failed');
        cancelSSERef.current = null;
      };
    } catch (err) {
      setJobStatus('failed');
      setLines((l) => [...l, '[error] ' + err.message]);
    }
  }

  async function handleStop() {
    if (!activeJobId) return;
    if (cancelSSERef.current) { cancelSSERef.current(); cancelSSERef.current = null; }
    try {
      await fetch(`/api/run/${activeJobId}/stop`, { method: 'POST' });
    } catch { /* best effort */ }
    setJobStatus('stopped');
  }

  // Key navigation for suggestions
  function handleKeyDown(e) {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIdx(prev => (prev + 1) % filteredSuggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIdx(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredSuggestions[suggestionIdx].cmd;
        setCommandInput(selected);
        setShowSuggestions(false);
        executeSlashCommand(selected);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter' && commandInput.trim()) {
      e.preventDefault();
      executeSlashCommand(commandInput.trim());
    }
  }

  const statusLabel = {
    idle:      'IDLE',
    running:   t('common.running'),
    completed: t('common.success') + ' ✅',
    failed:    t('common.error') + ' ❌',
    stopped:   t('common.stop') + ' ⏹',
  }[jobStatus] ?? jobStatus;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title neon-text-cyan">{t('commandCenter.title')}</h1>
          <p className="text-muted text-sm mt-1">{t('commandCenter.subtitle')}</p>
        </div>
        {/* Status badge */}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          border: '1px solid ' + STATUS_COLORS[jobStatus],
          color: STATUS_COLORS[jobStatus],
          background: STATUS_COLORS[jobStatus] + '18',
        }}>
          {jobStatus === 'running' && <span className="spinner mr-1" />}
          {statusLabel}
        </span>
      </div>

      {/* AOS Search Command Console Palette */}
      <div className="neon-card p-4 relative">
        <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded px-3 py-2">
          <span className="text-base text-cyan-400">⚡</span>
          <input
            type="text"
            className="bg-transparent border-0 outline-none text-xs text-slate-100 flex-1 font-mono placeholder-slate-500"
            placeholder="Type a slash command (e.g., /fix rawwebsite build, /test dashboard, /post rawwebsite linkedin)..."
            value={commandInput}
            onChange={(e) => {
              setCommandInput(e.target.value);
              setShowSuggestions(e.target.value.startsWith('/'));
              setSuggestionIdx(0);
            }}
            onFocus={() => {
              if (commandInput.startsWith('/')) setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
          />
          {commandInput && (
            <button 
              className="text-slate-500 hover:text-slate-300 text-xs font-mono px-2"
              onClick={() => { setCommandInput(''); setShowSuggestions(false); }}
            >
              Clear
            </button>
          )}
          <button
            onClick={() => executeSlashCommand(commandInput)}
            disabled={!commandInput.trim() || jobStatus === 'running'}
            className="btn btn-primary text-xs py-1 px-3"
          >
            Run
          </button>
        </div>

        {/* Autocomplete Popup Suggestions */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute left-4 right-4 mt-1 bg-slate-900 border border-slate-800 rounded shadow-xl z-20 overflow-hidden font-mono text-[11px]">
            {filteredSuggestions.map((item, idx) => (
              <div
                key={item.cmd}
                onClick={() => {
                  setCommandInput(item.cmd);
                  setShowSuggestions(false);
                  executeSlashCommand(item.cmd);
                }}
                className={`flex justify-between items-center px-4 py-2.5 cursor-pointer transition-colors ${
                  idx === suggestionIdx ? 'bg-slate-800 text-cyan-400 border-l-2 border-cyan-400' : 'text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <span className="font-bold">{item.cmd}</span>
                <span className="text-slate-500 text-[10px]">{item.desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left: script groups */}
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.key} className="neon-card p-4">
              <div className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                <span>{group.icon}</span>
                <span>{group.label}</span>
              </div>
              <div className="flex flex-col gap-2">
                {group.items.map((item) => {
                  const isActive = activeScript === item.scriptKey;
                  return (
                    <button
                      key={item.scriptKey}
                      onClick={() => handleScriptClick(item.scriptKey, item)}
                      disabled={jobStatus === 'running'}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '10px 14px',
                        border: `1px solid ${isActive ? 'var(--blue)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius)',
                        background: isActive ? 'rgba(88,166,255,0.08)' : 'transparent',
                        color: 'var(--text)',
                        cursor: jobStatus === 'running' ? 'not-allowed' : 'pointer',
                        opacity: jobStatus === 'running' && !isActive ? 0.45 : 1,
                        textAlign: 'left',
                        transition: 'border-color 0.15s, background 0.15s',
                        width: '100%',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {item.warn && <span style={{ color: 'var(--yellow)', marginRight: 4 }}>⚠</span>}
                        {item.label}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{item.desc}</span>
                      {item.estTime && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                          ~{item.estTime}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right: output panel */}
        <div style={{ position: 'sticky', top: 24, alignSelf: 'start' }}>
          <div className="neon-card p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-slate-300">{t('commandCenter.outputTitle')}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {jobStatus === 'running' && (
                  <button className="btn btn-danger text-xs py-1 px-3" onClick={handleStop}>
                    {t('common.stop')}
                  </button>
                )}
                <button
                  className="btn text-xs py-1 px-3"
                  onClick={() => setLines([])}
                  disabled={jobStatus === 'running'}
                >
                  Clear
                </button>
              </div>
            </div>

            {activeScript && (
              <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                <code style={{ color: 'var(--blue)' }}>
                  {activeScript.startsWith('/') ? activeScript : `npm run ${activeScript}`}
                </code>
                {exitCode !== null && (
                  <span style={{ marginLeft: 8, color: exitCode === 0 ? 'var(--green)' : 'var(--red)' }}>
                    exit {exitCode}
                  </span>
                )}
              </div>
            )}

            <div
              ref={outputRef}
              style={{
                background: '#0d1117',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '12px',
                fontFamily: 'monospace',
                fontSize: 11,
                lineHeight: 1.6,
                height: 480,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {lines.length === 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>{t('commandCenter.noOutput')}</span>
              ) : (
                lines.map((line, i) => (
                  <div key={i} style={{ color: lineColor(line) }}>{line}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Input modal for requiresInput commands */}
      {inputModal && (
        <div className="modal-overlay">
          <div className="confirm-dialog">
            <div className="confirm-title">{inputModal.meta.inputPrompt || 'Nhập thông tin'}</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              {inputModal.meta.label}
            </p>
            <input
              autoFocus
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && inputValue.trim()) handleInputConfirm(); if (e.key === 'Escape') setInputModal(null); }}
              placeholder={inputModal.meta.inputPlaceholder || ''}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text)',
                fontSize: 13,
                marginBottom: 16,
                boxSizing: 'border-box',
              }}
            />
            <div className="btn-group">
              <button
                className="btn btn-primary"
                onClick={handleInputConfirm}
                disabled={!inputValue.trim()}
              >
                Giao task
              </button>
              <button className="btn" onClick={() => setInputModal(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div className="modal-overlay">
          <div className="confirm-dialog">
            <div className="confirm-title">{t('commandCenter.confirmTitle')}</div>
            <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 8 }}>
              <strong>{confirm.meta.label}</strong>
            </p>
            <p className="confirm-msg">
              {t('commandCenter.confirmWarning').replace('{time}', confirm.meta.estTime ?? '?')}
            </p>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, fontFamily: 'monospace' }}>
              npm run {confirm.scriptKey}
            </div>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={() => runScript(confirm.scriptKey, confirm.meta)}>
                {t('common.confirm')}
              </button>
              <button className="btn" onClick={() => setConfirm(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
