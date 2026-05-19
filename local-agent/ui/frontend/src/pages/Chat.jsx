import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';

// ── Simple markdown-to-React renderer (no external deps) ─────────────────────
// Handles: ```code blocks```, `inline code`, **bold**, line breaks

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className="chat-copy-btn" onClick={copy} title="Copy code">
      {copied ? '✓ Đã copy' : 'Copy'}
    </button>
  );
}

function renderText(text) {
  if (!text) return null;

  // Split by fenced code blocks  ```lang\n...\n```
  const parts = [];
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRe.exec(text)) !== null) {
    // Text before code block
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', lang: match[1] || 'text', content: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts.map((part, i) => {
    if (part.type === 'code') {
      return (
        <div key={i} className="chat-code-block">
          <div className="chat-code-header">
            <span className="chat-code-lang">{part.lang}</span>
            <CopyButton text={part.content} />
          </div>
          <pre className="chat-code-pre"><code>{part.content}</code></pre>
        </div>
      );
    }
    // Inline text: handle `inline code` and **bold** and newlines
    const segments = part.content.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {segments.map((seg, j) => {
          if (seg.startsWith('`') && seg.endsWith('`')) {
            return <code key={j} className="chat-inline-code">{seg.slice(1, -1)}</code>;
          }
          if (seg.startsWith('**') && seg.endsWith('**')) {
            return <strong key={j}>{seg.slice(2, -2)}</strong>;
          }
          // Plain text — convert \n to <br>
          return seg.split('\n').map((line, k, arr) => (
            <React.Fragment key={k}>
              {line}
              {k < arr.length - 1 && <br />}
            </React.Fragment>
          ));
        })}
      </span>
    );
  });
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="chat-bubble chat-bubble-agent">
      <div className="chat-bubble-label">Mi</div>
      <div className="typing-indicator">
        <span /><span /><span />
      </div>
    </div>
  );
}

// ── Session sidebar ───────────────────────────────────────────────────────────

function SessionSidebar({ sessions, activeId, onSelect, onCreate, onDelete, onRename }) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal,  setRenameVal]  = useState('');

  const startRename = (e, s) => {
    e.stopPropagation();
    setRenamingId(s.id);
    setRenameVal(s.title);
  };
  const commitRename = (id) => {
    if (renameVal.trim()) onRename(id, renameVal.trim());
    setRenamingId(null);
  };

  return (
    <div className="chat-sidebar">
      <button className="chat-new-btn" onClick={onCreate}>
        <span>＋</span> Phiên mới
      </button>

      <div className="chat-session-list">
        {sessions.length === 0 && (
          <div className="chat-session-empty">Chưa có phiên nào</div>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`chat-session-item${s.id === activeId ? ' active' : ''}`}
            onClick={() => onSelect(s.id)}
          >
            {renamingId === s.id ? (
              <input
                className="chat-session-rename"
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={() => commitRename(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(s.id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <div className="chat-session-title" title={s.title}>{s.title}</div>
                <div className="chat-session-meta">
                  {s.messageCount > 0 ? `${s.messageCount / 2 | 0} lượt` : 'Mới'}
                  {' · '}
                  {new Date(s.updatedAt).toLocaleDateString('vi-VN')}
                </div>
                <div className="chat-session-actions">
                  <button
                    className="chat-session-btn"
                    title="Đổi tên"
                    onClick={(e) => startRename(e, s)}
                  >✏️</button>
                  <button
                    className="chat-session-btn"
                    title="Export"
                    onClick={(e) => { e.stopPropagation(); window.open(`/api/chat/sessions/${s.id}/export`); }}
                  >⬇️</button>
                  <button
                    className="chat-session-btn chat-session-btn-del"
                    title="Xóa phiên"
                    onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                  >🗑</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Chat component ───────────────────────────────────────────────────────

export default function Chat() {
  const WELCOME_MSG = {
    id: 'welcome',
    role: 'agent',
    text: 'Dạ, chào sếp! Em là Mi — trợ lý kỹ thuật của dự án này. Sếp cần hỏi gì về code, cấu trúc hay lỗi, cứ hỏi em nhé.',
  };

  const [sessions,       setSessions]       = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages,       setMessages]       = useState([WELCOME_MSG]);
  const [input,          setInput]          = useState('');
  const [streaming,      setStreaming]       = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const cancelRef   = useRef(null);
  const agentIdRef  = useRef(null);
  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);

  // ── Load sessions on mount ────────────────────────────────────────────────

  useEffect(() => {
    api.get('/chat/sessions')
      .then(({ sessions: list }) => {
        setSessions(list);
        if (list.length > 0) {
          // Load the most recent session
          loadSession(list[0].id);
        }
      })
      .catch(() => { /* Ignore — sessions are optional */ })
      .finally(() => setLoadingSessions(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Session CRUD ──────────────────────────────────────────────────────────

  const loadSession = useCallback((id) => {
    api.get(`/chat/sessions/${id}`)
      .then(({ session }) => {
        setActiveSessionId(id);
        if (session.messages.length === 0) {
          setMessages([WELCOME_MSG]);
        } else {
          setMessages(session.messages.map((m, i) => ({ id: `${id}-${i}`, ...m })));
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createSession = useCallback(() => {
    api.post('/chat/sessions', { title: 'Phiên mới' })
      .then(({ sessionId, session }) => {
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(sessionId);
        setMessages([WELCOME_MSG]);
        inputRef.current?.focus();
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteSession = useCallback((id) => {
    if (!confirm('Xóa phiên chat này?')) return;
    api.delete(`/chat/sessions/${id}`)
      .then(() => {
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (activeSessionId === id) {
          setActiveSessionId(null);
          setMessages([WELCOME_MSG]);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  const renameSession = useCallback((id, title) => {
    api.patch(`/chat/sessions/${id}`, { title }).catch(() => {});
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title } : s));
  }, []);

  const refreshSessionList = useCallback(() => {
    api.get('/chat/sessions')
      .then(({ sessions: list }) => setSessions(list))
      .catch(() => {});
  }, []);

  // ── Messaging ─────────────────────────────────────────────────────────────

  const handleSend = () => {
    const q = input.trim();
    if (!q || streaming) return;

    setInput('');
    const agentId     = `a-${Date.now()}`;
    agentIdRef.current = agentId;

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user',  text: q,  ts: new Date().toISOString() },
      { id: agentId,           role: 'agent', text: '', ts: new Date().toISOString() },
    ]);
    setStreaming(true);

    cancelRef.current = api.streamPost(
      '/agent/ask',
      { question: q, sessionId: activeSessionId ?? undefined },
      (event, data) => {
        if (event === 'token') {
          setMessages((prev) =>
            prev.map((m) => m.id === agentId ? { ...m, text: m.text + (data.token ?? '') } : m)
          );
        } else if (event === 'context') {
          if (data.warning) {
            setMessages((prev) => [
              ...prev,
              { id: `ctx-${Date.now()}`, role: 'warning', text: data.warning },
            ]);
          }
        } else if (event === 'error') {
          const isLLMDown = data.message?.includes('not reachable') || data.message?.includes('LLM');
          setMessages((prev) =>
            prev.map((m) =>
              m.id === agentId
                ? { ...m, role: isLLMDown ? 'llm-error' : 'error', text: data.message, error: !isLLMDown }
                : m
            )
          );
        }
      },
      () => {
        setStreaming(false);
        // Refresh session list so title + count update
        if (activeSessionId) refreshSessionList();
      },
      (err) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentIdRef.current ? { ...m, text: `Lỗi: ${err.message}`, error: true } : m
          )
        );
        setStreaming(false);
      }
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleStop = () => {
    cancelRef.current?.();
    setStreaming(false);
  };

  // ── Auto-resize textarea ──────────────────────────────────────────────────

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const showTypingIndicator = streaming &&
    messages.at(-1)?.role === 'agent' &&
    messages.at(-1)?.text === '';

  return (
    <div className="chat-page">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Chat với Mi</h1>
        <div className="badge badge-offline" style={{ fontSize: 11 }}>Local LLM</div>
      </div>

      <div className="chat-layout">
        {/* Session sidebar */}
        <SessionSidebar
          sessions={sessions}
          activeId={activeSessionId}
          onSelect={(id) => {
            if (id !== activeSessionId) loadSession(id);
          }}
          onCreate={createSession}
          onDelete={deleteSession}
          onRename={renameSession}
        />

        {/* Main chat area */}
        <div className="chat-main">
          {/* Messages */}
          <div className="chat-messages">
            {/* Warning banner — always at top */}
            <div className="chat-notice">
              💡 Gợi ý code từ chat <strong>không tự áp dụng</strong> — dùng trang <strong>Patches</strong> để thay đổi file.
            </div>

            {messages.map((msg) => {
              if (msg.role === 'warning') {
                return (
                  <div key={msg.id} className="chat-system-msg">
                    {msg.text}
                  </div>
                );
              }

              if (msg.role === 'llm-error') {
                return (
                  <div key={msg.id} className="chat-error-card">
                    <div className="chat-error-title">🔴 Không kết nối được AI</div>
                    <div className="chat-error-body">Ollama chưa chạy hoặc chưa cài. Để sửa:</div>
                    <ol className="chat-error-steps">
                      <li>Chạy lệnh: <code>ollama serve</code></li>
                      <li>Nếu chưa cài: xem <code>docs/setup/local-llm.md</code></li>
                    </ol>
                    <div className="chat-error-raw">{msg.text}</div>
                  </div>
                );
              }

              if (msg.role === 'error') {
                return (
                  <div key={msg.id} className="chat-system-msg chat-system-error">
                    ⚠️ {msg.text}
                  </div>
                );
              }

              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="chat-bubble chat-bubble-user">
                    <div className="chat-bubble-label">Sếp</div>
                    <div className="chat-bubble-text">{renderText(msg.text)}</div>
                    {msg.ts && (
                      <div className="chat-bubble-time">
                        {new Date(msg.ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                );
              }

              if (msg.role === 'agent') {
                return (
                  <div key={msg.id} className="chat-bubble chat-bubble-agent">
                    <div className="chat-bubble-label">Mi</div>
                    <div className="chat-bubble-text">
                      {msg.text
                        ? renderText(msg.text)
                        : streaming
                          ? <span className="chat-cursor">▌</span>
                          : null
                      }
                    </div>
                    {msg.ts && msg.text && (
                      <div className="chat-bubble-time">
                        {new Date(msg.ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            })}

            {showTypingIndicator && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="chat-input-area">
            <div className="chat-input-wrapper">
              <textarea
                ref={inputRef}
                className="chat-input"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi Mi về project... (Enter gửi, Shift+Enter xuống dòng)"
                disabled={streaming}
                rows={1}
              />
              <div className="chat-input-actions">
                {streaming ? (
                  <button className="btn btn-danger btn-sm" onClick={handleStop}>⏹ Dừng</button>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSend}
                    disabled={!input.trim()}
                  >
                    Gửi ↵
                  </button>
                )}
              </div>
            </div>
            <div className="chat-input-hint">
              Enter để gửi · Shift+Enter xuống dòng · Model: <span className="chat-model-name">qwen2.5:7b</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
