#!/usr/bin/env node
// bin/super-agent-corp.js - offline corporate agent command-center prototype

import { executeCorporateTask, saveExecutionReport } from '../local-agent/command-center/SuperAgentCorporation.js';

function parseArgs(argv) {
  const args = [...argv];
  const opts = { save: false, json: false, workspaceRoot: process.cwd() };
  const taskParts = [];

  while (args.length) {
    const arg = args.shift();
    if (arg === '--save') opts.save = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--workspace') opts.workspaceRoot = args.shift() ?? process.cwd();
    else taskParts.push(arg);
  }

  return { task: taskParts.join(' ').trim(), opts };
}

const { task, opts } = parseArgs(process.argv.slice(2));

if (!task) {
  console.log('Usage: node bin/super-agent-corp.js [--json] [--save] [--workspace <path>] "<task>"');
  console.log('Example: node bin/super-agent-corp.js --save "Fix bug module payment"');
  process.exit(0);
}

const result = await executeCorporateTask(task, {
  source: 'telegram',
  workspaceRoot: opts.workspaceRoot,
});

if (opts.save) {
  result.reportPath = saveExecutionReport(opts.workspaceRoot, result);
}

if (opts.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('\n=== Super Agent Corporation Dispatch ===\n');
  console.log(result.telegramSummary);
  if (opts.save) console.log(`\nSaved: ${result.reportPath}`);
  console.log();
}
