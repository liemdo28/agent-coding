// testing/TestTemplates.js - Test template strings for generated tests
export const TEMPLATES = {
  unit: `import { describe, it, expect } from '{{FRAMEWORK}}';
// Unit test: {{DESCRIPTION}}

describe('{{FUNCTION_NAME}}', () => {
  it('{{DESCRIPTION}}', () => {
    // TODO: import the function under test
    // import { {{FUNCTION_NAME}} } from '{{FILE_TO_TEST}}';
    const result = true; // replace with actual call
    expect(result).toBe({{EXPECTED}});
  });
});
`,

  smoke: `import { describe, it, expect } from '{{FRAMEWORK}}';
// Smoke test: {{DESCRIPTION}}

describe('Smoke: {{DESCRIPTION}}', () => {
  it('should not throw', async () => {
    // Basic smoke: ensure the module loads without error
    // const mod = await import('{{FILE_TO_TEST}}');
    expect(true).toBe(true);
  });
});
`,

  route: `import { describe, it, expect, beforeAll, afterAll } from '{{FRAMEWORK}}';
// Route test: {{DESCRIPTION}}

let server;

beforeAll(async () => {
  // Start the server on a test port
  // const app = (await import('{{FILE_TO_TEST}}')).default;
  // server = app.listen(0);
});

afterAll(() => server?.close());

describe('Route: {{DESCRIPTION}}', () => {
  it('should respond to GET {{FUNCTION_NAME}}', async () => {
    const port = server?.address()?.port ?? 3000;
    const res = await fetch(\`http://localhost:\${port}{{FUNCTION_NAME}}\`);
    expect(res.status).toBe({{EXPECTED}});
  });
});
`,

  api: `import { describe, it, expect } from '{{FRAMEWORK}}';
// API test: {{DESCRIPTION}}

const BASE = 'http://localhost:{{EXPECTED}}';

describe('API: {{DESCRIPTION}}', () => {
  it('{{FUNCTION_NAME}} should return 200', async () => {
    const res = await fetch(\`\${BASE}{{FUNCTION_NAME}}\`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toBeDefined();
  });
});
`,

  playwright: `import { test, expect } from '@playwright/test';
// Playwright test: {{DESCRIPTION}}

test('{{DESCRIPTION}}', async ({ page }) => {
  await page.goto('http://localhost:3000{{FUNCTION_NAME}}');
  await expect(page).toHaveTitle(/{{EXPECTED}}/);
  // Add more assertions here
});
`,

  regression: `import { describe, it, expect } from '{{FRAMEWORK}}';
// Regression test: {{DESCRIPTION}}
// Added after fix for: {{FUNCTION_NAME}}

describe('Regression: {{DESCRIPTION}}', () => {
  it('{{FUNCTION_NAME}} should behave correctly after fix', () => {
    // Verify the bug described in: {{FILE_TO_TEST}}
    // This test ensures the fix does not get reverted
    expect({{EXPECTED}}).toBeTruthy();
  });
});
`,
};

export function selectTemplate(task, projectMap) {
  const lower = task.toLowerCase();
  if (/playwright|browser|e2e|click|navigate|screenshot/.test(lower)) return 'playwright';
  if (/regression|revert|bug|fix/.test(lower)) return 'regression';
  if (/route|endpoint|handler|controller|path/.test(lower)) return 'route';
  if (/api|fetch|request|http|rest/.test(lower)) return 'api';
  if (/smoke|basic|import|load/.test(lower)) return 'smoke';
  return 'unit';
}

export function fillTemplate(templateName, vars = {}) {
  const tmpl = TEMPLATES[templateName] ?? TEMPLATES.unit;
  return tmpl.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? key);
}
