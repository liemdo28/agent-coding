// design-system/ui-health-analyzer.js - AI-powered UI health and quality analysis
import { EventEmitter } from 'events';

/**
 * UIHealthAnalyzer - Detects and diagnoses UI issues
 * Analyzes code for: poor UX, dead UI, slow interactions, inconsistent components
 */
export class UIHealthAnalyzer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      accessibilityThreshold: 4.5,    // WCAG AA contrast ratio
      largeTouchTarget: 44,           // pixels, WCAG recommendation
      maxBundleSize: 500 * 1024,     // 500KB warning threshold
      maxRenderTime: 100,            // ms for component render
      ...options,
    };
    this.history = [];
  }

  // ── Main Analysis Entry ──────────────────────────────────────────────────────

  /**
   * Analyze UI code for health issues
   * @param {string} code - source code or AST
   * @param {object} context - { framework, fileType, dependencies }
   * @returns {HealthReport}
   */
  analyze(code, context = {}) {
    const report = {
      timestamp: new Date().toISOString(),
      score: 100,
      issues: {
        accessibility: [],
        performance: [],
        consistency: [],
        interaction: [],
        deadUI: [],
      },
      metrics: {},
      recommendations: [],
      components: { total: 0, analyzed: 0, issues: [] },
    };

    // Parse code structure
    const structure = this._parseStructure(code, context);
    report.components.total = structure.componentCount;
    report.components.analyzed = structure.componentCount;

    // Run all check categories
    this._checkAccessibility(code, structure, report);
    this._checkPerformance(code, structure, report);
    this._checkConsistency(code, structure, report);
    this._checkInteraction(code, structure, report);
    this._checkDeadUI(code, structure, report);

    // Calculate overall score
    report.score = this._calculateScore(report.issues);

    // Generate recommendations
    report.recommendations = this._generateRecommendations(report);

    this.history.push(report);
    return report;
  }

  // ── Parse Code Structure ────────────────────────────────────────────────────

  _parseStructure(code, context) {
    const result = {
      componentCount: 0,
      hooks: [],
      imports: [],
      exports: [],
      jsxElements: [],
      styles: [],
      dependencies: [],
      eventHandlers: [],
      asyncOperations: [],
      stateVariables: [],
      propTypes: [],
    };

    // Extract imports
    const importMatches = code.matchAll(/import\s+.*?from\s+['"](.+?)['"]/g);
    for (const match of importMatches) {
      result.imports.push(match[1]);
    }

    // Extract React hooks usage
    const hookMatches = code.matchAll(/use[A-Z][a-zA-Z]+/g);
    for (const match of hookMatches) {
      result.hooks.push(match[0]);
    }

    // Extract JSX components (PascalCase)
    const componentMatches = code.matchAll(/<([A-Z][a-zA-Z]+)/g);
    for (const match of componentMatches) {
      result.jsxElements.push(match[1]);
      result.componentCount++;
    }

    // Extract export names
    const exportMatches = code.matchAll(/export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/g);
    for (const match of exportMatches) {
      result.exports.push(match[1]);
    }

    // Extract event handlers
    const handlerPattern = /(?:onClick|onChange|onSubmit|onKeyDown|onFocus|onBlur|onMouseEnter|onMouseLeave)\s*=/g;
    let handlerMatch;
    while ((handlerMatch = handlerPattern.exec(code)) !== null) {
      result.eventHandlers.push(handlerMatch[0]);
    }

    // Extract async operations
    const asyncPattern = /(?:await\s+|\.then\(|\.catch\(|useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*(?:fetch|axios|XMLHttp|api))/g;
    let asyncMatch;
    while ((asyncMatch = asyncPattern.exec(code)) !== null) {
      result.asyncOperations.push('async');
    }

    // Extract state variables
    const stateMatches = code.matchAll(/(?:useState|useReducer|useRef)\s*<[^>]+>\s*\(\s*(\w+)/g);
    for (const match of stateMatches) {
      result.stateVariables.push(match[1]);
    }

    // Extract inline styles
    const styleMatches = code.matchAll(/style\s*=\s*\{([^}]+)\}/g);
    for (const match of styleMatches) {
      result.styles.push(match[1]);
    }

    return result;
  }

  // ── Accessibility Checks ─────────────────────────────────────────────────────

  _checkAccessibility(code, structure, report) {
    const issues = report.issues.accessibility;

    // Check for missing alt on images
    const imgWithoutAlt = code.match(/<img(?![^>]*\balt=)[^>]*>/gi);
    if (imgWithoutAlt) {
      issues.push({
        type: 'missing-alt',
        severity: 'error',
        message: `${imgWithoutAlt.length} <img> element(s) missing alt attribute`,
        elements: imgWithoutAlt.length,
        fix: 'Add alt="" for decorative images or alt="description" for informative images',
      });
    }

    // Check for button without accessible name
    const buttonsWithoutText = code.match(/<button(?![^>]*>(?:\w|\s)+<\/button>)[^>]*>(?:\s*<[^>]+>\s*)*<\/button>/gi);
    if (buttonsWithoutText && !code.includes('aria-label') && !code.includes('aria-labelledby')) {
      issues.push({
        type: 'button-no-label',
        severity: 'warning',
        message: 'Button elements may lack accessible text',
        fix: 'Add aria-label, aria-labelledby, or visible text content',
      });
    }

    // Check for missing ARIA roles on complex widgets
    const interactiveWidgets = code.match(/<div(?![^>]*\brole=)[^>]*(?:onClick|onKeyDown|onMouseDown)[^>]*>/gi);
    if (interactiveWidgets) {
      issues.push({
        type: 'interactive-div-no-role',
        severity: 'error',
        message: `${interactiveWidgets.length} interactive <div> element(s) missing ARIA role`,
        fix: 'Add appropriate role="button", role="checkbox", or use semantic <button>',
      });
    }

    // Check color contrast (basic heuristic)
    const lowContrastPatterns = [
      /background:\s*(?:#fff|#ffffff|#fafafa|#f5f5f5)/gi,
      /color:\s*(?:#999|#999999|#ccc|#cccccc|#aaa)/gi,
    ];

    // Check for missing skip links
    if (!code.includes('skip-link') && !code.includes('skipLink')) {
      issues.push({
        type: 'missing-skip-link',
        severity: 'warning',
        message: 'No skip navigation link detected',
        fix: 'Add a skip link for keyboard users to bypass navigation',
      });
    }

    // Check for form labels
    const inputsWithoutLabels = this._findInputsWithoutLabels(code);
    if (inputsWithoutLabels > 0) {
      issues.push({
        type: 'form-field-no-label',
        severity: 'error',
        message: `${inputsWithoutLabels} form input(s) missing associated <label>`,
        fix: 'Associate labels using htmlFor/id or aria-labelledby',
      });
    }

    // Check for focus indicators
    if (!code.includes(':focus') && !code.includes(':focus-visible') && !code.includes('outline')) {
      issues.push({
        type: 'no-focus-indicator',
        severity: 'warning',
        message: 'No visible focus indicators found',
        fix: 'Add CSS :focus or :focus-visible styles with visible outline',
      });
    }

    // Check for missing lang attribute
    if (!code.includes('lang=')) {
      issues.push({
        type: 'missing-lang-attribute',
        severity: 'warning',
        message: 'HTML document missing lang attribute',
        fix: 'Add lang="en" or appropriate language code to <html> element',
      });
    }
  }

  _findInputsWithoutLabels(code) {
    const inputs = code.match(/<input[^>]*>/gi) || [];
    const labels = code.match(/<label[^>]*>/gi) || [];
    const labeledInputs = code.match(/aria-labelledby=|aria-label=/gi) || [];
    // Heuristic: if inputs outnumber labels + aria-labeled inputs, some are unlabeled
    return Math.max(0, inputs.length - labels.length - labeledInputs.length);
  }

  // ── Performance Checks ──────────────────────────────────────────────────────

  _checkPerformance(code, structure, report) {
    const issues = report.issues.performance;
    const metrics = report.metrics;

    // Count useEffect hooks (potential re-render issues)
    const useEffectCount = (code.match(/useEffect\s*\(/g) || []).length;
    metrics.useEffectCount = useEffectCount;

    if (useEffectCount > 10) {
      issues.push({
        type: 'excessive-effects',
        severity: 'warning',
        message: `${useEffectCount} useEffect hooks detected (may cause excessive re-renders)`,
        fix: 'Consolidate related effects, ensure proper dependency arrays',
      });
    }

    // Check for missing useMemo/useCallback
    const hasExpensiveComputation = code.includes('Array.from') || code.includes('.map(') || code.includes('.filter(');
    if (hasExpensiveComputation && !code.includes('useMemo') && !code.includes('useCallback')) {
      issues.push({
        type: 'no-memoization',
        severity: 'info',
        message: 'Expensive computations detected without memoization',
        fix: 'Wrap expensive computations in useMemo, callback functions in useCallback',
      });
    }

    // Check for inline styles (can't be extracted/purged)
    const inlineStyleCount = (code.match(/style\s*=\s*\{/g) || []).length;
    metrics.inlineStyleCount = inlineStyleCount;
    if (inlineStyleCount > 5) {
      issues.push({
        type: 'excessive-inline-styles',
        severity: 'info',
        message: `${inlineStyleCount} inline styles detected`,
        fix: 'Move styles to CSS classes or styled-components for better maintainability',
      });
    }

    // Check for large data in state (potential memory issue)
    const stateMatches = code.match(/useState\s*\(\s*(\[|\{)/g);
    if (stateMatches && stateMatches.length > 8) {
      issues.push({
        type: 'excessive-state',
        severity: 'warning',
        message: `${stateMatches.length} useState hooks - consider consolidating with useReducer`,
        fix: 'Use useReducer or context for related state to reduce re-render chains',
      });
    }

    // Check for missing React.memo on frequently re-rendered components
    const componentExports = structure.exports.filter(e => e !== 'default');
    if (componentExports.length > 3 && !code.includes('React.memo') && !code.includes('memo(')) {
      issues.push({
        type: 'no-component-memoization',
        severity: 'info',
        message: 'Multiple components without memoization',
        fix: 'Wrap pure/display components in React.memo to prevent unnecessary re-renders',
      });
    }

    // Check for synchronous heavy operations
    if (/for\s*\([^)]*\)\s*\{[\s\S]{500,}\}/.test(code)) {
      issues.push({
        type: 'heavy-loop',
        severity: 'warning',
        message: 'Potential long-running synchronous loop detected',
        fix: 'Break up long loops with setTimeout/requestIdleCallback or use Web Workers',
      });
    }

    // Check for missing lazy loading
    if (code.includes('import(') === false && code.includes('React.lazy') === false) {
      const componentCount = structure.componentCount;
      if (componentCount > 15) {
        issues.push({
          type: 'no-code-splitting',
          severity: 'info',
          message: `${componentCount} components - consider code splitting with React.lazy`,
          fix: 'Use React.lazy() and Suspense for route-based or large component code splitting',
        });
      }
    }

    // Estimate bundle size from imports
    metrics.importCount = structure.imports.length;
    if (structure.imports.length > 20) {
      issues.push({
        type: 'excessive-imports',
        severity: 'warning',
        message: `${structure.imports.length} import statements - potential large bundle`,
        fix: 'Audit dependencies, use tree-shaking, consider dynamic imports',
      });
    }
  }

  // ── Consistency Checks ──────────────────────────────────────────────────────

  _checkConsistency(code, structure, report) {
    const issues = report.issues.consistency;

    // Extract and analyze inline styles for consistency
    const colorValues = this._extractColorValues(code);
    const spacingValues = this._extractSpacingValues(code);
    const borderRadiusValues = this._extractBorderRadius(code);

    // Check for inconsistent color values
    if (colorValues.unique.length > 8) {
      issues.push({
        type: 'color-inconsistency',
        severity: 'warning',
        message: `${colorValues.unique.length} different color values found - consider design tokens`,
        values: colorValues.unique.slice(0, 10),
        fix: 'Centralize colors using design tokens or CSS custom properties',
      });
    }

    // Check for inconsistent spacing
    if (spacingValues.unique.length > 6) {
      issues.push({
        type: 'spacing-inconsistency',
        severity: 'info',
        message: `${spacingValues.unique.length} different spacing values - standardize with scale`,
        values: spacingValues.unique.slice(0, 10),
        fix: 'Use consistent spacing scale (e.g., 4px base: 4, 8, 12, 16, 24, 32)',
      });
    }

    // Check for inconsistent border radius
    if (borderRadiusValues.unique.length > 4) {
      issues.push({
        type: 'border-radius-inconsistency',
        severity: 'info',
        message: `${borderRadiusValues.unique.length} different border-radius values`,
        values: borderRadiusValues.unique.slice(0, 8),
        fix: 'Standardize to 3-4 radius values: sm, md, lg, full',
      });
    }

    // Check for mixed naming conventions
    const camelCaseComponents = (code.match(/<[a-z][a-zA-Z]+/g) || []).length;
    const pascalCaseComponents = (code.match(/<[A-Z][a-zA-Z]+/g) || []).length;
    if (camelCaseComponents > 0 && pascalCaseComponents > 0) {
      issues.push({
        type: 'naming-inconsistency',
        severity: 'warning',
        message: 'Mixed component naming conventions (camelCase and PascalCase)',
        fix: 'Use PascalCase for React components, camelCase for native HTML elements',
      });
    }

    // Check for inconsistent prop naming
    const onClickCount = (code.match(/\bonClick\b/g) || []).length;
    const handleClickCount = (code.match(/\bhandleClick\b/g) || []).length;
    if (onClickCount > 0 && handleClickCount > 0) {
      issues.push({
        type: 'event-handler-naming',
        severity: 'info',
        message: 'Mixed event handler naming (onClick vs handleClick)',
        fix: 'Standardize: use onEventName for props, handleEventName for handlers',
      });
    }

    // Check for inconsistent className usage vs inline styles
    const hasInlineStyles = (code.match(/style\s*=\s*\{/g) || []).length;
    const hasClassNames = (code.match(/className\s*=/g) || []).length;
    if (hasInlineStyles > 0 && hasClassNames > 5) {
      issues.push({
        type: 'style-approach-inconsistency',
        severity: 'info',
        message: 'Mixed inline styles and className usage',
        fix: 'Pick one approach - prefer className with CSS modules or Tailwind',
      });
    }
  }

  _extractColorValues(code) {
    const hexPattern = /#[0-9a-fA-F]{3,8}/g;
    const rgbPattern = /rgb[a]?\s*\([^)]+\)/g;
    const allMatches = [...(code.match(hexPattern) || []), ...(code.match(rgbPattern) || [])];
    const unique = [...new Set(allMatches)];
    return { total: allMatches.length, unique };
  }

  _extractSpacingValues(code) {
    const pxPattern = /\b(\d+px)\b/g;
    const remPattern = /\b(\d+\.?\d*rem)\b/g;
    const allMatches = [...(code.match(pxPattern) || []), ...(code.match(remPattern) || [])];
    const unique = [...new Set(allMatches)];
    return { total: allMatches.length, unique };
  }

  _extractBorderRadius(code) {
    const radiusPattern = /borderRadius[:\s]*['"]?([^'";}\s]+)/gi;
    const matches = code.match(radiusPattern) || [];
    const unique = [...new Set(matches.map(m => m.replace(/borderRadius[:\s]*['"]?/i, '')))];
    return { total: matches.length, unique };
  }

  // ── Interaction Checks ─────────────────────────────────────────────────────

  _checkInteraction(code, structure, report) {
    const issues = report.issues.interaction;

    // Check for missing loading states on async components
    const asyncOps = structure.asyncOperations.length;
    const hasLoadingState = code.includes('isLoading') || code.includes('loading') || code.includes('Loading');
    if (asyncOps > 0 && !hasLoadingState) {
      issues.push({
        type: 'no-loading-state',
        severity: 'error',
        message: 'Async operations found without loading state indicator',
        fix: 'Add isLoading state with skeleton/spinner to indicate async work',
      });
    }

    // Check for missing error states
    const hasErrorHandling = code.includes('catch') || code.includes('error') || code.includes('Error');
    if (asyncOps > 0 && !hasErrorHandling) {
      issues.push({
        type: 'no-error-handling',
        severity: 'error',
        message: 'Async operations without error handling',
        fix: 'Add .catch() handlers or try/catch with error state UI',
      });
    }

    // Check for missing disabled states
    const disabledCount = (code.match(/disabled\s*=/g) || []).length;
    const buttonCount = (code.match(/<(?:button|Button)/g) || []).length;
    if (buttonCount > 0 && disabledCount === 0) {
      issues.push({
        type: 'no-disabled-state',
        severity: 'warning',
        message: 'Buttons found without disabled state handling',
        fix: 'Add disabled prop with appropriate visual feedback during loading/submission',
      });
    }

    // Check for missing form validation
    const hasInputs = (code.match(/<(?:input|Input|textarea|Textarea|select|Select)/g) || []).length;
    const hasValidation = code.includes('validate') || code.includes('required') || code.includes('pattern');
    if (hasInputs > 2 && !hasValidation) {
      issues.push({
        type: 'no-form-validation',
        severity: 'warning',
        message: 'Form inputs detected without validation',
        fix: 'Add HTML5 validation attributes or custom validation logic',
      });
    }

    // Check for missing keyboard navigation
    const hasOnKeyDown = (code.match(/onKeyDown|onKeyPress|onKeyUp/g) || []).length;
    const interactiveElements = (code.match(/<(?:button|a|input|select|textarea)/gi) || []).length;
    if (interactiveElements > 5 && hasOnKeyDown === 0) {
      issues.push({
        type: 'no-keyboard-navigation',
        severity: 'warning',
        message: 'Interactive elements without keyboard event handlers',
        fix: 'Add onKeyDown for Enter/Space activation, implement roving tabindex for menus',
      });
    }

    // Check for missing touch targets (mobile)
    const touchActionStyle = code.match(/touch-action:\s*[^;]+/gi);
    if (!touchActionStyle || touchActionStyle.length === 0) {
      issues.push({
        type: 'no-touch-optimization',
        severity: 'info',
        message: 'No touch-action CSS detected',
        fix: 'Add touch-action: manipulation for interactive elements',
      });
    }

    // Check for missing hover/focus states
    const hasHoverStyles = code.includes(':hover');
    const hasOnMouseEnter = (code.match(/onMouseEnter|onMouseOver/g) || []).length;
    if (hasOnMouseEnter > 0 && !hasHoverStyles) {
      issues.push({
        type: 'no-hover-feedback',
        severity: 'info',
        message: 'Mouse enter handlers without CSS hover styles',
        fix: 'Add CSS :hover styles for visual feedback',
      });
    }

    // Check for missing confirmation on destructive actions
    const destructivePatterns = ['delete', 'remove', 'destroy', 'confirm'];
    const hasDestructive = destructivePatterns.some(p => code.toLowerCase().includes(p));
    const hasConfirm = code.includes('confirm(') || code.includes('window.confirm');
    if (hasDestructive && !hasConfirm && !code.includes('onConfirm')) {
      issues.push({
        type: 'no-confirmation',
        severity: 'warning',
        message: 'Destructive action without confirmation dialog',
        fix: 'Add window.confirm() or custom confirmation modal before destructive actions',
      });
    }
  }

  // ── Dead UI Checks ──────────────────────────────────────────────────────────

  _checkDeadUI(code, structure, report) {
    const issues = report.issues.deadUI;

    // Check for commented-out code blocks
    const commentedBlocks = code.match(/\/\*[\s\S]*?\*\//g) || [];
    const commentedCode = commentedBlocks.filter(b =>
      b.includes('function') || b.includes('const ') || b.includes('return') || b.includes('class')
    );
    if (commentedCode.length > 0) {
      issues.push({
        type: 'commented-code',
        severity: 'info',
        message: `${commentedCode.length} commented-out code block(s) found`,
        fix: 'Remove commented code - use version control for history',
      });
    }

    // Check for unused exports (heuristic)
    const exports = structure.exports;
    const usedComponents = structure.jsxElements;
    const unusedExports = exports.filter(exp =>
      !usedComponents.includes(exp) && !code.includes(`<${exp}>`)
    );
    if (unusedExports.length > 0) {
      issues.push({
        type: 'unused-export',
        severity: 'info',
        message: `${unusedExports.length} exported component(s) may not be used`,
        items: unusedExports,
        fix: 'Remove unused exports or verify they are imported elsewhere',
      });
    }

    // Check for empty state handling
    const hasDataDisplay = code.includes('data') || code.includes('items') || code.includes('list');
    const hasEmptyState = code.includes('empty') || code.includes('Empty') || code.includes('No ');
    if (hasDataDisplay && !hasEmptyState && structure.componentCount > 2) {
      issues.push({
        type: 'no-empty-state',
        severity: 'warning',
        message: 'Data-display component without empty state handling',
        fix: 'Add empty state UI for when no data is available',
      });
    }

    // Check for console.log statements
    const consoleLogs = (code.match(/console\.(log|debug|info)\s*\(/g) || []).length;
    if (consoleLogs > 3) {
      issues.push({
        type: 'excessive-console',
        severity: 'info',
        message: `${consoleLogs} console.log/debug/info statement(s) in code`,
        fix: 'Remove console statements or replace with proper logging library',
      });
    }

    // Check for TODO/FIXME comments
    const todos = code.match(/\/\/\s*(TODO|FIXME|HACK|XXX|NOTE|BUG):/gi) || [];
    if (todos.length > 0) {
      issues.push({
        type: 'outstanding-todos',
        severity: 'info',
        message: `${todos.length} TODO/FIXME comment(s) found`,
        items: todos.slice(0, 5),
        fix: 'Address or track TODOs in project management tool',
      });
    }

    // Check for console.log in render
    const renderConsole = code.match(/return\s*\([^)]*console\./g);
    if (renderConsole) {
      issues.push({
        type: 'console-in-render',
        severity: 'error',
        message: 'console.log found in render/return - will fire on every render',
        fix: 'Move console statements outside render or use useEffect',
      });
    }

    // Check for missing cleanup in useEffect
    const useEffects = code.match(/useEffect\s*\([^,]+,\s*\[/g) || [];
    const hasReturnCleanup = code.includes('return () =>') || code.includes('return function');
    if (useEffects.length > 5 && !hasReturnCleanup) {
      issues.push({
        type: 'no-effect-cleanup',
        severity: 'warning',
        message: 'Multiple useEffect hooks without cleanup functions',
        fix: 'Add return () => {} cleanup for subscriptions, timers, and event listeners',
      });
    }

    // Check for hardcoded URLs that could be environment-based
    const hardcodedUrls = code.match(/['"]https?:\/\/[^'"]+['"]/g) || [];
    const hasEnvConfig = code.includes('process.env') || code.includes('import.meta.env');
    if (hardcodedUrls.length > 2 && !hasEnvConfig) {
      issues.push({
        type: 'hardcoded-urls',
        severity: 'info',
        message: `${hardcodedUrls.length} hardcoded URL(s) detected`,
        fix: 'Move URLs to environment variables for different environments',
      });
    }
  }

  // ── Scoring ─────────────────────────────────────────────────────────────────

  _calculateScore(issues) {
    let score = 100;
    const weights = {
      error: 10,
      warning: 5,
      info: 1,
    };

    for (const category of Object.values(issues)) {
      for (const issue of category) {
        score -= weights[issue.severity] || 1;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  // ── Recommendations ─────────────────────────────────────────────────────────

  _generateRecommendations(report) {
    const recs = [];
    const { issues } = report;

    // Critical accessibility
    if (issues.accessibility.filter(i => i.severity === 'error').length > 0) {
      recs.push({ priority: 'high', action: 'Fix critical accessibility issues (missing labels, ARIA roles)' });
    }

    // Performance
    if (issues.performance.length > 2) {
      recs.push({ priority: 'medium', action: 'Implement performance optimizations (memoization, code splitting)' });
    }

    // Dead UI cleanup
    if (issues.deadUI.length > 0) {
      recs.push({ priority: 'low', action: 'Clean up dead code, comments, and console statements' });
    }

    // Consistency
    if (issues.consistency.length > 0) {
      recs.push({ priority: 'medium', action: 'Centralize design tokens for color, spacing, and typography' });
    }

    // Interaction
    if (issues.interaction.filter(i => i.severity === 'error').length > 0) {
      recs.push({ priority: 'high', action: 'Add loading states, error handling, and disabled states' });
    }

    // Score-based general recommendation
    if (report.score < 50) {
      recs.unshift({ priority: 'critical', action: 'Overall health score is low - prioritize fixes across all categories' });
    } else if (report.score < 75) {
      recs.unshift({ priority: 'high', action: 'Health score below optimal - address warnings and errors' });
    }

    return recs;
  }

  // ── Batch Analysis ──────────────────────────────────────────────────────────

  /**
   * Analyze multiple files
   * @param {Array<{code: string, path: string}>} files
   * @returns {BatchReport}
   */
  analyzeBatch(files) {
    const results = files.map(f => ({
      path: f.path,
      ...this.analyze(f.code, { path: f.path }),
    }));

    const aggregateScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const allIssues = results.flatMap(r => r.issues);

    return {
      timestamp: new Date().toISOString(),
      fileCount: files.length,
      aggregateScore: Math.round(aggregateScore),
      files: results.map(r => ({ path: r.path, score: r.score })),
      globalIssues: this._aggregateIssues(allIssues),
      recommendations: this._generateRecommendations({ issues: this._aggregateIssues(allIssues) }),
    };
  }

  _aggregateIssues(allIssues) {
    const aggregated = {
      accessibility: [],
      performance: [],
      consistency: [],
      interaction: [],
      deadUI: [],
    };

    for (const category of Object.keys(aggregated)) {
      const categoryIssues = allIssues.filter(i => i.type);
      aggregated[category] = categoryIssues.slice(0, 10);
    }

    return aggregated;
  }

  // ── Diff Analysis ───────────────────────────────────────────────────────────

  /**
   * Compare two versions of code
   * @param {string} oldCode
   * @param {string} newCode
   * @returns {DiffReport}
   */
  analyzeDiff(oldCode, newCode) {
    const oldReport = this.analyze(oldCode);
    const newReport = this.analyze(newCode);

    return {
      timestamp: new Date().toISOString(),
      scoreChange: newReport.score - oldReport.score,
      oldScore: oldReport.score,
      newScore: newReport.score,
      issuesFixed: this._countFixedIssues(oldReport.issues, newReport.issues),
      issuesIntroduced: this._countFixedIssues(newReport.issues, oldReport.issues),
      newIssues: this._findNewIssues(oldReport.issues, newReport.issues),
    };
  }

  _countFixedIssues(oldIssues, newIssues) {
    let fixed = 0;
    for (const [cat, issues] of Object.entries(oldIssues)) {
      const oldTypes = issues.map(i => i.type);
      const newTypes = newIssues[cat]?.map(i => i.type) || [];
      fixed += oldTypes.filter(t => !newTypes.includes(t)).length;
    }
    return fixed;
  }

  _findNewIssues(oldIssues, newIssues) {
    const newIssuesList = [];
    for (const [cat, issues] of Object.entries(newIssues)) {
      const oldTypes = oldIssues[cat]?.map(i => i.type) || [];
      for (const issue of issues) {
        if (!oldTypes.includes(issue.type)) {
          newIssuesList.push({ category: cat, ...issue });
        }
      }
    }
    return newIssuesList;
  }

  // ── History ─────────────────────────────────────────────────────────────────

  getHistory() {
    return [...this.history];
  }

  clearHistory() {
    this.history = [];
  }
}

export default UIHealthAnalyzer;
