const templates = [
  {
    skillId: 'fix-vite-build',
    name: 'Fix Vite Build',
    category: 'build-fix',
    framework: 'vite',
    description: 'Diagnose and fix common Vite build errors',
    tags: ['vite', 'build', 'error', 'fix'],
    riskLevel: 'medium',
    steps: [
      { description: 'Check vite.config.js for configuration errors' },
      { description: 'Run vite build to see actual error' },
      { description: 'Check for missing dependencies' },
      { description: 'Clear vite cache' },
      { description: 'Check for ESM/CommonJS compatibility issues' }
    ],
    verification: ['npm run build succeeds'],
    rollback: [{ description: 'Restore vite.config.js from git' }]
  },
  {
    skillId: 'fix-typescript-import',
    name: 'Fix TypeScript Import',
    category: 'build-fix',
    framework: 'typescript',
    description: 'Fix TypeScript import and type errors',
    tags: ['typescript', 'import', 'type', 'fix'],
    riskLevel: 'low',
    steps: [
      { description: 'Run TypeScript compiler to see errors' },
      { description: 'Check tsconfig.json paths configuration' },
      { description: 'Fix missing type declarations' },
      { description: 'Update import paths if needed' }
    ],
    verification: ['tsc --noEmit passes'],
    rollback: [{ description: 'Restore original files' }]
  },
  {
    skillId: 'analyze-react-hydration',
    name: 'Analyze React Hydration',
    category: 'debug',
    framework: 'react',
    description: 'Analyze and fix React hydration mismatches',
    tags: ['react', 'hydration', 'ssr', 'debug'],
    riskLevel: 'low',
    steps: [
      { description: 'Check for browser-only APIs in SSR code' },
      { description: 'Look for date/time formatting differences' },
      { description: 'Check for random values that differ between server/client' },
      { description: 'Verify useEffect timing' }
    ],
    verification: ['No hydration mismatch warnings'],
    rollback: []
  },
  {
    skillId: 'qa-nextjs-app',
    name: 'QA Next.js App',
    category: 'qa',
    framework: 'nextjs',
    description: 'QA checklist for Next.js applications',
    tags: ['nextjs', 'qa', 'checklist', 'quality'],
    riskLevel: 'low',
    steps: [
      { description: 'Check API routes for error handling' },
      { description: 'Verify SSR/SSG pages render correctly' },
      { description: 'Test getStaticProps and getServerSideProps' },
      { description: 'Check environment variables are set' },
      { description: 'Verify redirects and rewrites configuration' }
    ],
    verification: ['All pages load correctly'],
    rollback: []
  },
  {
    skillId: 'review-express-api',
    name: 'Review Express API',
    category: 'review',
    framework: 'express',
    description: 'Review Express API for best practices',
    tags: ['express', 'api', 'review', 'security'],
    riskLevel: 'low',
    steps: [
      { description: 'Check for input validation on all routes' },
      { description: 'Verify error handling middleware exists' },
      { description: 'Check for authentication/authorization' },
      { description: 'Look for rate limiting configuration' },
      { description: 'Verify CORS configuration' }
    ],
    verification: ['All routes have validation'],
    rollback: []
  },
  {
    skillId: 'generate-sqlite-migration',
    name: 'SQLite Migration Checklist',
    category: 'database',
    framework: 'sqlite',
    description: 'Checklist for SQLite migration safety',
    tags: ['sqlite', 'migration', 'database', 'checklist'],
    riskLevel: 'high',
    steps: [
      { description: 'Backup current database' },
      { description: 'Review migration SQL for data loss risks' },
      { description: 'Test migration on backup copy first' },
      { description: 'Verify foreign key constraints' },
      { description: 'Check for proper indexes on new columns' }
    ],
    verification: ['Backup created', 'Migration tested'],
    rollback: [{ description: 'Restore from backup' }]
  }
];

module.exports = templates;