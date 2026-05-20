// design-system/design-token-engine.js - Centralized design token management system
import { EventEmitter } from 'events';

/**
 * DesignTokenEngine - Central hub for all design tokens
 * Manages colors, spacing, typography, animation, shadows, and glow systems
 * Supports export to CSS, JSON, and runtime token management
 */
export class DesignTokenEngine extends EventEmitter {
  constructor(initialTokens = {}) {
    super();
    this._tokens = this._mergeWithDefaults(initialTokens);
    this._themes = this._initializeThemes();
    this._history = [];
    this._historyIndex = -1;
  }

  // ── Default Token Definitions ────────────────────────────────────────────────

  _getDefaults() {
    return {
      color: this._defaultColors(),
      spacing: this._defaultSpacing(),
      typography: this._defaultTypography(),
      animation: this._defaultAnimation(),
      shadow: this._defaultShadows(),
      glow: this._defaultGlows(),
      border: this._defaultBorders(),
      zIndex: this._defaultZIndex(),
      breakpoint: this._defaultBreakpoints(),
      radius: this._defaultRadius(),
    };
  }

  _defaultColors() {
    return {
      palette: {
        gray: {
          50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db',
          400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151',
          800: '#1f2937', 900: '#111827', 950: '#030712',
        },
        primary: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
          400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
          800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
        },
        secondary: {
          50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
          400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
          800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065',
        },
        accent: {
          50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9',
          400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490',
          800: '#155e75', 900: '#164e63', 950: '#083344',
        },
        success: {
          50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
          400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
          800: '#166534', 900: '#14532d', 950: '#052e16',
        },
        warning: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
          800: '#92400e', 900: '#78350f', 950: '#451a03',
        },
        error: {
          50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
          400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
          800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a',
        },
        info: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
        },
      },
      semantic: {
        background: { primary: '#ffffff', secondary: '#f9fafb', tertiary: '#f3f4f6' },
        surface:    { primary: '#ffffff', elevated: '#ffffff', overlay: 'rgba(0,0,0,0.5)' },
        text:       { primary: '#111827', secondary: '#4b5563', tertiary: '#9ca3af', inverse: '#ffffff' },
        border:     { primary: '#e5e7eb', secondary: '#d1d5db', strong: '#9ca3af' },
        interactive: { primary: '#6366f1', secondary: '#8b5cf6', hover: '#4f46e5', active: '#4338ca', disabled: '#d1d5db' },
        focus:      { ring: '#6366f1', outline: '#4f46e5' },
        selected:   { background: '#eef2ff', text: '#4338ca' },
      },
      theme: {
        light: {
          background: '#ffffff', surface: '#f9fafb', text: '#111827',
          textSecondary: '#4b5563', border: '#e5e7eb', primary: '#6366f1', secondary: '#8b5cf6',
        },
        dark: {
          background: '#111827', surface: '#1f2937', text: '#f9fafb',
          textSecondary: '#9ca3af', border: '#374151', primary: '#818cf8', secondary: '#a78bfa',
        },
      },
    };
  }

  _defaultSpacing() {
    const base = 4;
    return {
      base, unit: 'px',
      scale: {
        0: '0px', px: '1px', 0.5: '2px',
        1: `${base}px`, 2: `${base * 2}px`, 3: `${base * 3}px`, 4: `${base * 4}px`,
        5: `${base * 5}px`, 6: `${base * 6}px`, 8: `${base * 8}px`,
        10: `${base * 10}px`, 12: `${base * 12}px`, 16: `${base * 16}px`,
        20: `${base * 20}px`, 24: `${base * 24}px`, 32: `${base * 32}px`,
      },
      names: {
        none: '0px', xs: '4px', sm: '8px', md: '16px', lg: '24px',
        xl: '32px', '2xl': '48px', '3xl': '64px', '4xl': '96px', '5xl': '128px',
      },
      component: {
        badge: { paddingX: '6px', paddingY: '2px' },
        button: { paddingX: '16px', paddingY: '8px', iconGap: '8px' },
        input: { paddingX: '12px', paddingY: '8px' },
        card: { padding: '16px', gap: '16px' },
        modal: { padding: '24px', gap: '16px' },
        page: { padding: '24px', gap: '24px' },
        section: { gap: '32px' },
      },
    };
  }

  _defaultTypography() {
    return {
      fontFamily: {
        sans: "'Inter', system-ui, -apple-system, sans-serif",
        serif: "'Georgia', 'Times New Roman', serif",
        mono: "'JetBrains Mono', 'Fira Code', monospace",
        display: "'Inter', system-ui, sans-serif",
      },
      fontSize: {
        xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem',
        xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem',
        '5xl': '3rem', '6xl': '3.75rem', '7xl': '4.5rem',
      },
      fontWeight: {
        thin: 100, extralight: 200, light: 300, regular: 400,
        medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900,
      },
      lineHeight: {
        none: 1, tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2,
      },
      letterSpacing: {
        tighter: '-0.05em', tight: '-0.025em', normal: '0em',
        wide: '0.025em', wider: '0.05em', widest: '0.1em',
      },
      scale: {
        xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem',
        xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem',
      },
    };
  }

  _defaultAnimation() {
    return {
      duration: {
        0: '0ms', 75: '75ms', 100: '100ms', 150: '150ms', 200: '200ms',
        300: '300ms', 500: '500ms', 700: '700ms', 1000: '1000ms',
        fast: '150ms', normal: '300ms', slow: '500ms', slower: '700ms',
      },
      easing: {
        linear: 'linear', default: 'ease-in-out', in: 'ease-in', out: 'ease-out',
        inOut: 'ease-in-out', spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        fadeIn:       [{ opacity: 0 }, { opacity: 1 }],
        fadeOut:      [{ opacity: 1 }, { opacity: 0 }],
        slideInUp:    [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
        slideInDown:  [{ transform: 'translateY(-16px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
        slideInLeft:  [{ transform: 'translateX(-16px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
        slideInRight: [{ transform: 'translateX(16px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
        scaleIn:      [{ transform: 'scale(0.95)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
        scaleOut:     [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.95)', opacity: 0 }],
        spin:         [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        pulse:        [{ opacity: 1 }, { opacity: 0.5 }, { opacity: 1 }],
        bounce:       [{ transform: 'translateY(0)' }, { transform: 'translateY(-25%)' }, { transform: 'translateY(0)' }],
        shake:        [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }],
      },
      transition: {
        property: {
          all: 'all', color: 'color', opacity: 'opacity', transform: 'transform', boxShadow: 'box-shadow',
        },
        complex: 'color 150ms ease-in-out, opacity 150ms ease-in-out, transform 150ms ease-in-out',
      },
    };
  }

  _defaultShadows() {
    return {
      none:    'none',
      xs:      '0 1px 2px rgba(0, 0, 0, 0.05)',
      sm:      '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
      md:      '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
      lg:      '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
      xl:      '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
      '2xl':   '0 25px 50px rgba(0, 0, 0, 0.15)',
      '3xl':   '0 32px 64px rgba(0, 0, 0, 0.15)',
      inner:   'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
      colored: (color = '#6366f1', alpha = 0.15) =>
        `0 4px 14px color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`,
      floating: '0 8px 30px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08)',
      outline:  (color = '#6366f1') => `0 0 0 3px color-mix(in srgb, ${color} 30%, transparent)`,
    };
  }

  _defaultGlows() {
    return {
      none:    'none',
      subtle:  '0 0 8px rgba(99, 102, 241, 0.2)',
      medium:  '0 0 16px rgba(99, 102, 241, 0.3)',
      strong:  '0 0 24px rgba(99, 102, 241, 0.4)',
      intense: '0 0 32px rgba(99, 102, 241, 0.5)',
      colored: (color = '#6366f1') => `0 0 20px color-mix(in srgb, ${color} 40%, transparent)`,
      ambient: (color = '#6366f1') => `0 0 40px color-mix(in srgb, ${color} 20%, transparent)`,
      text:    (color = '#6366f1') => `0 0 8px color-mix(in srgb, ${color} 50%, transparent)`,
      animated: {
        pulse: {
          name: 'glowPulse',
          keyframes: [
            { boxShadow: '0 0 16px rgba(99, 102, 241, 0.3)' },
            { boxShadow: '0 0 32px rgba(99, 102, 241, 0.6)' },
            { boxShadow: '0 0 16px rgba(99, 102, 241, 0.3)' },
          ],
          duration: '2s', iterationCount: 'infinite',
        },
        breathe: {
          name: 'glowBreathe',
          keyframes: [
            { boxShadow: '0 0 10px rgba(99, 102, 241, 0.2)' },
            { boxShadow: '0 0 30px rgba(99, 102, 241, 0.5)' },
            { boxShadow: '0 0 10px rgba(99, 102, 241, 0.2)' },
          ],
          duration: '4s', iterationCount: 'infinite',
        },
      },
    };
  }

  _defaultBorders() {
    return {
      width: { 0: '0px', 1: '1px', 2: '2px', 4: '4px', 8: '8px' },
      radius: {
        none: '0px', sm: '2px', DEFAULT: '4px', md: '4px', lg: '8px',
        xl: '12px', '2xl': '16px', '3xl': '24px', full: '9999px',
      },
    };
  }

  _defaultZIndex() {
    return {
      0: 0, 10: 10, 20: 20, 30: 30, 40: 40, 50: 50,
      dropdown: 1000, sticky: 1100, fixed: 1200,
      modalBackdrop: 1300, modal: 1400, popover: 1500, tooltip: 1600, toast: 1700,
    };
  }

  _defaultBreakpoints() {
    return {
      xs:   { min: '0px',    max: '479px',  name: 'Extra Small' },
      sm:   { min: '480px',  max: '767px',  name: 'Small' },
      md:   { min: '768px',  max: '1023px', name: 'Medium' },
      lg:   { min: '1024px', max: '1279px', name: 'Large' },
      xl:   { min: '1280px', max: '1535px', name: 'Extra Large' },
      '2xl': { min: '1536px', name: '2XL' },
    };
  }

  _defaultRadius() {
    return {
      none: '0px', sm: '2px', DEFAULT: '4px', md: '4px', lg: '8px',
      xl: '12px', '2xl': '16px', '3xl': '24px', full: '9999px',
    };
  }

  _mergeWithDefaults(initialTokens) {
    const defaults = this._getDefaults();
    return this._deepMerge(defaults, initialTokens);
  }

  _deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source || {})) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  _initializeThemes() {
    return {
      light: { ...this._tokens.color.theme.light },
      dark:  { ...this._tokens.color.theme.dark },
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Get all design tokens */
  getDesignTokens() {
    return JSON.parse(JSON.stringify(this._tokens));
  }

  /** Get a specific token by dot-path */
  get(path, fallback = undefined) {
    const parts = path.split('.');
    let current = this._tokens;
    for (const part of parts) {
      if (current === undefined || current === null) return fallback;
      current = current[part];
    }
    return current !== undefined ? current : fallback;
  }

  /** Set tokens (partial update, supports dot-path or full object) */
  setDesignTokens(pathOrTokens, value) {
    this._saveHistory();
    if (typeof pathOrTokens === 'string') {
      const parts = pathOrTokens.split('.');
      let current = this._tokens;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    } else {
      this._tokens = this._mergeWithDefaults(pathOrTokens);
    }
    this.emit('change', { path: pathOrTokens, value });
  }

  /** Export all tokens as CSS custom properties */
  exportAsCSS(options = {}) {
    const { scope = ':root', darkScope = '[data-theme="dark"]', prefix = '' } = options;
    const vars = this._flattenTokens(this._tokens, prefix);
    const darkVars = this._flattenTokens(this._tokens.color.theme.dark, prefix);

    let css = `${scope} {\n`;
    for (const [name, val] of Object.entries(vars)) {
      css += `  ${name}: ${val};\n`;
    }
    css += `}\n\n`;
    if (darkVars && Object.keys(darkVars).length > 0) {
      css += `${darkScope} {\n`;
      for (const [name, val] of Object.entries(darkVars)) {
        css += `  ${name}: ${val};\n`;
      }
      css += `}\n`;
    }
    return css;
  }

  /** Export tokens as JSON */
  exportAsJSON(options = {}) {
    const { pretty = true, flatten = false, exclude = [] } = options;
    let tokens = this._tokens;
    if (exclude.length > 0) {
      tokens = this._excludeKeys(JSON.parse(JSON.stringify(tokens)), exclude);
    }
    if (flatten) tokens = this._flattenTokens(tokens);
    return pretty ? JSON.stringify(tokens, null, 2) : JSON.stringify(tokens);
  }

  /** Export tokens as TypeScript type definitions */
  exportAsTypeScript() {
    let ts = '// Auto-generated design tokens interface\n\n';
    ts += 'export interface DesignTokens {\n';
    ts += this._tsInterface(this._tokens, '  ').lines.join('\n') + '\n';
    ts += '}\n';
    ts += `\nexport type Theme = 'light' | 'dark';\n`;
    ts += `export type Spacing = '${Object.keys(this._tokens.spacing.names || {}).join("' | '")}';\n`;
    ts += `export type FontSize = '${Object.keys(this._tokens.typography.fontSize || {}).join("' | '")}';\n`;
    const shadowKeys = Object.keys(this._tokens.shadow || {}).filter(k => typeof this._tokens.shadow[k] === 'string');
    ts += `export type Shadow = '${shadowKeys.join("' | '")}';\n`;
    return ts;
  }

  _tsInterface(obj, indent) {
    const lines = [];
    for (const [key, val] of Object.entries(obj)) {
      const safeName = key.replace(/[^a-zA-Z0-9_]/g, '_');
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        lines.push(`${indent}${safeName}: {`);
        lines.push(...this._tsInterface(val, indent + '  ').lines);
        lines.push(`${indent}}`);
      } else if (typeof val === 'string') {
        lines.push(`${indent}${safeName}: string;`);
      } else if (typeof val === 'number') {
        lines.push(`${indent}${safeName}: number;`);
      } else if (typeof val === 'boolean') {
        lines.push(`${indent}${safeName}: boolean;`);
      }
    }
    return { lines };
  }

  /** Get tokens for a specific theme */
  getTheme(theme) {
    return this._themes[theme] || this._themes.light;
  }

  /** Switch active theme (updates semantic tokens) */
  setTheme(theme) {
    if (!this._themes[theme]) return;
    this._saveHistory();
    const t = this._themes[theme];
    this._tokens.color.semantic.background.primary  = t.background;
    this._tokens.color.semantic.surface.primary     = t.surface;
    this._tokens.color.semantic.text.primary         = t.text;
    this._tokens.color.semantic.text.secondary        = t.textSecondary;
    this._tokens.color.semantic.border.primary        = t.border;
    this._tokens.color.semantic.interactive.primary   = t.primary;
    this._tokens.color.semantic.interactive.hover     = t.primary;
    this.emit('themeChange', theme);
  }

  /** Register a custom theme */
  registerTheme(name, tokens) {
    this._themes[name] = tokens;
    this.emit('themeRegistered', name);
  }

  // ── History / Undo ─────────────────────────────────────────────────────────

  _saveHistory() {
    this._history = this._history.slice(0, this._historyIndex + 1);
    this._history.push(JSON.stringify(this._tokens));
    this._historyIndex = this._history.length - 1;
    if (this._history.length > 50) {
      this._history.shift();
      this._historyIndex--;
    }
  }

  undo() {
    if (this._historyIndex <= 0) return false;
    this._historyIndex--;
    this._tokens = JSON.parse(this._history[this._historyIndex]);
    this.emit('change', { action: 'undo' });
    return true;
  }

  redo() {
    if (this._historyIndex >= this._history.length - 1) return false;
    this._historyIndex++;
    this._tokens = JSON.parse(this._history[this._historyIndex]);
    this.emit('change', { action: 'redo' });
    return true;
  }

  // ── Utility ─────────────────────────────────────────────────────────────────

  _flattenTokens(obj, prefix = '') {
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      const varName = prefix ? `${prefix}-${key}` : `--${key}`;
      if (typeof val === 'object' && val !== null && !Array.isArray(val) && !this._isColorObject(val)) {
        Object.assign(result, this._flattenTokens(val, varName));
      } else if (val !== null && val !== undefined) {
        result[varName] = String(val);
      }
    }
    return result;
  }

  _isColorObject(obj) {
    if (typeof obj !== 'object') return false;
    const vals = Object.values(obj);
    return vals.length > 0 && vals.every(v => typeof v === 'string' && /^#|^rgb|^hsl|^color-mix/.test(v));
  }

  _excludeKeys(obj, exclude) {
    const result = { ...obj };
    for (const key of Object.keys(result)) {
      if (exclude.includes(key)) {
        delete result[key];
      } else if (typeof result[key] === 'object') {
        result[key] = this._excludeKeys(result[key], exclude);
      }
    }
    return result;
  }

  /** Compute contrast ratio between two colors */
  static contrastRatio(fg, bg) {
    const lum = (hex) => {
      const rgb = hex.replace('#', '').match(/.{2}/g).map(v => {
        const c = parseInt(v, 16) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    };
    const l1 = lum(fg), l2 = lum(bg);
    const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /** Get all token categories */
  getCategories() {
    return Object.keys(this._tokens);
  }

  /** Validate tokens against a schema */
  validate(schema) {
    const errors = [];
    for (const [category, fields] of Object.entries(schema)) {
      if (!this._tokens[category]) {
        errors.push(`Missing category: ${category}`);
        continue;
      }
      for (const field of Object.keys(fields)) {
        if (this._tokens[category][field] === undefined) {
          errors.push(`Missing token: ${category}.${field}`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }
}

export default DesignTokenEngine;
