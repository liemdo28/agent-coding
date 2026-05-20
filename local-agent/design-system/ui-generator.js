// design-system/ui-generator.js - AI-powered UI generation from natural language requests
import { DesignTokenEngine } from './design-token-engine.js';
import { UIHealthAnalyzer }   from './ui-health-analyzer.js';

const GENERATION_PROMPTS = {
  dashboard: {
    layout:      'sidebar + main content + header pattern',
    components:  ['DataTable', 'Chart', 'MetricCard', 'FilterBar', 'ActionButton'],
    motion:      'subtle entrance animations, data refresh pulses',
    interaction: 'hover states, inline editing, drill-down navigation',
  },
  'landing-page': {
    layout:      'hero + features + testimonials + CTA sections',
    components:  ['HeroSection', 'FeatureCard', 'TestimonialSlider', 'CTABlock', 'NavBar'],
    motion:      'parallax scroll, fade-in sections, button hover glows',
    interaction: 'smooth scroll anchors, modal triggers, form validation',
  },
  settings: {
    layout:      'vertical tab navigation + content panel',
    components:  ['SettingsGroup', 'ToggleSwitch', 'InputField', 'SaveBar', 'ProfileAvatar'],
    motion:      'slide-in tabs, form feedback pulses',
    interaction: 'auto-save indicators, validation hints, confirmation dialogs',
  },
  'data-table': {
    layout:      'header filters + sortable columns + pagination footer',
    components:  ['TableHeader', 'TableRow', 'Pagination', 'ColumnMenu', 'BulkActionBar'],
    motion:      'row highlight transitions, skeleton loading, sort indicator spin',
    interaction: 'row selection, column resize, inline edit, export trigger',
  },
  form: {
    layout:      'single column with grouped sections',
    components:  ['FormGroup', 'TextInput', 'SelectDropdown', 'CheckboxGroup', 'SubmitButton'],
    motion:      'field focus glow, error shake, success checkmark',
    interaction: 'real-time validation, conditional fields, autofill support',
  },
};

const DEFAULT_GENERATION = {
  layout:      'single column centered layout',
  components:   ['Card', 'Button', 'Input', 'Heading', 'Divider'],
  motion:      'fade-in on mount, hover scale',
  interaction: 'click handlers, focus states, disabled states',
};

// ── Request Parser ───────────────────────────────────────────────────────────

function parseRequest(request) {
  const lower  = request.toLowerCase();
  const tokens = lower.split(/\s+/);

  let type = 'generic';
  for (const key of Object.keys(GENERATION_PROMPTS)) {
    if (lower.includes(key)) { type = key; break; }
  }

  const intents = [];
  if (tokens.includes('redesign') || tokens.includes('revamp')) intents.push('redesign');
  if (tokens.includes('new') || tokens.includes('create') || tokens.includes('build')) intents.push('create');
  if (tokens.includes('fix') || tokens.includes('improve') || tokens.includes('optimize')) intents.push('optimize');
  if (tokens.includes('mobile') || tokens.includes('responsive')) intents.push('responsive');
  if (tokens.includes('dark') || tokens.includes('dark-mode')) intents.push('dark-mode');

  const styles = [];
  if (tokens.includes('modern') || tokens.includes('minimal') || tokens.includes('clean')) styles.push('modern');
  if (tokens.includes('bold') || tokens.includes('vibrant') || tokens.includes('colorful')) styles.push('bold');
  if (tokens.includes('corporate') || tokens.includes('professional') || tokens.includes('enterprise')) styles.push('corporate');
  if (tokens.includes('playful') || tokens.includes('fun') || tokens.includes('friendly')) styles.push('playful');
  if (tokens.includes('glass') || tokens.includes('glassmorphism')) styles.push('glassmorphism');
  if (tokens.includes('neon') || tokens.includes('cyber')) styles.push('neon');

  return { type, intents, styles, raw: request };
}

// ── UIGenerator ─────────────────────────────────────────────────────────────

export class UIGenerator {
  constructor(options = {}) {
    this.tokenEngine    = new DesignTokenEngine(options.tokens);
    this.healthAnalyzer = new UIHealthAnalyzer();
    this.history        = [];
  }

  /**
   * Main generation method. Takes a natural language request and produces
   * a full design specification: layout, colors, typography, components, motion, interaction.
   *
   * @param {string} request   - e.g. "redesign dashboard", "create a landing page with neon style"
   * @param {object} context   - optional existing UI code to analyze
   * @returns {Promise<UIDesignSpec>}
   */
  async generate(request, context = {}) {
    const parsed   = parseRequest(request);
    const template = GENERATION_PROMPTS[parsed.type] || DEFAULT_GENERATION;

    const spec = {
      id:          `design_${Date.now()}`,
      request,
      parsed,
      version:     '1.0',
      generatedAt: new Date().toISOString(),
      layout:           this._generateLayout(parsed, template),
      colors:           this._generateColors(parsed),
      typography:       this._generateTypography(parsed),
      spacing:          this._generateSpacing(),
      components:       this._generateComponentHierarchy(template.components, parsed),
      motion:           this._generateMotion(parsed, template),
      interaction:      this._generateInteraction(parsed, template),
      glows:            this._generateGlows(parsed),
      shadows:          this._generateShadows(parsed),
      animations:        this._generateAnimationTokens(parsed),
      cssVariables:      {},
      tailwindConfig:    {},
      componentTemplates: this._generateComponentTemplates(template.components),
      accessibility:     this._generateAccessibility(parsed),
      breakpoints:       this._generateBreakpoints(),
      themes:            this._generateThemes(parsed),
    };

    spec.cssVariables    = this._generateCSSVariables(spec);
    spec.tailwindConfig = this._generateTailwindConfig(spec);

    this.history.push({ request, parsed, id: spec.id, timestamp: spec.generatedAt });
    return spec;
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  _generateLayout(parsed, template) {
    const map = {
      dashboard: {
        type: 'dashboard', grid: 'css-grid',
        regions: [
          { id: 'header',   name: 'Header',    height: '64px',  sticky: true },
          { id: 'sidebar',  name: 'Sidebar',   width: '240px', collapsible: true, positions: ['left', 'right'] },
          { id: 'main',     name: 'Main',      flex: 1,        overflow: 'auto' },
          { id: 'footer',   name: 'Footer',    height: '48px', sticky: false },
        ],
        gridTemplate: 'sidebar + main with header bar',
        gap: '16px', padding: '24px',
      },
      'landing-page': {
        type: 'landing', grid: 'section-based',
        regions: [
          { id: 'hero',         name: 'Hero Section',    height: '100vh',  fullWidth: true },
          { id: 'nav',          name: 'Navigation',      position: 'fixed', height: '72px', fullWidth: true },
          { id: 'features',     name: 'Features Grid',   maxWidth: '1200px', centered: true },
          { id: 'testimonials', name: 'Social Proof',    maxWidth: '960px',  centered: true },
          { id: 'cta',         name: 'Call to Action',  fullWidth: true,    height: '400px' },
        ],
        scrollBehavior: 'smooth',
      },
      settings: {
        type: 'settings', grid: 'flex',
        regions: [
          { id: 'page-header', name: 'Page Header',     height: '80px' },
          { id: 'nav-tabs',    name: 'Tab Navigation',  width: '220px', vertical: true },
          { id: 'content',     name: 'Content Panel',   flex: 1, maxWidth: '720px' },
          { id: 'save-bar',    name: 'Sticky Save Bar', position: 'fixed-bottom', height: '64px' },
        ],
      },
      'data-table': {
        type: 'data-table', grid: 'flex-column',
        regions: [
          { id: 'toolbar',    name: 'Toolbar',        height: '56px', flex: 'row' },
          { id: 'filters',    name: 'Filter Bar',      height: 'auto', collapsible: true },
          { id: 'table',      name: 'Table Container', flex: 1,       overflow: 'auto' },
          { id: 'pagination', name: 'Pagination',      height: '52px' },
        ],
      },
      form: {
        type: 'form', grid: 'single-column',
        regions: [
          { id: 'form-header', name: 'Form Header',   height: 'auto' },
          { id: 'sections',   name: 'Form Sections', flex: 1, gap: '32px' },
          { id: 'actions',    name: 'Action Buttons', height: 'auto', align: 'right' },
        ],
        maxWidth: '640px',
      },
      generic: {
        type: 'generic', grid: 'single-column-centered',
        regions: [
          { id: 'container', name: 'Container', maxWidth: '1200px', centered: true, padding: '24px' },
        ],
      },
    };

    const layout = map[parsed.type] || map.generic;
    if (parsed.styles.includes('glassmorphism')) {
      layout.glassEffect    = true;
      layout.backgroundBlur = 'backdrop-filter: blur(12px)';
    }
    if (parsed.intents.includes('responsive')) {
      layout.responsiveStrategy = 'mobile-first';
    }
    layout.breakpoints = ['mobile', 'tablet', 'desktop', 'wide'];
    return layout;
  }

  // ── Colors ─────────────────────────────────────────────────────────────────

  _generateColors(parsed) {
    if (parsed.styles.includes('neon')) {
      return {
        primary:   '#00ff88', secondary: '#ff00ff', accent: '#00ffff',
        background: { light: '#0a0a0f', dark: '#050508' },
        surface:    { light: '#1a1a2e', dark: '#12121f' },
        text:       { primary: '#ffffff', secondary: '#b0b0c0', muted: '#606080' },
        border:     '#2a2a3e',
        glow:       { primary: '0 0 20px #00ff8866', secondary: '0 0 20px #ff00ff66' },
        status:     { success: '#00ff88', warning: '#ffcc00', error: '#ff4444', info: '#00ccff' },
      };
    }
    if (parsed.styles.includes('bold')) {
      return {
        primary:   '#ff4500', secondary: '#ff6b35', accent: '#ffd700',
        background: { light: '#fff5ee', dark: '#1a0a00' },
        surface:    { light: '#ffffff', dark: '#2a1500' },
        text:       { primary: { light: '#1a0a00', dark: '#fff5ee' }, secondary: { light: '#7a3b10', dark: '#d4956a' }, muted: { light: '#a06840', dark: '#a06840' } },
        border:     { light: '#ffcc99', dark: '#7a3b10' },
        glow:       { primary: '0 0 20px #ff450066', secondary: '0 0 20px #ffd70066' },
        status:     { success: '#32cd32', warning: '#ffa500', error: '#dc143c', info: '#1e90ff' },
      };
    }
    if (parsed.styles.includes('corporate')) {
      return {
        primary:   '#1e3a5f', secondary: '#2d5a87', accent: '#4a90d9',
        background: { light: '#f0f4f8', dark: '#0a1628' },
        surface:    { light: '#ffffff', dark: '#122540' },
        text:       { primary: { light: '#1a2a3a', dark: '#e8eef4' }, secondary: { light: '#5a7a9a', dark: '#8aaac8' }, muted: { light: '#8aaac8', dark: '#5a7a9a' } },
        border:     { light: '#d0dce8', dark: '#1e3a5f' },
        glow:       { primary: '0 0 12px #1e3a5f44', secondary: '0 0 12px #4a90d944' },
        status:     { success: '#2e8b57', warning: '#d4a017', error: '#b22222', info: '#4682b4' },
      };
    }
    if (parsed.styles.includes('playful')) {
      return {
        primary:   '#ff6b9d', secondary: '#c44dff', accent: '#ffd93d',
        background: { light: '#fff8f0', dark: '#1a0f2e' },
        surface:    { light: '#ffffff', dark: '#241540' },
        text:       { primary: { light: '#2d1b50', dark: '#f8f0ff' }, secondary: { light: '#6b4d8a', dark: '#b89adc' }, muted: { light: '#9b7ab0', dark: '#7b5a9a' } },
        border:     { light: '#e8d0f0', dark: '#3d2060' },
        glow:       { primary: '0 0 16px #ff6b9d66', secondary: '0 0 16px #c44dff66', accent: '0 0 16px #ffd93d66' },
        status:     { success: '#4ade80', warning: '#fbbf24', error: '#f87171', info: '#60a5fa' },
      };
    }
    return {
      primary:   '#6366f1', secondary: '#8b5cf6', accent: '#06b6d4',
      background: { light: '#f8fafc', dark: '#0f172a' },
      surface:    { light: '#ffffff', dark: '#1e293b' },
      text:       { primary: { light: '#0f172a', dark: '#f1f5f9' }, secondary: { light: '#64748b', dark: '#94a3b8' }, muted: { light: '#94a3b8', dark: '#64748b' } },
      border:     { light: '#e2e8f0', dark: '#334155' },
      glow:       { primary: '0 0 16px #6366f144', secondary: '0 0 16px #8b5cf644' },
      status:     { success: '#22c55e', warning: '#f59e0b', error: '#ef4444', info: '#3b82f6' },
    };
  }

  // ── Typography ─────────────────────────────────────────────────────────────

  _generateTypography(parsed) {
    const scales = {
      'minor-second':   [0.8,   0.89,  1,     1.125, 1.266, 1.424, 1.602, 1.802, 2.027],
      'minor-third':    [0.75,  0.875, 1,     1.2,   1.44,  1.728, 2.074, 2.488, 2.986],
      'major-third':    [0.8,   0.889, 1,     1.25,  1.563, 1.953, 2.441, 3.052, 3.815],
      'perfect-fourth': [0.75,  0.875, 1,     1.333, 1.777, 2.369, 3.157, 4.209, 5.61],
    };
    const ratios = scales['minor-third'];
    const b = (n) => `${(ratios[n] * 16).toFixed(3)}px`;

    const family = parsed.styles.includes('corporate')
      ? { primary: "'IBM Plex Sans', system-ui, sans-serif", mono: "'IBM Plex Mono', monospace" }
      : { primary: "'Inter', system-ui, sans-serif",          mono: "'JetBrains Mono', monospace" };

    return {
      fontFamily:    family,
      scale:         ratios,
      baseSize:      16,
      lineHeight:    { body: 1.6, heading: 1.2, tight: 1.1 },
      fontWeight:    { regular: 400, medium: 500, semibold: 600, bold: 700 },
      letterSpacing: { tight: '-0.02em', normal: '0', wide: '0.05em' },
      sizes: {
        xs: b(1), sm: b(2), base: b(3),
        lg: b(4), xl: b(5), '2xl': b(6), '3xl': b(7), '4xl': b(8),
      },
    };
  }

  // ── Spacing ───────────────────────────────────────────────────────────────

  _generateSpacing() {
    const base = 4;
    const scale = [0,1,2,3,4,5,6,7,8,9,10,11,12,14,16,20,24,28,32,36,40,48,56,64];
    const named = (n) => `${n * base}px`;
    const tokens = {};
    for (const n of scale) tokens[n] = named(n);

    return {
      base,
      scale:   tokens,
      names:   { none: '0px', xs: named(1), sm: named(2), md: named(4), lg: named(6), xl: named(8), '2xl': named(12), '3xl': named(16), '4xl': named(24) },
      component: {
        buttonPadding: `${named(2)} ${named(4)}`,
        inputPadding:  `${named(2)} ${named(3)}`,
        cardPadding:   named(4),
        modalPadding:  named(6),
        sectionGap:    named(8),
      },
    };
  }

  // ── Component Hierarchy ──────────────────────────────────────────────────

  _generateComponentHierarchy(componentNames, parsed) {
    const defs = {
      DataTable:        { type: 'data-display', props: ['columns','data','sortable','selectable','pagination','loading'], states: ['default','loading','empty','error','filtered'], children: ['TableHeader','TableRow','Pagination'], a11y: 'role="table", sortable columns announced, row selection announced' },
      Chart:            { type: 'data-display', props: ['type','data','options','responsive','animations'], states: ['loading','loaded','error','no-data'], children: [], a11y: 'data tables available for screen readers' },
      MetricCard:       { type: 'data-display', props: ['label','value','trend','icon','color'], states: ['default','loading','updating','trend-up','trend-down'], children: ['TrendIndicator'], a11y: 'value announced, trend direction via aria-label' },
      FilterBar:        { type: 'input', props: ['filters','onChange','searchable','collapsible'], states: ['collapsed','expanded','filtering'], children: ['TextInput','SelectDropdown','DatePicker'], a11y: 'filter controls labeled, results count announced' },
      ActionButton:     { type: 'action', props: ['label','onClick','variant','size','loading','disabled','icon'], states: ['default','hover','active','focus','loading','disabled'], children: [], a11y: 'button role, loading announced' },
      HeroSection:      { type: 'layout', props: ['headline','subheadline','cta','image','variant'], states: ['default','loading'], children: ['Heading','Paragraph','CTABlock'], a11y: 'headings in logical order, images have alt' },
      FeatureCard:      { type: 'data-display', props: ['icon','title','description','link','variant'], states: ['default','hover','focus'], children: ['Icon','Heading','Paragraph'], a11y: 'icon decorative unless functional' },
      TestimonialSlider:{ type: 'interactive', props: ['testimonials','autoplay','interval','navigation'], states: ['default','transitioning','paused'], children: ['TestimonialCard','SliderNav'], a11y: 'role="region" with aria-label, slide count announced' },
      CTABlock:         { type: 'action', props: ['headline','description','primaryAction','secondaryAction','variant'], states: ['default','loading'], children: ['ActionButton'], a11y: 'actions have descriptive labels' },
      NavBar:           { type: 'navigation', props: ['links','logo','actions','sticky','mobileMenu'], states: ['default','scrolled','mobile-open','mobile-closed'], children: ['NavLink','MobileMenu'], a11y: 'nav landmark, mobile menu button labeled' },
      SettingsGroup:    { type: 'form', props: ['title','description','fields','collapsible'], states: ['default','expanded','collapsed','saving'], children: ['FormGroup','ToggleSwitch','InputField'], a11y: 'group labeled with fieldset/legend' },
      ToggleSwitch:     { type: 'input', props: ['checked','onChange','label','disabled','size'], states: ['on','off','disabled','focus'], children: [], a11y: 'role="switch", checked state announced' },
      InputField:       { type: 'input', props: ['type','label','placeholder','value','error','helper','required'], states: ['default','focus','filled','error','disabled','readonly'], children: [], a11y: 'label always visible, error via aria-describedby' },
      SaveBar:          { type: 'action', props: ['hasChanges','saving','saved','onSave','onDiscard'], states: ['idle','dirty','saving','saved','error'], children: ['ActionButton'], a11y: 'status changes via aria-live' },
      ProfileAvatar:    { type: 'data-display', props: ['src','name','size','status','editable'], states: ['loading','loaded','error','editing'], children: [], a11y: 'alt text from name' },
      TableHeader:      { type: 'data-display', props: ['columns','sortable','onSort'], states: ['default','sorted-asc','sorted-desc'], children: ['ColumnMenu'], a11y: 'sort state announced' },
      TableRow:         { type: 'data-display', props: ['data','selectable','onClick','variant'], states: ['default','hover','selected','clickable'], children: [], a11y: 'row selected state announced' },
      Pagination:       { type: 'navigation', props: ['current','total','onChange','showFirstLast'], states: ['default','loading'], children: [], a11y: 'current page announced, total pages conveyed' },
      ColumnMenu:       { type: 'action', props: ['column','onToggle','onResize'], states: ['open','closed'], children: [], a11y: 'menu role="menu", keyboard navigable' },
      BulkActionBar:    { type: 'action', props: ['selectedCount','actions','onClear'], states: ['hidden','visible'], children: ['ActionButton'], a11y: 'selection count announced' },
      FormGroup:        { type: 'form', props: ['title','description','children'], states: ['default'], children: [], a11y: 'fieldset/legend structure' },
      TextInput:        { type: 'input', props: ['type','value','onChange','placeholder','error'], states: ['default','focus','filled','error','disabled'], children: [], a11y: 'label associated' },
      SelectDropdown:   { type: 'input', props: ['options','value','onChange','searchable','multi'], states: ['default','open','searching','error','disabled'], children: [], a11y: 'listbox role, options announced' },
      CheckboxGroup:    { type: 'input', props: ['options','value','onChange','inline'], states: ['default','error','disabled'], children: [], a11y: 'group with fieldset' },
      SubmitButton:     { type: 'action', props: ['label','variant','loading','disabled','onClick'], states: ['default','loading','success','error','disabled'], children: [], a11y: 'loading state announced' },
      Card:             { type: 'container', props: ['title','children','padding','bordered','shadow'], states: ['default','hover','focus','selected'], children: [], a11y: 'focus indicated' },
      Button:           { type: 'action', props: ['label','variant','size','loading','disabled','icon'], states: ['default','hover','active','focus','loading','disabled'], children: [], a11y: 'button role, loading announced' },
      Heading:          { type: 'text', props: ['level','children','align','color'], states: ['default'], children: [], a11y: 'heading hierarchy enforced' },
      Divider:          { type: 'decorative', props: ['orientation','variant','label'], states: ['default'], children: [], a11y: 'role="separator" with label' },
    };

    const components = {};
    for (const name of componentNames) {
      components[name] = defs[name] || { type: 'unknown', props: ['className','style','children'], states: ['default'], children: [], a11y: 'provide labels and roles' };
    }
    return components;
  }

  // ── Motion ────────────────────────────────────────────────────────────────

  _generateMotion(parsed, template) {
    const durations = { instant: '50ms', fast: '100ms', normal: '250ms', slow: '400ms', verySlow: '600ms' };
    return {
      duration:   durations,
      easing:     { default: 'ease-in-out', in: 'ease-in', out: 'ease-out', inOut: 'ease-in-out', spring: 'cubic-bezier(0.34,1.56,0.64,1)', bounce: 'cubic-bezier(0.68,-0.55,0.265,1.55)' },
      entrance:   [
        { name: 'fadeIn',    keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: '250ms' },
        { name: 'slideInUp', keyframes: [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], duration: '300ms' },
        { name: 'scaleIn',   keyframes: [{ transform: 'scale(0.95)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], duration: '200ms' },
      ],
      exit:       [
        { name: 'fadeOut',     keyframes: [{ opacity: 1 }, { opacity: 0 }], duration: '150ms' },
        { name: 'slideOutDown', keyframes: [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(16px)', opacity: 0 }], duration: '200ms' },
      ],
      interaction: [
        { name: 'hoverScale', keyframes: [{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }], duration: '150ms' },
        { name: 'pressScale', keyframes: [{ transform: 'scale(1)' }, { transform: 'scale(0.97)' }], duration: '100ms' },
        { name: 'focusGlow', keyframes: [{ boxShadow: 'none' }, { boxShadow: '0 0 0 3px var(--color-primary-alpha)' }], duration: '150ms' },
      ],
      dataLoading: [
        { name: 'skeletonShimmer', keyframes: [{ backgroundPosition: '-200% 0' }, { backgroundPosition: '200% 0' }], duration: '1.5s', infinite: true },
        { name: 'pulse',          keyframes: [{ opacity: 1 }, { opacity: 0.5 }, { opacity: 1 }], duration: '1s', infinite: true },
        { name: 'spin',           keyframes: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], duration: '700ms', infinite: true },
      ],
      layout:     [
        { name: 'heightExpand', property: 'height', duration: '300ms', easing: 'ease-in-out' },
        { name: 'collapse',     property: 'height', to: '0', duration: '200ms' },
      ],
      page:       [
        { name: 'pageEnter', keyframes: [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], duration: '300ms' },
        { name: 'pageExit',  keyframes: [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-8px)' }], duration: '200ms' },
      ],
      preferReducedMotion: true,
    };
  }

  // ── Interaction ───────────────────────────────────────────────────────────

  _generateInteraction(parsed, template) {
    return {
      mouse: {
        hover:  { scale: { enabled: true, value: 1.02, duration: '150ms' }, shadow: { enabled: true, elevation: 'md', duration: '150ms' }, cursor: { pointer: true } },
        click:  { scale: { enabled: true, value: 0.97, duration: '100ms' }, ripple: { enabled: true, color: 'currentColor', duration: '400ms' } },
        drag:   { enabled: true, threshold: 5, handle: 'grab', feedback: 'elevated-shadow' },
      },
      keyboard: {
        focus:  { outline: '2px solid var(--color-primary)', outlineOffset: '2px', ring: { enabled: true, size: 3, color: 'var(--color-primary-alpha)' } },
        shortcuts: {
          enabled: true,
          list: [
            { key: 'Escape',      action: 'close modal/dropdown', target: 'modal, dropdown, popover' },
            { key: 'Tab',         action: 'navigate focusable elements' },
            { key: 'Enter',       action: 'activate button/link', target: 'button, link' },
            { key: 'Space',       action: 'toggle checkbox/button', target: 'checkbox, toggle' },
            { key: 'ArrowDown/Up', action: 'navigate options', target: 'select, menu, combobox' },
          ],
        },
        skipLink:      { enabled: true, target: 'main-content' },
        rovingTabindex: { enabled: true, containers: ['menu', 'tablist', 'toolbar'] },
      },
      touch: {
        tap:       { highlight: { enabled: true, color: 'var(--color-primary-alpha)', duration: '200ms' } },
        longPress: { enabled: true, delay: '500ms', feedback: 'scale-down' },
        swipe:     { enabled: false, threshold: 30 },
        pinch:     { enabled: false },
      },
      form: {
        validation: { timing: 'onBlur', revalidate: 'onChange', debounceMs: 300 },
        autofill:   { enabled: true, respectAutocomplete: true },
        autoSave:   { enabled: false, debounceMs: 2000 },
        submit:     { loadingState: true, optimisticUpdate: false, errorRecovery: true },
      },
      feedback: {
        loading: { skeleton: true, spinner: false, pulse: false, overlay: false },
        success: { toast: true, animation: 'check', duration: '3000ms' },
        error:   { toast: true, animation: 'shake', duration: '5000ms' },
        info:    { toast: false, inline: true },
      },
      scroll: {
        behavior:      'smooth',
        lockOnModal:   true,
        toTop:         { enabled: true, threshold: 300, speed: 'fast' },
        parallax:      parsed.styles.includes('modern') ? { enabled: true, factor: 0.3 } : { enabled: false },
      },
    };
  }

  // ── Glows ───────────────────────────────────────────────────────────────

  _generateGlows(parsed) {
    if (parsed.styles.includes('neon')) {
      return {
        primary:   { boxShadow: '0 0 20px var(--color-primary), 0 0 40px var(--color-primary)', intensity: 'high' },
        secondary: { boxShadow: '0 0 20px var(--color-secondary), 0 0 40px var(--color-secondary)', intensity: 'high' },
        accent:    { boxShadow: '0 0 20px var(--color-accent), 0 0 40px var(--color-accent)', intensity: 'high' },
        subtle:    { boxShadow: '0 0 10px var(--color-primary-alpha)', intensity: 'low' },
        ambient:   { boxShadow: '0 0 30px var(--color-primary-alpha)', intensity: 'medium' },
        text:      { textShadow: '0 0 10px currentColor, 0 0 20px currentColor', intensity: 'high' },
        animated:  [
          { name: 'pulsingGlow', boxShadow: '0 0 20px var(--color-primary)', duration: '2s', keyframes: [{ boxShadow: '0 0 20px var(--color-primary)' }, { boxShadow: '0 0 40px var(--color-primary), 0 0 60px var(--color-primary)' }, { boxShadow: '0 0 20px var(--color-primary)' }] },
        ],
      };
    }
    return {
      primary:   { boxShadow: '0 0 16px var(--color-primary-alpha)', intensity: 'medium' },
      secondary: { boxShadow: '0 0 16px var(--color-secondary-alpha)', intensity: 'medium' },
      accent:    { boxShadow: '0 0 16px var(--color-accent-alpha)', intensity: 'medium' },
      subtle:    { boxShadow: '0 0 6px var(--color-primary-alpha)', intensity: 'low' },
      ambient:   { boxShadow: '0 0 24px var(--color-surface-alpha)', intensity: 'medium' },
      text:      { textShadow: '0 0 8px var(--color-primary-alpha)', intensity: 'low' },
      animated:  [
        { name: 'hoverGlow', boxShadow: '0 0 16px var(--color-primary-alpha)', duration: '200ms', trigger: 'hover' },
        { name: 'focusGlow', boxShadow: '0 0 0 3px var(--color-primary-alpha)', duration: '150ms', trigger: 'focus' },
      ],
    };
  }

  // ── Shadows ──────────────────────────────────────────────────────────────

  _generateShadows(parsed) {
    return {
      none:     'none',
      xs:       '0 1px 2px rgba(0,0,0,0.05)',
      sm:       '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
      md:       '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
      lg:       '0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
      xl:       '0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04)',
      '2xl':    '0 25px 50px rgba(0,0,0,0.15)',
      inner:    'inset 0 2px 4px rgba(0,0,0,0.06)',
      colored:  '0 4px 14px var(--color-primary-alpha)',
      floating: '0 8px 30px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.08)',
    };
  }

  // ── Animation Tokens ────────────────────────────────────────────────────

  _generateAnimationTokens(parsed) {
    return {
      durations: { '0': '0ms', '50': '50ms', '100': '100ms', '150': '150ms', '200': '200ms', '250': '250ms', '300': '300ms', '400': '400ms', '500': '500ms', '600': '600ms', '800': '800ms', '1000': '1000ms' },
      easings:   { 'linear': 'linear', 'ease': 'ease', 'ease-in': 'ease-in', 'ease-out': 'ease-out', 'ease-in-out': 'ease-in-out', 'spring': 'cubic-bezier(0.34,1.56,0.64,1)', 'bounce': 'cubic-bezier(0.68,-0.55,0.265,1.55)' },
      keyframes: { 'fade-in': 'fadeIn var(--duration-normal) var(--easing-out)', 'slide-up': 'slideUp var(--duration-slow) var(--easing-out)', 'scale-in': 'scaleIn var(--duration-fast) var(--easing-spring)', 'shake': 'shake 0.4s var(--easing-in-out)', 'pulse': 'pulse 2s var(--easing-in-out) infinite', 'spin': 'spin 1s linear infinite' },
      prefersReducedMotion: true,
    };
  }

  // ── CSS Variables ───────────────────────────────────────────────────────

  _generateCSSVariables(spec) {
    return {
      scope:    ':root',
      darkScope: '[data-theme="dark"]',
      tokens: {
        '--color-primary':         spec.colors.primary,
        '--color-secondary':       spec.colors.secondary,
        '--color-accent':          spec.colors.accent,
        '--color-primary-alpha':   'color-mix(in srgb, var(--color-primary) 20%, transparent)',
        '--color-secondary-alpha': 'color-mix(in srgb, var(--color-secondary) 20%, transparent)',
        '--color-accent-alpha':    'color-mix(in srgb, var(--color-accent) 20%, transparent)',
        '--color-bg':              spec.colors.background?.light,
        '--color-surface':         spec.colors.surface?.light,
        '--color-text':            spec.colors.text?.primary?.light || spec.colors.text?.primary,
        '--color-text-secondary': spec.colors.text?.secondary?.light || spec.colors.text?.secondary,
        '--color-text-muted':      spec.colors.text?.muted?.light || spec.colors.text?.muted,
        '--color-border':          spec.colors.border?.light || spec.colors.border,
        '--color-success':         spec.colors.status?.success,
        '--color-warning':          spec.colors.status?.warning,
        '--color-error':            spec.colors.status?.error,
        '--color-info':             spec.colors.status?.info,
        '--font-sans':              spec.typography?.fontFamily?.primary,
        '--font-mono':              spec.typography?.fontFamily?.mono,
        '--font-size-xs':           spec.typography?.sizes?.xs,
        '--font-size-sm':           spec.typography?.sizes?.sm,
        '--font-size-base':         spec.typography?.sizes?.base,
        '--font-size-lg':           spec.typography?.sizes?.lg,
        '--font-size-xl':           spec.typography?.sizes?.xl,
        '--font-size-2xl':         spec.typography?.sizes?.['2xl'],
        '--font-size-3xl':         spec.typography?.sizes?.['3xl'],
        '--font-size-4xl':         spec.typography?.sizes?.['4xl'],
        '--font-weight-regular':   spec.typography?.fontWeight?.regular,
        '--font-weight-medium':     spec.typography?.fontWeight?.medium,
        '--font-weight-semibold':  spec.typography?.fontWeight?.semibold,
        '--font-weight-bold':       spec.typography?.fontWeight?.bold,
        '--leading-body':           spec.typography?.lineHeight?.body,
        '--leading-heading':       spec.typography?.lineHeight?.heading,
        '--tracking-tight':        spec.typography?.letterSpacing?.tight,
        '--tracking-normal':        spec.typography?.letterSpacing?.normal,
        '--tracking-wide':          spec.typography?.letterSpacing?.wide,
        '--space-xs':              spec.spacing?.names?.xs,
        '--space-sm':              spec.spacing?.names?.sm,
        '--space-md':              spec.spacing?.names?.md,
        '--space-lg':              spec.spacing?.names?.lg,
        '--space-xl':              spec.spacing?.names?.xl,
        '--space-2xl':             spec.spacing?.names?.['2xl'],
        '--space-3xl':             spec.spacing?.names?.['3xl'],
        '--radius-sm':             '4px',
        '--radius-md':             '8px',
        '--radius-lg':             '12px',
        '--radius-xl':             '16px',
        '--radius-full':           '9999px',
        '--shadow-sm':             spec.shadows?.sm,
        '--shadow-md':             spec.shadows?.md,
        '--shadow-lg':             spec.shadows?.lg,
        '--shadow-xl':             spec.shadows?.xl,
        '--shadow-colored':         spec.shadows?.colored,
        '--shadow-glow':           spec.glows?.primary?.boxShadow,
        '--duration-fast':         spec.motion?.duration?.fast,
        '--duration-normal':       spec.motion?.duration?.normal,
        '--duration-slow':         spec.motion?.duration?.slow,
        '--easing-spring':         spec.motion?.easing?.spring,
        '--easing-bounce':         spec.motion?.easing?.bounce,
      },
    };
  }

  // ── Tailwind Config ─────────────────────────────────────────────────────

  _generateTailwindConfig(spec) {
    return {
      theme: {
        extend: {
          colors: {
            primary:   spec.colors.primary,
            secondary: spec.colors.secondary,
            accent:    spec.colors.accent,
            success:   spec.colors.status.success,
            warning:   spec.colors.status.warning,
            error:     spec.colors.status.error,
            info:      spec.colors.status.info,
          },
          fontFamily:  { sans: spec.typography.fontFamily.primary, mono: spec.typography.fontFamily.mono },
          fontSize:    spec.typography.sizes,
          fontWeight:  spec.typography.fontWeight,
          lineHeight:  spec.typography.lineHeight,
          letterSpacing: spec.typography.letterSpacing,
          spacing:     spec.spacing.scale,
          borderRadius: { sm: '4px', DEFAULT: '8px', md: '8px', lg: '12px', xl: '16px', full: '9999px' },
          boxShadow:   spec.shadows,
          transitionDuration: { fast: '100ms', normal: '250ms', slow: '400ms' },
          transitionTimingFunction: { spring: 'cubic-bezier(0.34,1.56,0.64,1)', bounce: 'cubic-bezier(0.68,-0.55,0.265,1.55)' },
          keyframes: {
            fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
            slideUp: { from: { transform: 'translateY(16px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
            scaleIn: { from: { transform: 'scale(0.95)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
            shake:   { '0%, 100%': { transform: 'translateX(0)' }, '10%, 50%, 90%': { transform: 'translateX(-4px)' }, '30%, 70%': { transform: 'translateX(4px)' } },
            pulse:   { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
            shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
          },
          animation: {
            'fade-in':  'fadeIn 250ms ease-out',
            'slide-up': 'slideUp 300ms ease-out',
            'scale-in': 'scaleIn 200ms var(--easing-spring)',
            'shake':    'shake 400ms ease-in-out',
            'pulse':    'pulse 2s ease-in-out infinite',
            'shimmer':  'shimmer 1.5s linear infinite',
          },
        },
      },
    };
  }

  // ── Component Templates ─────────────────────────────────────────────────

  _generateComponentTemplates(componentNames) {
    const templates = {};
    for (const name of componentNames) {
      templates[name] = {
        file:      `${name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}.tsx`,
        component: name,
        props:     this._defaultProps[name] || {},
        template:  this._componentTemplate(name),
      };
    }
    return templates;
  }

  _defaultProps = {
    Button:      { variant: 'primary', size: 'md', loading: false, disabled: false },
    Card:        { padding: 'md', borderRadius: 'md', shadow: 'sm' },
    InputField:  { type: 'text', placeholder: '', error: '', helper: '' },
    Heading:     { level: 2, align: 'left' },
    MetricCard:  { trend: null, color: 'primary' },
    NavBar:      { sticky: true, mobileMenu: false },
    ToggleSwitch:{ checked: false, disabled: false, size: 'md' },
    Pagination:  { current: 1, total: 1, showFirstLast: true },
  };

  _componentTemplate(name) {
    const map = {
      Button: `import React from 'react';
import './Button.css';

export function Button({ children, variant = 'primary', size = 'md', loading = false, disabled = false, onClick, icon, ...props }) {
  return (
    <button
      className={\`btn btn-\${variant} btn-\${size} \${loading ? 'btn--loading' : ''}\`}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading}
      {...props}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
}`,
      Card: `import React from 'react';
import './Card.css';

export function Card({ children, title, padding = 'md', borderRadius = 'lg', shadow = 'md', className = '', ...props }) {
  return (
    <div
      className={\`card card-\${shadow} \${className}\`}
      style={{ padding }}
      {...props}
    >
      {title && <div className="card-header"><h3>{title}</h3></div>}
      <div className="card-body">{children}</div>
    </div>
  );
}`,
      MetricCard: `import React from 'react';
import './MetricCard.css';

export function MetricCard({ label, value, trend, icon, color = 'primary' }) {
  const dir = trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral';
  return (
    <div className={\`metric-card metric-card--\${color}\`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {trend !== undefined && (
        <div className={\`metric-trend metric-trend--\${dir}\`}>
          {dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}`,
      ToggleSwitch: `import React from 'react';
import './ToggleSwitch.css';

export function ToggleSwitch({ checked = false, onChange, label, disabled = false, size = 'md', id }) {
  return (
    <label className={\`toggle toggle--\${size} \${disabled ? 'toggle--disabled' : ''}\`} htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        className="toggle-input"
      />
      <span className="toggle-track"><span className="toggle-thumb" /></span>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  );
}`,
    };
    return map[name] || `// Component: ${name}\\n// Add your implementation here.`;
  }

  // ── Accessibility ───────────────────────────────────────────────────────

  _generateAccessibility(parsed) {
    return {
      colorContrast:   { level: 'AA', minimum: { text: 4.5, largeText: 3.0, ui: 3.0 }, focusIndicators: { ratio: 3.0, minThickness: '2px' } },
      focusManagement: { trapInModals: true, restoreOnClose: true, skipLinks: true, focusVisible: true },
      ariaRoles:      { landmarkRegions: ['banner','navigation','main','complementary','contentinfo'], liveRegions: ['status','alert','log'] },
      keyboardNav:    { tabIndex: 'managed', arrowNav: ['menu','tablist','listbox','tree'], escapeCloses: ['modal','dropdown','popover','tooltip'] },
      motion:         { respectPrefersReducedMotion: true, pauseOnHidden: true },
      screenReader:   { srOnlyClass: true, ariaDescribedBy: true, ariaLabelledBy: true, ariaLive: 'polite' },
    };
  }

  // ── Breakpoints ─────────────────────────────────────────────────────────

  _generateBreakpoints() {
    return {
      mobile:  { min: '0px',    max: '639px',  name: 'mobile' },
      tablet:  { min: '640px',  max: '1023px', name: 'tablet' },
      desktop: { min: '1024px', max: '1279px', name: 'desktop' },
      wide:    { min: '1280px', max: '1535px', name: 'wide' },
      ultra:   { min: '1536px', name: 'ultra' },
    };
  }

  // ── Themes ─────────────────────────────────────────────────────────────

  _generateThemes(parsed) {
    const themes = {
      light: {
        name: 'Light',
        colors: { background: '#f8fafc', surface: '#ffffff', text: '#0f172a', 'text-secondary': '#64748b', border: '#e2e8f0' },
      },
    };
    if (parsed.intents.includes('dark-mode')) {
      themes.dark = {
        name: 'Dark',
        colors: { background: '#0f172a', surface: '#1e293b', text: '#f1f5f9', 'text-secondary': '#94a3b8', border: '#334155' },
      };
    }
    return themes;
  }

  // ── Existing UI Analysis ────────────────────────────────────────────────

  async analyzeExisting(code) {
    return this.healthAnalyzer.analyze(code);
  }

  generateImprovements(healthReport) {
    return {
      accessibility: healthReport.issues.accessibility.length  ? ['Add proper ARIA labels', 'Ensure WCAG AA contrast', 'Implement keyboard navigation', 'Add focus indicators', 'Use semantic HTML'] : [],
      performance:   healthReport.issues.performance.length    ? ['Implement code splitting', 'Lazy load below-fold content', 'Optimize images', 'Remove unused CSS/JS', 'Use virtual scrolling for large lists'] : [],
      consistency:   healthReport.issues.consistency.length      ? ['Centralize design tokens', 'Create a shared component library', 'Standardize border-radius', 'Enforce font scale', 'Use CSS custom properties'] : [],
      interaction:   healthReport.issues.interaction.length    ? ['Add loading states', 'Implement form validation feedback', 'Add transition animations', 'Add error boundaries', 'Add skeleton loading'] : [],
      code:          healthReport.issues.code.length            ? ['Refactor large components', 'Extract reusable hooks', 'Add prop-type validation', 'Improve component naming', 'Add JSDoc comments'] : [],
    };
  }

  getHistory()   { return [...this.history]; }
  clearHistory() { this.history = []; }
}

export default UIGenerator;
