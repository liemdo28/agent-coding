// testing/TestGenerator.js - Generates test files via LLM, wrapped as patch proposals
import { join, relative, dirname } from 'path';
import { existsSync, readFileSync } from 'fs';
import { selectTemplate, fillTemplate } from './TestTemplates.js';
import { createPatch } from '../patch/PatchManager.js';
import { generateUnifiedDiff } from '../patch/DiffGenerator.js';

const SYSTEM_PROMPT = `You are a local offline test generation assistant.
Output ONLY test code. Do not explain outside code blocks.
Use the project's existing test framework (Jest, Vitest, or pytest).
Output a single test file as a unified diff block (triple-backtick diff).
Target the tests/, __tests__/, or spec/ directory.
NEVER modify production source files.
Follow existing test patterns found in the project context.
Keep tests minimal but meaningful. One describe block, 2-3 it() clauses.`;

export function detectTestFramework(workspaceRoot) {
  const pkgPath = join(workspaceRoot, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps.vitest)  return 'vitest';
      if (allDeps.jest)    return 'jest';
      if (allDeps.mocha)   return 'mocha';
      if (pkg.scripts?.test?.includes('vitest')) return 'vitest';
      if (pkg.scripts?.test?.includes('jest'))   return 'jest';
    } catch { /* ignore */ }
  }
  if (existsSync(join(workspaceRoot, 'requirements.txt')) ||
      existsSync(join(workspaceRoot, 'setup.py'))) return 'pytest';
  return 'unknown';
}

export function detectTestDirectory(workspaceRoot) {
  for (const dir of ['tests', '__tests__', 'spec', 'src/__tests__', 'test']) {
    if (existsSync(join(workspaceRoot, dir))) return dir;
  }
  return 'tests';
}

function extractDiffBlocks(llmOutput) {
  const blocks = [];
  const re     = /```diff\n([\s\S]*?)```/g;
  let   m;
  while ((m = re.exec(llmOutput)) !== null) blocks.push(m[1]);
  return blocks;
}

export async function generateTest(task, workspaceRoot, config) {
  const testFramework = detectTestFramework(workspaceRoot);
  const testDir       = detectTestDirectory(workspaceRoot);
  const projectMap    = (() => {
    try {
      const p = join(workspaceRoot, '.local-agent', 'project-map.json');
      return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
    } catch { return null; }
  })();

  const templateName = selectTemplate(task, projectMap);
  const safeName     = task.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const targetFile   = `${testDir}/${safeName}.test.${testFramework === 'pytest' ? 'py' : 'js'}`;

  let llmUsed  = false;
  let diffs    = [];
  let llmError = null;

  // Try LLM generation
  try {
    const { LocalLLMAdapter } = await import('../llm/LocalLLMAdapter.js');
    const adapter = new LocalLLMAdapter(config);

    const userPrompt = `Task: ${task}\n\nTest framework: ${testFramework}\nTest file: ${targetFile}\n\nGenerate a test file as a unified diff.`;
    let response = '';
    for await (const token of adapter.streamChat(SYSTEM_PROMPT, userPrompt)) {
      response += token;
    }

    const blocks = extractDiffBlocks(response);
    if (blocks.length) {
      diffs    = blocks.map((b, i) => ({ filePath: targetFile, patchText: b }));
      llmUsed  = true;
    }
  } catch (err) {
    llmError = err.message;
  }

  // Fallback: generate from template
  if (!diffs.length) {
    const framework = testFramework === 'pytest' ? 'pytest' : 'vitest';
    const content   = fillTemplate(templateName, {
      FRAMEWORK:     framework,
      FUNCTION_NAME: safeName,
      DESCRIPTION:   task,
      FILE_TO_TEST:  '../src/index.js',
      EXPECTED:      'true',
    });
    const patchText = generateUnifiedDiff(targetFile, '', content);
    diffs = [{ filePath: targetFile, patchText }];
  }

  const patch = createPatch({
    task:          `Generate test: ${task}`,
    workspaceRoot,
    diffs,
    model:         config?.llm?.model ?? 'template',
    riskLevel:     'low',
  });

  return {
    patchId:       patch.patchId,
    testFramework,
    targetDir:     testDir,
    targetFile,
    files:         diffs.map((d) => d.filePath),
    llmUsed,
    llmError,
  };
}

export async function generateRegressionTest(patchId, workspaceRoot, config) {
  const { getPatch } = await import('../patch/PatchManager.js');
  const patch = getPatch(patchId, workspaceRoot);
  if (!patch) throw new Error(`Patch not found: ${patchId}`);
  const task = `Regression test for: ${patch.task} (patch ${patchId})`;
  return generateTest(task, workspaceRoot, config);
}
