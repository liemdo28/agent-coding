import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api.js';

export default function Chat() {
  const [messages,  setMessages]  = useState([
    {
      id: 'warning-0',
      role: 'warning',
      text: 'Note: Code suggestions from chat cannot be applied here. To apply changes, go to the Patches page.',
    },
  ]);
  const [input,     setInput]     = useState('');
  const [streaming, setStreaming] = useState(false);
  const cancelRef  = useRef(null);
  const bottomRef  = useRef(null);
  const agentIdRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (msg) => {
    setMessages((prev) => [...prev, msg]);
    return msg.id;
  };

  const updateAgentMessage = (id, appendText) => {
    setMessages((prev) =>
      prev.map((m) => m.id === id ? { ...m, text: m.text + appendText } : m)
    );
  };

  const handleSend = () => {
    const q = input.trim();
    if (!q || streaming) return;

    setInput('');
    const userMsg = { id: `u-${Date.now()}`, role: 'user', text: q };
    const agentId  = `a-${Date.now()}`;
    agentIdRef.current = agentId;

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: agentId, role: 'agent', text: '' },
    ]);
    setStreaming(true);

    cancelRef.current = api.streamPost(
      '/agent/ask',
      { question: q },
      (event, data) => {
        if (event === 'token') {
          updateAgentMessage(agentId, data.token ?? '');
        } else if (event === 'context') {
          if (data.warning) {
            setMessages((prev) => [
              ...prev,
              { id: `ctx-${Date.now()}`, role: 'warning', text: data.warning },
            ]);
          }
        } else if (event === 'error') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === agentId ? { ...m, text: `Error: ${data.message}`, error: true } : m
            )
          );
        }
      },
      () => setStreaming(false),
      (err) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentIdRef.current ? { ...m, text: `Error: ${err.message}`, error: true } : m
          )
        );
        setStreaming(false);
      }
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    cancelRef.current?.();
    setStreaming(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Chat</h1>
        <div className="badge badge-offline" style={{ fontSize: 11 }}>Local LLM</div>
      </div>

      <div className="card" style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column', padding: '16px' }}>
        <div className="chat-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-message ${msg.role}`}
              style={msg.error ? { borderColor: 'var(--red)', color: 'var(--red)' } : {}}
            >
              {msg.role === 'user' && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>You</div>}
              {msg.role === 'agent' && <div style={{ fontSize: 11, color: 'var(--blue)', marginBottom: 4 }}>Agent</div>}
              {msg.text || (msg.role === 'agent' && streaming ? <span className="spinner" /> : '')}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-row">
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the agent a question about your project..."
            disabled={streaming}
            rows={1}
          />
          {streaming ? (
            <button className="btn btn-danger" onClick={handleStop}>Stop</button>
          ) : (
            <button className="btn btn-primary" onClick={handleSend} disabled={!input.trim()}>
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
