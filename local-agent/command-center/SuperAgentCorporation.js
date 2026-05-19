// command-center/SuperAgentCorporation.js
// Offline-first corporate command center for routing Telegram-style tasks.

import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { searchFilePurpose } from '../eng-log/FilePurposeIndexer.js';

export const DIVISIONS = [
  {
    id: 'rnd',
    name: 'Nghiên cứu & Phát triển',
    mission: 'Explore new technical directions, experiments, and invention-heavy work.',
    keywords: ['research', 'prototype', 'experiment', 'r&d', 'innovation', 'benchmark'],
  },
  {
    id: 'manufacturing',
    name: 'Kỹ thuật sản xuất',
    mission: 'Plan production engineering, repeatability, resource use, and operational quality.',
    keywords: ['manufacturing', 'production', 'factory', 'quality', 'process', 'throughput'],
  },
  {
    id: 'it-ai',
    name: 'Công nghệ thông tin & AI',
    mission: 'Own code, agent runtime, automation, AI workflows, build, fix, and integration work.',
    keywords: ['code', 'bug', 'fix', 'build', 'test', 'api', 'module', 'agent', 'ai', 'telegram', 'vs', 'visual studio', 'payment'],
  },
  {
    id: 'finance',
    name: 'Tài chính & Đầu tư',
    mission: 'Own financial analysis, accounting workflows, investment logic, and controls.',
    keywords: ['finance', 'accounting', 'ledger', 'payment', 'invoice', 'tax', 'investment', 'revenue'],
  },
  {
    id: 'marketing-sales',
    name: 'Marketing & Sales toàn cầu',
    mission: 'Own positioning, growth, sales workflows, campaigns, and customer communication.',
    keywords: ['marketing', 'sales', 'campaign', 'brand', 'seo', 'customer', 'funnel'],
  },
  {
    id: 'operations-logistics',
    name: 'Vận hành & Logistics',
    mission: 'Own routing, supply chain, deployment operations, incidents, and runbooks.',
    keywords: ['operations', 'logistics', 'deploy', 'incident', 'runbook', 'supply', 'shipping'],
  },
  {
    id: 'hr-culture',
    name: 'Quản trị nhân sự & Văn hóa doanh nghiệp',
    mission: 'Own roles, hiring, training, culture, team design, and internal standards.',
    keywords: ['hr', 'hiring', 'jd', 'team', 'culture', 'training', 'handbook'],
  },
  {
    id: 'legal-compliance',
    name: 'Pháp chế & Tuân thủ',
    mission: 'Own legal review, compliance, policy, governance, risk, and audit readiness.',
    keywords: ['legal', 'compliance', 'policy', 'risk', 'audit', 'contract', 'sox', 'soc2'],
  },
];

const TASK_TYPES = [
  { type: 'build_fix', keywords: ['fix', 'bug', 'build', 'test', 'lint', 'error', 'crash', 'fail'] },
  { type: 'audit', keywords: ['audit', 'review', 'qa', 'security', 'risk', 'compliance'] },
  { type: 'plan', keywords: ['plan', 'roadmap', 'design', 'architecture', 'spec'] },
  { type: 'report', keywords: ['report', 'summary', 'status', 'inventory', 'baseline'] },
];

function normalize(text) {
  return String(text ?? '').toLowerCase();
}

function scoreKeywords(text, keywords) {
  return keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
}

function stableId(prefix, text) {
  let hash = 0;
  for (const ch of String(text)) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return `${prefix}-${Math.abs(hash).toString(36).padStart(6, '0')}`;
}

export function defineDivisions() {
  return DIVISIONS.map((division) => ({ ...division }));
}

export function createCompanies(divisions = DIVISIONS) {
  return divisions.map((division) => ({
    id: division.id,
    name: `Công ty ${division.name}`,
    division: division.name,
    mission: division.mission,
    team: [
      { role: 'Architect', experienceYears: 60 },
      { role: 'Dev Lead', experienceYears: 60 },
      { role: 'QA Lead', experienceYears: 60 },
      { role: 'Risk Officer', experienceYears: 60 },
    ],
    knowledgeBase: { sources: [] },
    keywords: division.keywords,
  }));
}

export function parseTask(message, opts = {}) {
  const raw = String(message ?? '').trim();
  const text = normalize(raw);
  const typeMatch = TASK_TYPES
    .map((entry) => ({ ...entry, score: scoreKeywords(text, entry.keywords) }))
    .sort((a, b) => b.score - a.score)[0];

  const priority =
    /\b(p0|urgent|critical|khẩn|gấp|nghiêm trọng)\b/i.test(raw) ? 'high' :
      /\b(low|later|minor|nhẹ)\b/i.test(raw) ? 'low' : 'normal';

  return {
    id: stableId('task', raw || 'empty'),
    source: opts.source ?? 'telegram',
    raw,
    normalized: text,
    type: typeMatch?.score > 0 ? typeMatch.type : 'plan',
    priority,
    createdAt: opts.now ?? new Date().toISOString(),
  };
}

export function selectCompany(task, companies = createCompanies()) {
  const text = `${task.normalized} ${task.type}`;
  const scored = companies
    .map((company) => ({
      company,
      score:
        scoreKeywords(text, company.keywords) +
        (task.type === 'build_fix' && company.id === 'it-ai' ? 2 : 0) +
        (task.type === 'audit' && company.id === 'legal-compliance' ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].company : companies.find((c) => c.id === 'it-ai');
}

export function retrieveOfflineContext(task, workspaceRoot = process.cwd()) {
  const query = task.raw || task.type;
  const filePurposeMatches = searchFilePurpose(workspaceRoot, query).slice(0, 5);
  return {
    query,
    sources: filePurposeMatches.map((match) => ({
      type: 'file-purpose',
      file: match.file,
      purpose: match.purpose,
      score: match.score,
    })),
  };
}

export function generatePrompt(task, company, context = { sources: [] }) {
  const sources = context.sources?.length
    ? context.sources.map((s) => `- ${s.file}: ${s.purpose}`).join('\n')
    : '- No direct file-purpose matches; use project scan and offline KB.';

  return [
    `Role: ${company.name}`,
    `Mission: ${company.mission}`,
    `Task: ${task.raw}`,
    `Task type: ${task.type}`,
    `Priority: ${task.priority}`,
    '',
    'Offline context:',
    sources,
    '',
    'Execution contract:',
    '- Work offline. Telegram is only for receiving commands and returning summaries.',
    '- Dev proposes patches or commands; no silent mutation.',
    '- QA audits in parallel and must report risks, tests, and approval state.',
    '- Any high-risk action requires explicit human approval.',
  ].join('\n');
}

export async function runDevHandler(company, task, prompt) {
  const suggestedCommands = task.type === 'build_fix'
    ? ['npm run build', 'npm test', 'npm run test:integration']
    : ['npm run build', 'npm run lint'];

  return {
    role: 'Dev',
    companyId: company.id,
    status: 'proposal-ready',
    summary: `Dev prepared an offline execution plan for "${task.raw}".`,
    proposedActions: [
      'Inspect relevant files from offline context.',
      'Generate patch proposal only; wait for explicit apply approval.',
      'Run verification commands after patch proposal is reviewed.',
    ],
    suggestedCommands,
    promptDigest: stableId('prompt', prompt),
  };
}

export async function runQAHandler(company, task, prompt) {
  const riskLevel =
    task.priority === 'high' || /\b(payment|auth|security|ledger|deploy)\b/.test(task.normalized)
      ? 'medium'
      : 'low';

  return {
    role: 'QA',
    companyId: company.id,
    status: riskLevel === 'medium' ? 'review-required' : 'provisionally-approved',
    summary: `QA prepared audit criteria for "${task.raw}".`,
    auditChecklist: [
      'Check offline policy boundary.',
      'Check command policy and sandbox audit events.',
      'Check build/test/lint output.',
      'Check rollback path before apply.',
    ],
    riskLevel,
    promptDigest: stableId('qa-prompt', prompt),
  };
}

export async function parallelExecution(company, task, prompt) {
  const [dev, qa] = await Promise.all([
    runDevHandler(company, task, prompt),
    runQAHandler(company, task, prompt),
  ]);
  return { dev, qa };
}

export async function executeCorporateTask(message, opts = {}) {
  const workspaceRoot = resolve(opts.workspaceRoot ?? process.cwd());
  const companies = opts.companies ?? createCompanies();
  const task = parseTask(message, opts);
  const company = selectCompany(task, companies);
  const context = opts.context ?? retrieveOfflineContext(task, workspaceRoot);
  const prompt = generatePrompt(task, company, context);
  const execution = await parallelExecution(company, task, prompt);

  const result = {
    dispatchId: stableId('dispatch', `${task.id}:${company.id}:${task.createdAt}`),
    task,
    company: {
      id: company.id,
      name: company.name,
      division: company.division,
    },
    context,
    prompt,
    execution,
    telegramSummary: '',
  };
  result.telegramSummary = formatTelegramSummary(result);
  return result;
}

export function formatTelegramSummary(result) {
  return [
    `Dispatch: ${result.dispatchId}`,
    `Company: ${result.company.name}`,
    `Task: ${result.task.raw}`,
    `Dev: ${result.execution.dev.status}`,
    `QA: ${result.execution.qa.status} (${result.execution.qa.riskLevel} risk)`,
    `Next: review proposal, then explicitly approve any file-changing action.`,
  ].join('\n');
}

export function saveExecutionReport(workspaceRoot, result) {
  const dir = join(resolve(workspaceRoot), '.local-agent', 'command-center');
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${result.dispatchId}.json`);
  writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8');
  return filePath;
}
