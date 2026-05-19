// services/api.js — fetch wrapper for the backend
const BASE = '/api'; // proxied to http://127.0.0.1:4001 by Vite in dev

export const api = {
  get(path) {
    return fetch(BASE + path).then((r) => {
      if (!r.ok) return r.json().then((e) => { throw new Error(e.error ?? r.statusText); });
      return r.json();
    });
  },

  post(path, body) {
    return fetch(BASE + path, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }).then((r) => {
      if (!r.ok) return r.json().then((e) => { throw new Error(e.error ?? r.statusText); });
      return r.json();
    });
  },

  patch(path, body) {
    return fetch(BASE + path, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }).then((r) => {
      if (!r.ok) return r.json().then((e) => { throw new Error(e.error ?? r.statusText); });
      return r.json();
    });
  },

  delete(path) {
    return fetch(BASE + path, { method: 'DELETE' }).then((r) => {
      if (!r.ok) return r.json().then((e) => { throw new Error(e.error ?? r.statusText); });
      return r.json();
    });
  },

  /**
   * Stream Server-Sent Events from the backend.
   * @param {string} path - e.g. '/agent/ask'
   * @param {object} body - POST body
   * @param {function} onEvent - called with (eventName, data)
   * @param {function} onDone  - called when stream closes
   * @param {function} onError - called on error
   * @returns {function} cancel — call to abort the request
   */
  streamPost(path, body, onEvent, onDone, onError) {
    const controller = new AbortController();

    fetch(BASE + path, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          onError?.(new Error(err.error ?? res.statusText));
          return;
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          // Parse SSE lines
          const lines = buf.split('\n');
          buf = lines.pop(); // keep last incomplete line

          let eventName = 'message';
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              const raw = line.slice(5).trim();
              if (!raw) continue;
              try {
                const data = JSON.parse(raw);
                onEvent?.(eventName, data);
              } catch {
                onEvent?.(eventName, { raw });
              }
              eventName = 'message';
            } else if (line === '') {
              eventName = 'message';
            }
          }
        }
        onDone?.();
      })
      .catch((err) => {
        if (err.name !== 'AbortError') onError?.(err);
        else onDone?.();
      });

    return () => controller.abort();
  },
};
