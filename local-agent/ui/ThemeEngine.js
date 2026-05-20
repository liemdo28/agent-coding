// local-agent/ui/ThemeEngine.js
// Phase 109 — Autonomous Design
// Maps weather alert level + strategy recommendation to a CSS theme config.

const THEMES = {
  clear: {
    bgColor:        '#0f1117',
    headerBg:       '#0d2818',
    accentColor:    '#34d399',
    borderColor:    '#1a4a2e',
    textColor:      '#e2e8f0',
    dimText:        '#6ee7b7',
    pulsing:        false,
    alertBanner:    false,
    label:          'clear',
  },
  watch: {
    bgColor:        '#0f0e0a',
    headerBg:       '#2d2000',
    accentColor:    '#fbbf24',
    borderColor:    '#4a3a00',
    textColor:      '#f1f5f9',
    dimText:        '#fcd34d',
    pulsing:        false,
    alertBanner:    false,
    label:          'watch',
  },
  warning: {
    bgColor:        '#0f0a08',
    headerBg:       '#3d1a08',
    accentColor:    '#fb923c',
    borderColor:    '#5a2a10',
    textColor:      '#f1f5f9',
    dimText:        '#fdba74',
    pulsing:        false,
    alertBanner:    true,
    label:          'warning',
  },
  storm: {
    bgColor:        '#100808',
    headerBg:       '#3d0808',
    accentColor:    '#f87171',
    borderColor:    '#5a1010',
    textColor:      '#ffffff',
    dimText:        '#fca5a5',
    pulsing:        true,
    alertBanner:    true,
    label:          'storm',
  },
};

const COLLAPSED_BY_RECOMMENDATION = {
  run_full:  [],
  run_lite:  ['analytics', 'species'],
  defer:     ['analytics', 'species', 'ecology'],
  alert:     [],
};

/**
 * Select a ThemeConfig based on weather alert level and strategy recommendation.
 *
 * @param {'clear'|'watch'|'warning'|'storm'} alertLevel
 * @param {'run_full'|'run_lite'|'defer'|'alert'} recommendation
 * @returns {ThemeConfig}
 */
export function selectTheme(alertLevel, recommendation) {
  const theme = { ...(THEMES[alertLevel] ?? THEMES.clear) };
  theme.collapsedPanels = COLLAPSED_BY_RECOMMENDATION[recommendation] ?? [];
  theme.recommendation  = recommendation;
  return theme;
}

/**
 * Apply theme variables to an HTML template string.
 * Replaces {{THEME_BG}}, {{THEME_ACCENT}}, etc.
 *
 * @param {string}      html
 * @param {ThemeConfig} theme
 * @returns {string}
 */
export function applyTheme(html, theme) {
  return html
    .replace(/\{\{THEME_BG\}\}/g,     theme.bgColor)
    .replace(/\{\{THEME_HEADER_BG\}\}/g, theme.headerBg)
    .replace(/\{\{THEME_ACCENT\}\}/g,  theme.accentColor)
    .replace(/\{\{THEME_BORDER\}\}/g,  theme.borderColor)
    .replace(/\{\{THEME_TEXT\}\}/g,    theme.textColor)
    .replace(/\{\{THEME_DIM\}\}/g,     theme.dimText)
    .replace(/\{\{THEME_LABEL\}\}/g,   theme.label)
    .replace(/\{\{THEME_PULSING\}\}/g, theme.pulsing ? 'pulsing' : '')
    .replace(/\{\{THEME_RECOMMENDATION\}\}/g, theme.recommendation ?? '');
}
