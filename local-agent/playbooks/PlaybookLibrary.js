// playbooks/PlaybookLibrary.js — built-in engineering playbook library
export const BUILTIN_PLAYBOOKS = [
  {
    id:          'react-release-qa',
    name:        'React Release QA',
    description: 'Full QA checklist before releasing a React application',
    tags:        ['react', 'qa', 'release'],
    steps: [
      { seq: 1, phase: 'lint',       cmd: 'npm run lint',                 desc: 'Run ESLint — zero warnings' },
      { seq: 2, phase: 'typecheck',  cmd: 'npx tsc --noEmit',             desc: 'TypeScript typecheck' },
      { seq: 3, phase: 'test',       cmd: 'npm test -- --coverage',       desc: 'Unit tests with coverage' },
      { seq: 4, phase: 'build',      cmd: 'npm run build',                desc: 'Production build' },
      { seq: 5, phase: 'bundle-size',cmd: 'npx bundlesize',               desc: 'Check bundle size limits' },
      { seq: 6, phase: 'a11y',       cmd: 'npx axe-cli http://localhost:3000', desc: 'Accessibility scan' },
      { seq: 7, phase: 'agent-qa',   cmd: 'local-agent qa',               desc: 'Agent QA pass' },
      { seq: 8, phase: 'release-chk',cmd: 'local-agent release-check',   desc: 'Release readiness check' },
    ],
  },
  {
    id:          'vite-migration',
    name:        'Vite Migration Playbook',
    description: 'Migrate a project from Webpack/CRA to Vite',
    tags:        ['vite', 'migration', 'build'],
    steps: [
      { seq: 1, phase: 'backup',    cmd: 'local-agent scan',             desc: 'Snapshot current state' },
      { seq: 2, phase: 'install',   cmd: 'npm install vite @vitejs/plugin-react -D', desc: 'Install Vite' },
      { seq: 3, phase: 'config',    cmd: 'touch vite.config.js',         desc: 'Create vite.config.js' },
      { seq: 4, phase: 'index',     cmd: 'mv public/index.html index.html', desc: 'Move index.html to root' },
      { seq: 5, phase: 'env',       cmd: 'local-agent config scan',      desc: 'Check env variable names (VITE_ prefix)' },
      { seq: 6, phase: 'build',     cmd: 'npx vite build',               desc: 'Test Vite build' },
      { seq: 7, phase: 'qa',        cmd: 'local-agent qa',               desc: 'Full QA pass' },
      { seq: 8, phase: 'cleanup',   cmd: 'npm uninstall react-scripts',  desc: 'Remove old build tool' },
    ],
  },
  {
    id:          'fastapi-debug',
    name:        'FastAPI Debug Playbook',
    description: 'Systematic debugging for FastAPI applications',
    tags:        ['python', 'fastapi', 'debug'],
    steps: [
      { seq: 1, phase: 'deps',      cmd: 'pip check',                    desc: 'Verify dependency consistency' },
      { seq: 2, phase: 'env',       cmd: 'local-agent config scan',      desc: 'Check .env configuration' },
      { seq: 3, phase: 'logs',      cmd: 'uvicorn app.main:app --reload --log-level debug', desc: 'Start with debug logging' },
      { seq: 4, phase: 'routes',    cmd: 'curl http://127.0.0.1:8000/openapi.json', desc: 'Verify API schema loads' },
      { seq: 5, phase: 'tests',     cmd: 'pytest -x -v',                 desc: 'Run tests, stop at first failure' },
      { seq: 6, phase: 'correlate', cmd: 'local-agent correlate failures', desc: 'Correlate failures to root cause' },
    ],
  },
  {
    id:          'emergency-rollback',
    name:        'Emergency Rollback Workflow',
    description: 'Fast rollback procedure for broken production deployments',
    tags:        ['emergency', 'rollback', 'incident'],
    steps: [
      { seq: 1, phase: 'incident',  cmd: 'local-agent incident create --severity critical --category broken_release', desc: 'Open incident' },
      { seq: 2, phase: 'identify',  cmd: 'git log --oneline -10',        desc: 'Identify breaking commit' },
      { seq: 3, phase: 'rollback',  cmd: 'git revert HEAD --no-commit',  desc: 'Revert last commit' },
      { seq: 4, phase: 'qa',        cmd: 'local-agent qa',               desc: 'Quick QA on reverted state' },
      { seq: 5, phase: 'verify',    cmd: 'local-agent release-check',    desc: 'Release readiness check' },
      { seq: 6, phase: 'commit',    cmd: 'git commit -m "revert: emergency rollback"', desc: 'Commit revert' },
      { seq: 7, phase: 'close',     cmd: 'local-agent incident recover <id>', desc: 'Mark incident recovering' },
    ],
  },
  {
    id:          'laravel-deploy-prep',
    name:        'Laravel Deployment Prep',
    description: 'Pre-deployment checklist for Laravel applications',
    tags:        ['php', 'laravel', 'deploy'],
    steps: [
      { seq: 1, phase: 'env',       cmd: 'php artisan config:cache',     desc: 'Cache configuration' },
      { seq: 2, phase: 'routes',    cmd: 'php artisan route:cache',      desc: 'Cache routes' },
      { seq: 3, phase: 'views',     cmd: 'php artisan view:cache',       desc: 'Compile Blade views' },
      { seq: 4, phase: 'migrate',   cmd: 'php artisan migrate --force',  desc: 'Run migrations' },
      { seq: 5, phase: 'test',      cmd: 'php artisan test',             desc: 'Run test suite' },
      { seq: 6, phase: 'deps',      cmd: 'composer install --no-dev',    desc: 'Install prod-only deps' },
      { seq: 7, phase: 'optimize',  cmd: 'php artisan optimize',         desc: 'Framework optimization' },
      { seq: 8, phase: 'security',  cmd: 'local-agent vault scan',       desc: 'Check for exposed secrets' },
    ],
  },
];

/**
 * Get a playbook by ID or name.
 * @param {string} query
 * @returns {Playbook|null}
 */
export function findPlaybook(query) {
  const q = query.toLowerCase();
  return BUILTIN_PLAYBOOKS.find(
    (p) => p.id === q || p.name.toLowerCase() === q || p.id.includes(q) || p.name.toLowerCase().includes(q)
  ) ?? null;
}
