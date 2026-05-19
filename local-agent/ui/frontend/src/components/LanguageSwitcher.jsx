import React, { useState } from 'react';
import { getLang, setLang, availableLangs } from '../i18n/index.js';

const FLAG = { vi: '🇻🇳', en: '🇺🇸' };

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const current = getLang();
  const currentLang = availableLangs.find((l) => l.code === current) ?? availableLangs[0];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'none',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: 'var(--text-muted)',
          padding: '4px 10px',
          fontSize: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
        title="Switch language"
      >
        <span>{FLAG[currentLang.code] ?? ''}</span>
        <span>{currentLang.label}</span>
        <span style={{ fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '110%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            zIndex: 200,
            minWidth: 140,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          {availableLangs.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { setOpen(false); setLang(lang.code); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '9px 14px',
                background: lang.code === current ? 'rgba(88,166,255,0.1)' : 'none',
                border: 'none',
                color: lang.code === current ? 'var(--blue)' : 'var(--text)',
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span>{FLAG[lang.code]}</span>
              <span>{lang.label}</span>
              {lang.code === current && <span style={{ marginLeft: 'auto', color: 'var(--blue)' }}>✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Click-outside overlay */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 199 }}
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
