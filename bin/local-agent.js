#!/usr/bin/env node
// bin/local-agent.js - CLI entrypoint for the local/offline AI Coding Agent

import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const { program, Command } = await import('commander');
  const chalk = (await import('chalk')).default;
  const ora   = (await import('ora')).default;

  const { loadConfig }                      = await import('../local-agent/core/config.js');
  const { initWorkspace, getWorkspacePaths,
          isWorkspaceInitialized }          = await import('../local-agent/core/workspace.js');
  const { initLogger, logger }              = await import('../local-agent/core/logger.js');
  const { scanProject }                     = await import('../local-agent/scanner/scanner.js');
  const { runPolicyChecks }                 = await import('../local-agent/core/policy.js');

  // ── Banner ──────────────────────────────────────────────────────────────
  function printBanner() {
    console.log(chalk.bold.cyan('\n  local-agent') + chalk.gray(' v1.0.0'));
    console.log(
      chalk.bgGreen.black.bold('  OFFLINE MODE  ') +
      '  ' + chalk.gray('No internet. No telemetry. Fully local.\n')
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function resolveTarget(pathArg) {
    return pathArg ? resolve(pathArg) : process.cwd();
  }

  function die(msg) {
    console.error(chalk.red('ERROR: ') + msg);
    process.exit(1);
  }

  function formatBytes(bytes) {
    if (bytes < 1024)    return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  }

  function formatDate(isoStr) {
    if (!isoStr) return 'never';
    return new Date(isoStr).toLocaleString();
  }

  function formatMs(ms) {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function checkIcon(passed) {
    if (passed === true)  return chalk.green('✓');
    if (passed === false) return chalk.red('✗');
    return chalk.yellow('–');
  }

  // ── Program ──────────────────────────────────────────────────────────────
  program
    .name('local-agent')
    .description('Fully local/offline AI Coding Agent')
    .version('1.0.0');

  // ── init ─────────────────────────────────────────────────────────────────
  program
    .command('init [path]')
    .description('Initialize the agent in a project directory and run first scan')
    .option('--project <path>', 'Path to target project (alias for positional arg)')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);

      const spinner = ora('Initializing workspace...').start();
      try {
        const { workspaceDir, created } = initWorkspace(targetDir);
        const config = loadConfig(targetDir);
        initLogger(targetDir, 'info', false);

        spinner[created ? 'succeed' : 'info'](
          chalk[created ? 'green' : 'yellow'](
            `Workspace ${created ? 'created' : 'already exists'} at ${workspaceDir}`
          )
        );

        const scanSpinner = ora('Scanning project...').start();
        const projectMap  = await scanProject(targetDir, config);
        scanSpinner.succeed(
          chalk.green(`Scan complete — ${projectMap.stats.totalFiles} files, `) +
          chalk.cyan(formatBytes(projectMap.stats.totalSize))
        );

        logger.info('init completed', { targetDir, files: projectMap.stats.totalFiles });

        console.log('\n' + chalk.bold('Project info:'));
        console.log(`  ${chalk.gray('Types:')}      ${projectMap.projectTypes.join(', ') || 'unknown'}`);
        console.log(`  ${chalk.gray('Frameworks:')} ${projectMap.frameworks.join(', ')   || 'unknown'}`);
        console.log(`  ${chalk.gray('Languages:')}  ${projectMap.languages.join(', ')    || 'unknown'}`);
        console.log(`  ${chalk.gray('Pkg mgr:')}    ${projectMap.packageManager          || 'unknown'}`);
        console.log(`  ${chalk.gray('Files:')}      ${projectMap.stats.totalFiles}`);
        console.log(`  ${chalk.gray('Routes:')}     ${projectMap.routes.length}`);
        console.log(`  ${chalk.gray('Components:')} ${projectMap.components.length}`);
        console.log(`  ${chalk.gray('Endpoints:')}  ${projectMap.endpoints.length}`);
        console.log(`  ${chalk.gray('TODOs:')}      ${projectMap.todos.length}`);
        if (projectMap.risks.hardcodedSecrets.length > 0) {
          console.log(
            `  ${chalk.red('⚠ Secrets:')}  ` +
            chalk.red(`${projectMap.risks.hardcodedSecrets.length} possible hardcoded secret(s) detected!`)
          );
        }
        console.log(`  ${chalk.gray('Workspace:')}  ${workspaceDir}`);
        console.log('\n' + chalk.bold.green('✓ Ready. Run `local-agent ask "<question>"` to query the codebase.\n'));
      } catch (err) {
        spinner.fail(chalk.red('Init failed'));
        die(err.message);
      }
    });

  // ── scan ─────────────────────────────────────────────────────────────────
  program
    .command('scan [path]')
    .description('Scan or rescan the project and update the project map')
    .option('--project <path>', 'Path to target project')
    .option('--verbose', 'Show detailed file list')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);

      if (!isWorkspaceInitialized(targetDir)) {
        die(`Workspace not initialized. Run: local-agent init --project ${opts.project ?? pathArg ?? '.'}`);
      }

      const config = loadConfig(targetDir);
      initLogger(targetDir, 'info', false);
      const spinner = ora('Scanning project files...').start();

      try {
        const projectMap = await scanProject(targetDir, config);
        spinner.succeed(chalk.green(`Scan complete — ${projectMap.stats.totalFiles} files`));
        logger.info('scan completed', { targetDir, files: projectMap.stats.totalFiles });

        console.log('\n' + chalk.bold('Results:'));
        console.log(`  ${chalk.gray('Types:')}      ${projectMap.projectTypes.join(', ') || 'unknown'}`);
        console.log(`  ${chalk.gray('Frameworks:')} ${projectMap.frameworks.join(', ')   || 'unknown'}`);
        console.log(`  ${chalk.gray('Languages:')}  ${projectMap.languages.join(', ')    || 'unknown'}`);
        console.log(`  ${chalk.gray('Pkg mgr:')}    ${projectMap.packageManager          || 'unknown'}`);
        console.log(`  ${chalk.gray('Files:')}      ${projectMap.stats.totalFiles} (${formatBytes(projectMap.stats.totalSize)})`);
        console.log(`  ${chalk.gray('Routes:')}     ${projectMap.routes.length}`);
        console.log(`  ${chalk.gray('Components:')} ${projectMap.components.length}`);
        console.log(`  ${chalk.gray('Endpoints:')}  ${projectMap.endpoints.length}`);
        console.log(`  ${chalk.gray('TODOs:')}      ${projectMap.todos.length}`);
        console.log(`  ${chalk.gray('Scanned at:')} ${formatDate(projectMap.scannedAt)}`);

        if (projectMap.risks.hardcodedSecrets.length > 0) {
          console.log('\n' + chalk.bold.red('⚠  Possible hardcoded secrets:'));
          projectMap.risks.hardcodedSecrets.slice(0, 5).forEach((s) => {
            console.log(`   ${chalk.red('›')} ${s.file}:${s.line} — ${s.type}`);
          });
        }

        if (projectMap.commands.build || projectMap.commands.test || projectMap.commands.lint) {
          console.log('\n' + chalk.bold('Commands detected:'));
          if (projectMap.commands.build) console.log(`  ${chalk.gray('Build:')} ${projectMap.commands.build}`);
          if (projectMap.commands.test)  console.log(`  ${chalk.gray('Test:')}  ${projectMap.commands.test}`);
          if (projectMap.commands.lint)  console.log(`  ${chalk.gray('Lint:')}  ${projectMap.commands.lint}`);
        }

        if (opts.verbose) {
          console.log('\n' + chalk.bold('Files:'));
          projectMap.files.slice(0, 50).forEach((f) => {
            console.log(`  ${chalk.gray(formatBytes(f.size).padStart(8))}  ${f.path}`);
          });
          if (projectMap.files.length > 50) {
            console.log(chalk.gray(`  ... and ${projectMap.files.length - 50} more`));
          }
        }

        const paths = getWorkspacePaths(targetDir);
        console.log(`\n  ${chalk.gray('Map:')}     ${paths.projectMap}`);
        console.log(`  ${chalk.gray('Summary:')} ${paths.summary}`);
        console.log(`  ${chalk.gray('Reports:')} ${paths.reports}\n`);
      } catch (err) {
        spinner.fail(chalk.red('Scan failed'));
        die(err.message);
      }
    });

  // ── status ───────────────────────────────────────────────────────────────
  program
    .command('status [path]')
    .description('Show agent status, config, and last scan info')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);

      const initialized = isWorkspaceInitialized(targetDir);
      const paths       = getWorkspacePaths(targetDir);

      console.log(chalk.bold('Workspace:'));
      console.log(`  ${chalk.gray('Directory:')}   ${targetDir}`);
      console.log(`  ${chalk.gray('Initialized:')} ${initialized ? chalk.green('yes') : chalk.red('no — run local-agent init')}`);
      if (!initialized) { console.log(); return; }

      const config = loadConfig(targetDir);

      console.log('\n' + chalk.bold('Policy:'));
      console.log(`  ${chalk.green('✓')} Offline mode: ${config.offline}`);
      console.log(`  ${chalk.green('✓')} Telemetry:    ${config.telemetry}`);
      console.log(`  ${chalk.green('✓')} Cloud sync:   ${config.cloudSync}`);

      console.log('\n' + chalk.bold('LLM:'));
      console.log(`  ${chalk.gray('Provider:')}  ${config.llm.provider}`);
      console.log(`  ${chalk.gray('Model:')}     ${config.llm.model}`);
      console.log(`  ${chalk.gray('Base URL:')}  ${config.llm.baseUrl}`);
      console.log(`  ${chalk.gray('Fallback:')}  ${config.llm.fallbackModel}`);

      if (existsSync(paths.projectMap)) {
        try {
          const map = JSON.parse(readFileSync(paths.projectMap, 'utf8'));
          console.log('\n' + chalk.bold('Last scan:'));
          console.log(`  ${chalk.gray('At:')}         ${formatDate(map.scannedAt)}`);
          console.log(`  ${chalk.gray('Frameworks:')} ${map.frameworks?.join(', ') || 'unknown'}`);
          console.log(`  ${chalk.gray('Files:')}      ${map.stats.totalFiles}`);
          console.log(`  ${chalk.gray('Size:')}       ${formatBytes(map.stats.totalSize)}`);
          console.log(`  ${chalk.gray('TODOs:')}      ${map.todos.length}`);
          console.log(`  ${chalk.gray('Secrets:')}    ${map.risks?.hardcodedSecrets?.length ?? 0}`);
        } catch {
          console.log('\n' + chalk.yellow('  Last scan data unreadable.'));
        }
      } else {
        console.log('\n' + chalk.yellow('  No scan data yet. Run: local-agent scan'));
      }

      console.log('\n' + chalk.bold('Paths:'));
      console.log(`  ${chalk.gray('Workspace:')} ${paths.workspace}`);
      console.log(`  ${chalk.gray('Logs:')}      ${paths.logFile}`);
      console.log(`  ${chalk.gray('Reports:')}   ${paths.reports}`);
      console.log();
    });

  // ── policy-check ─────────────────────────────────────────────────────────
  program
    .command('policy-check [path]')
    .description('Verify offline and security policy compliance')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);

      const config = loadConfig(targetDir);
      initLogger(targetDir, 'info', false);

      console.log(chalk.bold('Running policy checks...\n'));
      const report = runPolicyChecks(targetDir, config);

      for (const check of report.checks) {
        const icon  = checkIcon(check.passed);
        const label = chalk.gray(check.name.padEnd(42));
        const sev   =
          check.passed === false && check.severity === 'FAIL' ? chalk.red('[FAIL]') :
          check.passed === false && check.severity === 'WARN' ? chalk.yellow('[WARN]') :
          check.passed === null                               ? chalk.gray('[INFO]') :
                                                               chalk.green('[PASS]');
        console.log(`  ${icon}  ${label} ${sev}  ${check.message}`);
        if (check.details?.length) {
          check.details.forEach((d) => console.log(`       ${chalk.gray('→')} ${d}`));
        }
      }

      console.log();
      const rc = report.result;
      const resultColor = rc === 'PASS' ? 'green' : rc === 'WARNING' ? 'yellow' : 'red';
      const resultIcon  = rc === 'PASS' ? '✓' : rc === 'WARNING' ? '⚠' : '✗';
      console.log(
        chalk[resultColor].bold(`  ${resultIcon}  Policy result: ${rc}`) +
        chalk.gray(`  (${report.failCount} fail, ${report.warnCount} warn)`)
      );
      console.log();

      logger.info('policy-check completed', { result: rc, fails: report.failCount });
      if (!report.passed) process.exit(1);
    });

  // ── ask (Phase 2) ─────────────────────────────────────────────────────────
  program
    .command('ask <question> [path]')
    .description('Ask the local AI agent a question about the codebase')
    .option('--project <path>', 'Path to target project')
    .action(async (question, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      if (!isWorkspaceInitialized(targetDir)) die('Workspace not initialized. Run: local-agent init');

      try {
        const { askAgent } = await import('../local-agent/llm/agent.js');
        await askAgent(question, targetDir);
      } catch (err) {
        if (err.code === 'ERR_MODULE_NOT_FOUND') {
          console.log(chalk.yellow('⚠  LLM module not yet loaded.'));
          console.log(chalk.gray(`   Question: "${question}"\n`));
        } else {
          die(err.message);
        }
      }
    });

  // ── fix ───────────────────────────────────────────────────────────────────
  program
    .command('fix <task> [path]')
    .description('Generate a patch proposal for a task via local LLM (does NOT auto-apply)')
    .option('--project <path>', 'Path to target project')
    .action(async (task, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      if (!isWorkspaceInitialized(targetDir)) die('Workspace not initialized. Run: local-agent init');

      const { loadConfig }           = await import('../local-agent/core/config.js');
      const { generatePatchesViaLLM } = await import('../local-agent/patch/DiffGenerator.js');
      const { createPatch }           = await import('../local-agent/patch/PatchManager.js');
      const config = loadConfig(targetDir);

      console.log(chalk.bold(`Generating patch for: "${task}"\n`));
      const llmSpinner = ora('Querying local LLM for patch proposal...').start();

      try {
        const { patches, llmOutput, cannotPatch } = await generatePatchesViaLLM(task, targetDir, config);
        llmSpinner.stop();

        if (cannotPatch) {
          console.log(chalk.yellow(`⚠  LLM cannot patch this task: ${cannotPatch}\n`));
          return;
        }
        if (!patches.length) {
          console.log(chalk.yellow('⚠  No diff blocks extracted from LLM output.'));
          console.log(chalk.gray('   LLM said:\n') + chalk.gray(llmOutput.slice(0, 500)));
          return;
        }

        const patch = createPatch({
          task,
          workspaceRoot: targetDir,
          diffs: patches,
          model: config.llm.model,
        });

        console.log(chalk.green(`✓ Patch ${patch.patchId} created (status: proposed, NOT applied)\n`));
        console.log(chalk.bold('Details:'));
        console.log(`  ${chalk.gray('Patch ID:')}   ${patch.patchId}`);
        console.log(`  ${chalk.gray('Risk:')}       ${patch.riskLevel}`);
        console.log(`  ${chalk.gray('Files:')}      ${patch.filesChanged.join(', ')}`);
        console.log('\n' + chalk.bold('Next steps:'));
        console.log(`  ${chalk.cyan('local-agent show-patch')} ${patch.patchId} --project ${opts.project ?? '.'}`);
        console.log(`  ${chalk.cyan('local-agent apply')} ${patch.patchId} --project ${opts.project ?? '.'}`);
        console.log(`  ${chalk.cyan('local-agent patches')} --project ${opts.project ?? '.'}\n`);
      } catch (err) {
        llmSpinner.fail(chalk.red('Fix generation failed'));
        die(err.message);
      }
    });

  // ── patches ───────────────────────────────────────────────────────────────
  program
    .command('patches [path]')
    .description('List all patch proposals for a project')
    .option('--project <path>', 'Path to target project')
    .option('--status <status>', 'Filter by status (proposed|applied|rejected|rolled_back)')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);

      const { listPatches } = await import('../local-agent/patch/PatchManager.js');
      let patches = listPatches(targetDir);

      if (opts.status) {
        patches = patches.filter((p) => p.status === opts.status);
      }

      if (!patches.length) {
        console.log(chalk.yellow('No patches found. Run: local-agent fix "<task>"\n'));
        return;
      }

      console.log(chalk.bold(`Patches (${patches.length} total):\n`));
      for (const p of patches) {
        const statusColor = p.status === 'applied' ? 'green' : p.status === 'proposed' ? 'blue' :
                            p.status === 'rolled_back' ? 'yellow' : p.status === 'failed' ? 'red' : 'gray';
        const riskColor   = p.riskLevel === 'high' ? 'red' : p.riskLevel === 'medium' ? 'yellow' : 'gray';
        console.log(
          `  ${chalk.bold(p.patchId)}  ${chalk[statusColor](`[${p.status}]`)}  ` +
          `${chalk[riskColor](`risk:${p.riskLevel}`)}  ${chalk.gray(p.task.slice(0, 60))}`
        );
        console.log(`         ${chalk.gray(p.filesChanged.join(', ').slice(0, 80))}  ` +
                    chalk.gray(new Date(p.createdAt).toLocaleString()));
      }
      console.log();
    });

  // ── show-patch ────────────────────────────────────────────────────────────
  program
    .command('show-patch <patch-id> [path]')
    .description('Show details and diff for a patch proposal')
    .option('--project <path>', 'Path to target project')
    .action(async (patchId, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { getPatch } = await import('../local-agent/patch/PatchManager.js');
      const patch = getPatch(patchId, targetDir);
      if (!patch) die(`Patch not found: ${patchId}`);

      const statusColor = patch.status === 'applied' ? 'green' : patch.status === 'proposed' ? 'blue' :
                          patch.status === 'rolled_back' ? 'yellow' : 'red';

      console.log(chalk.bold(`Patch: ${patch.patchId}`));
      console.log(`  ${chalk.gray('Task:')}     ${patch.task}`);
      console.log(`  ${chalk.gray('Status:')}   ${chalk[statusColor](patch.status)}`);
      console.log(`  ${chalk.gray('Risk:')}     ${patch.riskLevel}`);
      console.log(`  ${chalk.gray('Created:')}  ${new Date(patch.createdAt).toLocaleString()}`);
      console.log(`  ${chalk.gray('Files:')}    ${patch.filesChanged.join(', ')}`);
      if (patch.model) console.log(`  ${chalk.gray('Model:')}    ${patch.model}`);
      if (patch.error) console.log(`  ${chalk.red('Error:')}    ${patch.error}`);
      if (patch.backupPath) console.log(`  ${chalk.gray('Backup:')}   ${patch.backupPath}`);

      if (patch.rollbackCommands?.length) {
        console.log('\n' + chalk.bold('Rollback commands:'));
        patch.rollbackCommands.forEach((c) => console.log(`  ${chalk.gray(c)}`));
      }

      console.log('\n' + chalk.bold('Diff:'));
      for (const diff of patch.diffs) {
        console.log(chalk.cyan(`\n  File: ${diff.filePath}`));
        console.log(chalk.gray(diff.patchText.split('\n').map((l) => '  ' + l).join('\n')));
      }
      console.log();
    });

  // ── apply ─────────────────────────────────────────────────────────────────
  program
    .command('apply <patch-id> [path]')
    .description('Apply a patch proposal (creates backup first)')
    .option('--project <path>', 'Path to target project')
    .action(async (patchId, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);

      const { getPatch, applyPatchById } = await import('../local-agent/patch/PatchManager.js');
      const patch = getPatch(patchId, targetDir);
      if (!patch) die(`Patch not found: ${patchId}`);
      if (patch.status !== 'proposed') die(`Patch ${patchId} is ${patch.status} — can only apply proposed patches`);

      if (patch.riskLevel === 'high') {
        console.log(chalk.red.bold(`⚠  HIGH RISK PATCH — requires confirmation`));
        console.log(chalk.gray(`   Files: ${patch.filesChanged.join(', ')}`));
        console.log(chalk.gray(`   Task: ${patch.task}\n`));
      }

      const spinner = ora(`Applying ${patchId}...`).start();
      const result  = applyPatchById(patchId, targetDir);

      if (result.success) {
        spinner.succeed(chalk.green(`${patchId} applied — backup at: ${result.backupPath}`));
        result.applied.forEach((f) => console.log(`  ${chalk.green('✓')} ${f}`));
        console.log(`\n  ${chalk.gray('Rollback:')} local-agent rollback ${patchId} --project ${opts.project ?? '.'}\n`);
      } else {
        spinner.fail(chalk.red(`Apply failed: ${result.errors.join('; ')}`));
        process.exit(1);
      }
    });

  // ── rollback ──────────────────────────────────────────────────────────────
  program
    .command('rollback <patch-id> [path]')
    .description('Roll back an applied patch from its backup')
    .option('--project <path>', 'Path to target project')
    .action(async (patchId, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);

      const { getPatch, rollbackPatchById } = await import('../local-agent/patch/PatchManager.js');
      const patch = getPatch(patchId, targetDir);
      if (!patch) die(`Patch not found: ${patchId}`);
      if (patch.status !== 'applied') die(`Patch ${patchId} is ${patch.status} — can only rollback applied patches`);

      const spinner = ora(`Rolling back ${patchId}...`).start();
      const result  = rollbackPatchById(patchId, targetDir);

      if (result.success) {
        spinner.succeed(chalk.green(`${patchId} rolled back — ${result.restored.length} file(s) restored`));
        result.restored.forEach((f) => console.log(`  ${chalk.green('✓')} ${f}`));
        console.log();
      } else {
        spinner.fail(chalk.red('Rollback errors: ' + result.errors.join('; ')));
        process.exit(1);
      }
    });

  // ── qa ────────────────────────────────────────────────────────────────────
  program
    .command('qa [path]')
    .description('Run automated QA: build, test, score, regression check, report')
    .option('--project <path>', 'Path to target project')
    .option('--deep',     'Also run lint and typecheck')
    .option('--auto-fix', 'Engage LLM auto-debug loop on failures')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      if (!isWorkspaceInitialized(targetDir)) die('Workspace not initialized. Run: local-agent init');

      const { runQA } = await import('../local-agent/qa/QAEngine.js');
      const spinner = ora('Starting QA engine...').start();

      try {
        const result = await runQA(targetDir, {
          deep:     opts.deep    ?? false,
          autoFix:  opts.autoFix ?? false,
          onProgress: ({ phase, message }) => {
            spinner.text = chalk.gray(`[${phase}] ${message}`);
          },
        });

        spinner.stop();

        const { qaScore, buildResult, testResult, staticResults, regression, reportPaths } = result;
        const gradeColor = qaScore.grade === 'PASS' ? 'green' : qaScore.grade === 'WARNING' ? 'yellow' : 'red';

        console.log('\n' + chalk.bold('QA Results:'));
        console.log(`  ${chalk.gray('Build:')}     ${buildResult.success ? chalk.green('PASS') : chalk.red('FAIL')}  (${formatMs(buildResult.durationMs)})`);
        console.log(`  ${chalk.gray('Tests:')}     ${testResult.success  ? chalk.green('PASS') : chalk.red('FAIL')}  (${formatMs(testResult.durationMs)})`);
        if (testResult.summary) {
          console.log(`  ${chalk.gray('Test count:')} ${testResult.summary.passed} passed, ${testResult.summary.failed} failed, ${testResult.summary.total} total`);
        }
        if (opts.deep) {
          staticResults.forEach((r) => {
            console.log(`  ${chalk.gray(r.phase + ':')}${' '.repeat(Math.max(1, 8-r.phase.length))}${r.success ? chalk.green('PASS') : chalk.red('FAIL')}`);
          });
        }

        const totalErrors = (buildResult.errors?.length ?? 0) + (testResult.errors?.length ?? 0);
        if (totalErrors > 0) {
          console.log('\n' + chalk.bold('Errors detected:'));
          [...(buildResult.errors ?? []), ...(testResult.errors ?? [])].slice(0, 8).forEach((e) => {
            console.log(`  ${chalk.red('›')} [${e.errorType}] ${e.message?.slice(0, 80)}`);
            if (e.file) console.log(`    ${chalk.gray(`→ ${e.file}:${e.line ?? '?'}`)}`);
          });
        }

        if (regression.regressions.length > 0) {
          console.log('\n' + chalk.bold.yellow('⚠  Regressions vs previous run:'));
          regression.regressions.forEach((r) => {
            console.log(`  ${chalk.yellow('›')} ${r.message}`);
          });
        }

        console.log('\n' + chalk.bold('QA Score:'));
        qaScore.breakdown.forEach((d) => {
          const bar = '█'.repeat(Math.round(d.score / 10)) + chalk.gray('░'.repeat(10 - Math.round(d.score / 10)));
          console.log(`  ${d.dimension.padEnd(20)} ${String(d.score).padStart(3)}  ${bar}`);
        });
        console.log(`\n  ${chalk[gradeColor].bold(`Total: ${qaScore.total}/100  —  ${qaScore.grade}`)}`);

        if (result.debugResult) {
          console.log(chalk.gray(`\n  Debug loops: ${result.debugResult.loopCount}, patches applied: ${result.debugResult.patchesApplied.length}`));
        }

        console.log(`\n  ${chalk.gray('Report:')} ${reportPaths.md}`);
        console.log(`  ${chalk.gray('JSON:')}   ${reportPaths.json}\n`);

        if (qaScore.grade === 'FAIL') process.exit(1);
      } catch (err) {
        spinner.fail(chalk.red('QA failed'));
        die(err.message);
      }
    });

  // ── build ─────────────────────────────────────────────────────────────────
  program
    .command('build [path]')
    .description('Run the project build command and report errors')
    .option('--project <path>', 'Path to target project')
    .option('--command <cmd>', 'Override build command')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      if (!isWorkspaceInitialized(targetDir)) die('Workspace not initialized. Run: local-agent init');

      const { runBuild }  = await import('../local-agent/qa/BuildRunner.js');
      const { loadConfig } = await import('../local-agent/core/config.js');
      const config = loadConfig(targetDir);

      const spinner = ora('Running build...').start();
      const result  = await runBuild(targetDir, config, { command: opts.command });
      spinner[result.success ? 'succeed' : 'fail'](
        result.success ? chalk.green(`Build passed (${formatMs(result.durationMs)})`)
                       : chalk.red(`Build failed (${formatMs(result.durationMs)})`)
      );
      console.log(chalk.gray(`  Command: ${result.command}`));

      if (!result.success && result.errors.length) {
        console.log('\n' + chalk.bold('Errors:'));
        result.errors.forEach((e) => {
          console.log(`  ${chalk.red('›')} [${e.errorType}] ${e.message}`);
          if (e.file) console.log(`    ${chalk.gray(`${e.file}:${e.line ?? '?'}`)}`);
        });
      }
      if (result.stdout) console.log('\n' + chalk.gray(result.stdout.slice(0, 500)));
      if (!result.success) process.exit(1);
    });

  // ── test ──────────────────────────────────────────────────────────────────
  program
    .command('test [path]')
    .description('Run the project test suite and report results')
    .option('--project <path>', 'Path to target project')
    .option('--command <cmd>', 'Override test command')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      if (!isWorkspaceInitialized(targetDir)) die('Workspace not initialized. Run: local-agent init');

      const { runTests }  = await import('../local-agent/qa/TestRunner.js');
      const { loadConfig } = await import('../local-agent/core/config.js');
      const config = loadConfig(targetDir);

      const spinner = ora('Running tests...').start();
      const result  = await runTests(targetDir, config, { command: opts.command });
      spinner[result.success ? 'succeed' : 'fail'](
        result.success ? chalk.green(`Tests passed (${formatMs(result.durationMs)})`)
                       : chalk.red(`Tests failed (${formatMs(result.durationMs)})`)
      );

      if (result.summary) {
        console.log(`  ${chalk.gray('Passed:')} ${chalk.green(result.summary.passed)}  ` +
                    `${chalk.gray('Failed:')} ${chalk.red(result.summary.failed)}  ` +
                    `${chalk.gray('Total:')} ${result.summary.total}`);
      }
      if (!result.success && result.errors.length) {
        console.log('\n' + chalk.bold('Failures:'));
        result.errors.forEach((e) => {
          console.log(`  ${chalk.red('›')} ${e.testName ?? e.message}`);
        });
      }
      if (!result.success) process.exit(1);
    });

  // ── diagnose ──────────────────────────────────────────────────────────────
  program
    .command('diagnose <logfile>')
    .description('Parse and diagnose a local build/test log file')
    .action(async (logfile) => {
      printBanner();
      const logPath = resolve(logfile);
      if (!existsSync(logPath)) die(`Log file not found: ${logPath}`);

      const { parseLogFile }         = await import('../local-agent/qa/ErrorParser.js');
      const { classifyFailures }     = await import('../local-agent/qa/FailureClassifier.js');
      const { readFileSync }         = await import('fs');

      const content = readFileSync(logPath, 'utf8');
      const errors  = parseLogFile(content, logPath);
      const classification = classifyFailures(errors);

      console.log(chalk.bold(`Diagnosing: ${logPath}`));
      console.log(chalk.gray(`  ${content.split('\n').length} lines, ${errors.length} error(s) parsed\n`));

      if (!classification.hasFailures) {
        console.log(chalk.green('✓ No errors detected in log file.\n'));
        return;
      }

      console.log(chalk.bold('Error Summary:'));
      classification.summary.forEach((s) => {
        const riskColor = s.risk > 0.6 ? 'red' : s.risk > 0.3 ? 'yellow' : 'gray';
        console.log(`\n  ${chalk.bold(s.type)} (${s.count} occurrence${s.count > 1 ? 's' : ''})`);
        console.log(`    ${chalk.gray('Risk:')}   ${chalk[riskColor](s.risk.toFixed(2))}`);
        console.log(`    ${chalk.gray('Cause:')}  ${s.probableCause}`);
        if (s.files.length) console.log(`    ${chalk.gray('Files:')}  ${s.files.join(', ')}`);
        s.examples.forEach((ex) => {
          console.log(`    ${chalk.red('›')} ${ex.slice(0, 100)}`);
        });
      });

      console.log(`\n  ${chalk.bold('Dominant failure:')} ${classification.dominant}`);
      console.log(`  ${chalk.bold('Overall risk:')}     ${classification.riskScore.toFixed(2)}`);
      const safeToFix = classification.riskScore <= 0.75 &&
        !['AUTH_ERROR','DATABASE_ERROR','DEPLOYMENT_ERROR'].some((t) => classification.groups[t]?.length);
      console.log(`  ${chalk.bold('Safe to auto-fix:')} ${safeToFix ? chalk.green('yes') : chalk.red('no')}\n`);
    });

  // ── report (Phase 5) ─────────────────────────────────────────────────────
  program
    .command('report [path]')
    .description('Show last QA report for a project')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const reportsDir = join(targetDir, '.local-agent', 'reports');

      if (!existsSync(reportsDir)) {
        console.log(chalk.yellow('No reports yet. Run: local-agent qa\n'));
        return;
      }

      const { readdirSync, readFileSync } = await import('fs');
      const reports = readdirSync(reportsDir)
        .filter((f) => f.startsWith('qa-report-') && f.endsWith('.json'))
        .sort().reverse();

      if (!reports.length) {
        console.log(chalk.yellow('No QA reports yet. Run: local-agent qa\n'));
        return;
      }

      const latest = JSON.parse(readFileSync(join(reportsDir, reports[0]), 'utf8'));
      const gradeColor = latest.qaScore?.grade === 'PASS' ? 'green' :
                         latest.qaScore?.grade === 'WARNING' ? 'yellow' : 'red';

      console.log(chalk.bold('Latest QA Report:'));
      console.log(`  ${chalk.gray('Project:')}  ${latest.projectName}`);
      console.log(`  ${chalk.gray('Generated:')} ${formatDate(latest.generatedAt)}`);
      console.log(`  ${chalk.gray('Build:')}    ${latest.buildSuccess ? chalk.green('PASS') : chalk.red('FAIL')}`);
      console.log(`  ${chalk.gray('Tests:')}    ${latest.testSuccess  ? chalk.green('PASS') : chalk.red('FAIL')}`);
      console.log(`  ${chalk.gray('Errors:')}   ${latest.totalErrors}`);
      console.log(`  ${chalk.gray('Patches:')}  ${latest.patchesApplied}`);
      console.log(`  ${chalk[gradeColor].bold(`  Score: ${latest.qaScore?.total}/100  —  ${latest.qaScore?.grade}`)}`);
      console.log(`\n  ${chalk.gray('All reports:')} ${reportsDir}\n`);
    });

  // ── ui ────────────────────────────────────────────────────────────────────
  program
    .command('ui [path]')
    .description('Start the local dashboard UI at http://127.0.0.1:4001')
    .option('--project <path>', 'Path to target project')
    .option('--port <number>',  'Backend port (default: 4001)', '4001')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const port      = parseInt(opts.port, 10) || 4001;

      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);

      const serverPath = join(__dirname, '../local-agent/ui/backend/server.js');
      if (!existsSync(serverPath)) {
        console.log(chalk.yellow('⚠  UI backend not found at local-agent/ui/backend/server.js'));
        console.log(chalk.gray('   Run the Phase 5 setup to install the UI.\n'));
        return;
      }

      // Set env vars and spawn backend
      const { spawn } = await import('child_process');
      const server = spawn(process.execPath, [serverPath], {
        env: {
          ...process.env,
          LOCAL_AGENT_PROJECT: targetDir,
          LOCAL_AGENT_PORT: String(port),
        },
        stdio: 'inherit',
      });

      const url = `http://127.0.0.1:${port}`;
      console.log(chalk.bold.green(`\n  ✓ Local Agent UI starting...`));
      console.log(`  ${chalk.gray('URL:')}     ${chalk.cyan(url)}`);
      console.log(`  ${chalk.gray('Project:')} ${targetDir}`);
      console.log(`  ${chalk.gray('API:')}     ${url}/health`);
      console.log(chalk.gray('\n  Press Ctrl+C to stop.\n'));

      server.on('error', (err) => die('Failed to start UI server: ' + err.message));
    });

  // ── memory (Phase 6) ─────────────────────────────────────────────────────
  const memoryCmd = new Command('memory').description('Manage local project memory and learning history');

  memoryCmd
    .command('status [path]')
    .description('Show memory status and statistics')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      const mem = (await import('../local-agent/memory/ProjectMemoryManager.js')).default;
      const status = mem.getStatus(targetDir);
      console.log(chalk.bold('Memory Status:'));
      console.log(`  ${chalk.gray('Initialized:')}      ${status.initialized ? chalk.green('yes') : chalk.red('no')}`);
      console.log(`  ${chalk.gray('Profile:')}          ${status.profileExists ? chalk.green('exists') : chalk.yellow('none')}`);
      console.log(`  ${chalk.gray('Known issues:')}     ${status.knownIssues}`);
      console.log(`  ${chalk.gray('Successful fixes:')} ${status.successfulFixes}`);
      console.log(`  ${chalk.gray('Failed fixes:')}     ${status.failedFixes}`);
      console.log(`  ${chalk.gray('Approvals:')}        ${status.approvals}`);
      console.log(`  ${chalk.gray('QA history:')}       ${status.qaHistory}`);
      if (status.lastScan) console.log(`  ${chalk.gray('Last scan:')}        ${formatDate(status.lastScan)}`);
      if (status.lastQA)   console.log(`  ${chalk.gray('Last QA:')}          ${formatDate(status.lastQA)}`);
      console.log();
    });

  memoryCmd
    .command('show [path]')
    .description('Show stored memory contents')
    .option('--project <path>', 'Path to target project')
    .option('--section <name>', 'Section to show: profile|issues|fixes|approvals|qa')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      const mem                        = (await import('../local-agent/memory/ProjectMemoryManager.js')).default;
      const { getSuccessfulFixes,
              getFailedFixes }          = await import('../local-agent/memory/FixHistoryStore.js');
      const { getKnownPatterns }        = await import('../local-agent/memory/FailurePatternStore.js');
      const { getHistory: getApprovals,
              getApprovalRate }         = await import('../local-agent/memory/ApprovalHistoryStore.js');
      const section = opts.section ?? 'all';

      if (section === 'all' || section === 'profile') {
        const profile = mem.loadProjectProfile(targetDir);
        console.log(chalk.bold('Project Profile:'));
        if (!Object.keys(profile).length) {
          console.log(chalk.gray('  No profile yet. Run: local-agent scan\n'));
        } else {
          Object.entries(profile).forEach(([k, v]) => {
            if (v != null && k !== 'updatedAt')
              console.log(`  ${chalk.gray(k.padEnd(22))} ${typeof v === 'object' ? JSON.stringify(v) : v}`);
          });
          console.log();
        }
      }

      if (section === 'all' || section === 'issues') {
        const patterns = getKnownPatterns(targetDir);
        console.log(chalk.bold(`Known Issues (${patterns.length}):`));
        if (!patterns.length) { console.log(chalk.gray('  None yet.\n')); }
        else {
          patterns.slice(0, 10).forEach((p) =>
            console.log(`  ${chalk.cyan(p.errorType.padEnd(20))} ${chalk.gray((p.errorText ?? '').slice(0, 60))}  ` +
                        `(${chalk.green(p.successCount + '✓')} ${chalk.red(p.failureCount + '✗')})`)
          );
          if (patterns.length > 10) console.log(chalk.gray(`  ... and ${patterns.length - 10} more`));
          console.log();
        }
      }

      if (section === 'all' || section === 'fixes') {
        const successes = getSuccessfulFixes(targetDir);
        const failures  = getFailedFixes(targetDir);
        console.log(chalk.bold(`Fix History: ${chalk.green(successes.length + ' success')} / ${chalk.red(failures.length + ' failed')}`));
        successes.slice(0, 5).forEach((f) =>
          console.log(`  ${chalk.green('✓')} ${(f.task ?? '—').slice(0, 55)}  ${chalk.gray(formatDate(f.createdAt))}`)
        );
        failures.slice(0, 5).forEach((f) =>
          console.log(`  ${chalk.red('✗')} ${(f.task ?? '—').slice(0, 55)}  ${chalk.gray((f.reason ?? '').slice(0, 40))}`)
        );
        if (!successes.length && !failures.length) console.log(chalk.gray('  No fix attempts yet.'));
        console.log();
      }

      if (section === 'all' || section === 'approvals') {
        const rate = getApprovalRate(targetDir);
        console.log(chalk.bold(`Approval History: ${chalk.green(rate.approved + ' approved')} / ${chalk.red(rate.rejected + ' rejected')} (${Math.round(rate.rate * 100)}% rate)`));
        const history = getApprovals(targetDir);
        history.slice(0, 5).forEach((h) =>
          console.log(`  ${h.decision === 'approved' ? chalk.green('✓') : chalk.red('✗')} ${(h.task ?? '—').slice(0, 55)}  ${chalk.gray('risk:' + h.riskLevel)}`)
        );
        console.log();
      }
    });

  memoryCmd
    .command('clear [path]')
    .description('Clear all stored memory for a project')
    .option('--project <path>', 'Path to target project')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      if (!opts.yes) {
        console.log(chalk.yellow(`⚠  This will delete all memory for: ${targetDir}`));
        console.log(chalk.gray('   Pass --yes to confirm.\n'));
        return;
      }
      const mem = (await import('../local-agent/memory/ProjectMemoryManager.js')).default;
      mem.clearAll(targetDir);
      console.log(chalk.green('✓ Memory cleared.\n'));
    });

  memoryCmd
    .command('export [path]')
    .description('Export sanitized memory to a JSON file')
    .option('--project <path>', 'Path to target project')
    .option('--output <file>',  'Output file path', 'memory-export.json')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir  = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      const outputPath = resolve(opts.output);
      const mem = (await import('../local-agent/memory/ProjectMemoryManager.js')).default;
      mem.exportMemory(targetDir, outputPath);
      console.log(chalk.green(`✓ Memory exported to: ${outputPath}\n`));
    });

  memoryCmd
    .command('import <file> [path]')
    .description('Import memory from an exported JSON file')
    .option('--project <path>', 'Path to target project')
    .action(async (file, pathArg, opts) => {
      printBanner();
      const targetDir  = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      const importPath = resolve(file);
      if (!existsSync(importPath)) die(`Import file not found: ${importPath}`);
      const mem = (await import('../local-agent/memory/ProjectMemoryManager.js')).default;
      mem.importMemory(targetDir, importPath);
      console.log(chalk.green(`✓ Memory imported from: ${importPath}\n`));
    });

  memoryCmd
    .command('sanitize [path]')
    .description('Scan and remove any secrets from stored memory')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      const spinner = ora('Sanitizing memory...').start();
      const mem = (await import('../local-agent/memory/ProjectMemoryManager.js')).default;
      mem.sanitizeMemory(targetDir);
      spinner.succeed(chalk.green('Memory sanitized — all secret patterns removed from stored memory.'));
      console.log();
    });

  program.addCommand(memoryCmd);

  // ── security (Phase 7) ───────────────────────────────────────────────────
  const securityCmd = new Command('security').description('Security hardening and offline verification tools');

  securityCmd
    .command('check [path]')
    .description('Run all security checks and generate a security report')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      const config = loadConfig(targetDir);
      const spinner = ora('Running security checks...').start();
      try {
        const { generateOfflineStatus }    = await import('../local-agent/security/OfflineGuard.js');
        const { scanDirectory }             = await import('../local-agent/security/SecretScanner.js');
        const { getRecentEvents }           = await import('../local-agent/security/AuditLogger.js');
        const { generateReport }            = await import('../local-agent/security/SecurityReporter.js');
        const offlineStatus  = generateOfflineStatus(targetDir, config);
        const secretScan     = scanDirectory(targetDir);
        const auditEvents    = getRecentEvents(targetDir, 100);
        const policyReport   = runPolicyChecks(targetDir, config);
        spinner.stop();

        const findings = {
          offlineStatus,
          secretFindings:    secretScan.findings,
          auditEvents,
          policyChecks:      policyReport.checks,
          sandboxViolations: auditEvents.filter((e) => e.level === 'VIOLATION'),
        };
        const { mdPath, jsonPath, summary } = generateReport(targetDir, findings);

        console.log(chalk.bold('Security Check:'));
        console.log(`  ${chalk.gray('Offline:')}     ${offlineStatus.offline ? chalk.green('yes') : chalk.red('NO — VIOLATION')}`);
        console.log(`  ${chalk.gray('LLM local:')}   ${offlineStatus.llmLocal ? chalk.green('yes') : chalk.red('NO')}`);
        console.log(`  ${chalk.gray('Telemetry:')}   ${offlineStatus.telemetryDisabled ? chalk.green('off') : chalk.red('ON — VIOLATION')}`);
        console.log(`  ${chalk.gray('Secrets:')}     ${secretScan.findings.length > 0 ? chalk.red(secretScan.findings.length + ' found') : chalk.green('none')}`);
        console.log(`  ${chalk.gray('Violations:')}  ${findings.sandboxViolations.length > 0 ? chalk.red(findings.sandboxViolations.length) : chalk.green('none')}`);
        console.log(`  ${chalk.gray('Policy:')}      ${policyReport.result === 'PASS' ? chalk.green('PASS') : policyReport.result === 'WARNING' ? chalk.yellow('WARNING') : chalk.red('FAIL')}`);
        const rc = summary.result;
        const rcCol = rc === 'PASS' ? 'green' : rc === 'WARNING' ? 'yellow' : 'red';
        console.log(`\n  ${chalk[rcCol].bold(`Overall: ${rc}`)}`);
        console.log(`  ${chalk.gray('Report:')} ${mdPath}`);
        console.log(`  ${chalk.gray('JSON:')}   ${jsonPath}\n`);
      } catch (err) {
        spinner.fail(chalk.red('Security check failed'));
        die(err.message);
      }
    });

  securityCmd
    .command('scan-secrets [path]')
    .description('Scan project files for hardcoded secrets')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      const spinner = ora('Scanning for secrets...').start();
      const { scanDirectory } = await import('../local-agent/security/SecretScanner.js');
      const result = scanDirectory(targetDir);
      spinner.stop();
      console.log(chalk.bold(`Secret Scan: ${result.filesScanned} files scanned\n`));
      if (result.findings.length === 0) {
        console.log(chalk.green('  ✓ No secrets detected.\n'));
      } else {
        console.log(chalk.red(`  ⚠  ${result.findings.length} potential secret(s) detected:\n`));
        result.findings.forEach((f) => {
          const col = f.severity === 'HIGH' ? 'red' : 'yellow';
          console.log(`  ${chalk[col]('›')} ${chalk.bold(f.name)}  ${chalk.gray((f.label ?? '') + ':' + (f.line ?? '?'))}`);
        });
        console.log();
      }
    });

  securityCmd
    .command('audit [path]')
    .description('Show recent security audit log events')
    .option('--project <path>', 'Path to target project')
    .option('--count <n>', 'Number of events to show', '50')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      const { getRecentEvents } = await import('../local-agent/security/AuditLogger.js');
      const events = getRecentEvents(targetDir, parseInt(opts.count, 10) || 50);
      console.log(chalk.bold(`Security Audit Log (${events.length} events):\n`));
      if (!events.length) {
        console.log(chalk.gray('  No audit events recorded.\n'));
      } else {
        events.forEach((e) => {
          const col = e.level === 'VIOLATION' ? 'red' : e.level === 'BLOCKED' ? 'yellow' : 'gray';
          const detail = typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail);
          console.log(`  ${chalk[col](e.level.padEnd(10))} ${chalk.gray(new Date(e.ts).toLocaleTimeString())}  ${e.event}  ${detail}`);
        });
        console.log();
      }
    });

  securityCmd
    .command('network-test')
    .description('Verify external network access is blocked per offline policy')
    .action(async () => {
      printBanner();
      const { isLocalUrl } = await import('../local-agent/security/OfflineGuard.js');
      const tests = [
        { url: 'http://localhost:11434',       expectAllowed: true  },
        { url: 'http://127.0.0.1:4001',        expectAllowed: true  },
        { url: 'http://0.0.0.0:8080',          expectAllowed: true  },
        { url: 'https://api.openai.com',        expectAllowed: false },
        { url: 'https://api.anthropic.com',     expectAllowed: false },
        { url: 'https://github.com',            expectAllowed: false },
        { url: 'https://registry.npmjs.org',    expectAllowed: false },
        { url: 'https://googleapis.com',        expectAllowed: false },
      ];
      console.log(chalk.bold('Network Policy Test:\n'));
      let allPass = true;
      for (const { url, expectAllowed } of tests) {
        const isLocal = isLocalUrl(url);
        const correct = isLocal === expectAllowed;
        if (!correct) allPass = false;
        const status = correct
          ? (isLocal ? chalk.green('✓ ALLOWED') : chalk.green('✓ BLOCKED'))
          : chalk.red('✗ POLICY MISMATCH');
        console.log(`  ${status}  ${url}`);
      }
      console.log();
      if (allPass) {
        console.log(chalk.green('✓ All network policy checks passed.\n'));
      } else {
        console.log(chalk.red('✗ Network policy violations detected.\n'));
        process.exit(1);
      }
    });

  program.addCommand(securityCmd);

  // ── projects (Phase 8) ───────────────────────────────────────────────────
  const projectsCmd = new Command('projects').description('Manage multiple local projects in the global registry');

  projectsCmd
    .command('add <path>')
    .description('Register a project directory in the local registry')
    .option('--name <name>', 'Project display name (defaults to directory name)')
    .action(async (pathArg, opts) => {
      printBanner();
      const projectRoot = resolve(pathArg);
      if (!existsSync(projectRoot)) die(`Directory does not exist: ${projectRoot}`);
      const { addProject } = await import('../local-agent/orchestrator/ProjectRegistry.js');
      try {
        const profile = addProject(projectRoot, opts.name);
        console.log(chalk.green(`✓ Project registered: ${profile.name}`));
        console.log(`  ${chalk.gray('ID:')}   ${profile.projectId}`);
        console.log(`  ${chalk.gray('Root:')} ${profile.root}\n`);
      } catch (err) {
        die(err.message);
      }
    });

  projectsCmd
    .command('list')
    .description('List all registered projects')
    .action(async () => {
      printBanner();
      const { listProjects } = await import('../local-agent/orchestrator/ProjectRegistry.js');
      const { getSelected }  = await import('../local-agent/orchestrator/ProjectSelector.js');
      const projects = listProjects();
      const selected = getSelected();
      if (!projects.length) {
        console.log(chalk.yellow('No projects registered. Run: local-agent projects add <path>\n'));
        return;
      }
      console.log(chalk.bold(`Registered Projects (${projects.length}):\n`));
      for (const p of projects) {
        const isSel    = selected?.projectId === p.projectId;
        const scol     = p.status === 'healthy' ? 'green' : p.status === 'warning' ? 'yellow' : p.status === 'fail' ? 'red' : 'gray';
        const marker   = isSel ? chalk.cyan(' ◀ active') : '';
        console.log(`  ${chalk.bold(p.name)}${marker}  ${chalk[scol]('[' + p.status + ']')}`);
        console.log(`    ${chalk.gray('ID:')}        ${p.projectId}`);
        console.log(`    ${chalk.gray('Root:')}      ${p.root}`);
        console.log(`    ${chalk.gray('Framework:')} ${p.framework ?? '—'}   ${chalk.gray('Score:')} ${p.lastScore ?? '—'}`);
        console.log(`    ${chalk.gray('Last scan:')} ${formatDate(p.lastScan)}   ${chalk.gray('Last QA:')} ${formatDate(p.lastQA)}`);
        console.log();
      }
    });

  projectsCmd
    .command('select <project-id>')
    .description('Set the active project for subsequent agent commands')
    .action(async (projectId) => {
      printBanner();
      const { getProject }    = await import('../local-agent/orchestrator/ProjectRegistry.js');
      const { selectProject } = await import('../local-agent/orchestrator/ProjectSelector.js');
      const project = getProject(projectId);
      if (!project) die(`Project not found: ${projectId}`);
      selectProject(projectId);
      console.log(chalk.green(`✓ Active project set: ${project.name}`));
      console.log(`  ${chalk.gray('Root:')} ${project.root}\n`);
    });

  projectsCmd
    .command('remove <project-id>')
    .description('Remove a project from the registry (does not delete project files)')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (projectId, opts) => {
      printBanner();
      const { getProject, removeProject } = await import('../local-agent/orchestrator/ProjectRegistry.js');
      const project = getProject(projectId);
      if (!project) die(`Project not found: ${projectId}`);
      if (!opts.yes) {
        console.log(chalk.yellow(`⚠  Remove "${project.name}" from registry? (pass --yes to confirm)\n`));
        return;
      }
      removeProject(projectId);
      console.log(chalk.green(`✓ Project removed: ${project.name}\n`));
    });

  projectsCmd
    .command('scan-all')
    .description('Refresh scan data for all registered projects')
    .action(async () => {
      printBanner();
      const { listProjects }       = await import('../local-agent/orchestrator/ProjectRegistry.js');
      const { scanAll,
              getAggregatedStats } = await import('../local-agent/orchestrator/MultiProjectScanner.js');
      const projects = listProjects();
      if (!projects.length) { console.log(chalk.yellow('No projects registered.\n')); return; }
      const spinner = ora(`Scanning ${projects.length} project(s)...`).start();
      const results = await scanAll(projects);
      spinner.stop();
      const stats = getAggregatedStats(results);
      console.log(chalk.bold(`Scan-all complete (${projects.length} projects):\n`));
      results.forEach((r) => {
        const icon = r.error ? chalk.red('✗') : chalk.green('✓');
        console.log(`  ${icon} ${chalk.bold(r.name ?? r.projectId)}  ${chalk.gray(r.root)}`);
        if (r.error) console.log(`    ${chalk.red(r.error)}`);
      });
      console.log(`\n  ${chalk.gray('Total files:')}   ${stats.totalFiles}`);
      console.log(`  ${chalk.gray('Total secrets:')} ${stats.totalSecrets > 0 ? chalk.red(stats.totalSecrets) : chalk.green(stats.totalSecrets)}`);
      console.log(`  ${chalk.gray('Total TODOs:')}   ${stats.totalTodos}\n`);
    });

  projectsCmd
    .command('health')
    .description('Show health status for all registered projects')
    .action(async () => {
      printBanner();
      const { listProjects }                    = await import('../local-agent/orchestrator/ProjectRegistry.js');
      const { checkHealthAll, generateHealthSummary } = await import('../local-agent/orchestrator/ProjectHealthMonitor.js');
      const projects = listProjects();
      if (!projects.length) { console.log(chalk.yellow('No projects registered.\n')); return; }
      const withHealth = checkHealthAll(projects);
      const summary    = generateHealthSummary(withHealth);
      console.log(chalk.bold(`Project Health (${projects.length} total):\n`));
      withHealth.forEach((r) => {
        const col = r.healthStatus === 'healthy' ? 'green' : r.healthStatus === 'warning' ? 'yellow' :
                    r.healthStatus === 'fail' ? 'red' : 'gray';
        console.log(`  ${chalk[col]('●')} ${chalk.bold(r.name.padEnd(30))} ${chalk[col](r.healthStatus.toUpperCase())}`);
        if (r.healthDetails?.qaGrade) console.log(`    ${chalk.gray('QA:')} ${r.healthDetails.qaGrade}  ${chalk.gray('Score:')} ${r.healthDetails.qaScore ?? '—'}`);
        if (r.healthDetails?.secretCount > 0) console.log(`    ${chalk.red('⚠ Secrets detected: ' + r.healthDetails.secretCount)}`);
      });
      console.log(`\n  ${chalk.green(summary.healthy + ' healthy')}  ` +
                  `${chalk.yellow(summary.warning + ' warning')}  ` +
                  `${chalk.red(summary.fail + ' fail')}  ` +
                  `${chalk.gray(summary.unknown + ' unknown')}\n`);
    });

  program.addCommand(projectsCmd);

  // ── models (Phase 9) ─────────────────────────────────────────────────────
  const modelsCmd = new Command('models').description('Manage local LLM models');

  modelsCmd
    .command('list [path]')
    .description('List all available local models across providers')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const config    = loadConfig(targetDir);
      const mm        = (await import('../local-agent/models/ModelManager.js')).default;
      const spinner   = ora('Detecting local LLM providers...').start();
      try {
        const { providers, totalModels } = await mm.listModels(config);
        spinner.stop();
        console.log(chalk.bold(`Local Models (${totalModels} total):\n`));
        for (const p of providers) {
          const icon = p.available ? chalk.green('●') : chalk.gray('○');
          console.log(`  ${icon} ${chalk.bold(p.name.padEnd(12))} ${p.available ? chalk.green('online') : chalk.gray('offline')}  ${p.baseUrl}`);
          if (p.available && p.models.length) {
            for (const m of p.models.slice(0, 10)) {
              const info = m.info ?? {};
              console.log(`    ${chalk.gray('›')} ${m.name}  ${chalk.gray(`ctx:${info.contextWindow ?? '?'}  ram:${info.ramEstimateGB ?? '?'}GB  code:${info.codingScore ?? '?'}/10`)}`);
            }
          } else if (!p.available) {
            console.log(chalk.gray(`    (offline — start ${p.name} to use models)`));
          }
          console.log();
        }
        if (!totalModels) console.log(chalk.yellow('No models detected. Start Ollama, LM Studio, or llama.cpp.\n'));
      } catch (err) {
        spinner.fail(chalk.red('Model detection failed'));
        die(err.message);
      }
    });

  modelsCmd
    .command('status [path]')
    .description('Show the currently active model status')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const config    = loadConfig(targetDir);
      const mm        = (await import('../local-agent/models/ModelManager.js')).default;
      const spinner   = ora('Checking model status...').start();
      try {
        const status = await mm.getStatus(config);
        spinner.stop();
        console.log(chalk.bold('Active Model:'));
        console.log(`  ${chalk.gray('Provider:')}     ${status.activeProvider ?? '—'}`);
        console.log(`  ${chalk.gray('Model:')}        ${status.activeModel ?? '—'}`);
        console.log(`  ${chalk.gray('Available:')}    ${status.available ? chalk.green('yes') : chalk.red('no')}`);
        if (status.contextWindow) console.log(`  ${chalk.gray('Context:')}      ${status.contextWindow.toLocaleString()} tokens`);
        if (status.ramEstimate)   console.log(`  ${chalk.gray('RAM estimate:')} ${status.ramEstimate}`);
        if (status.codingScore)   console.log(`  ${chalk.gray('Coding score:')} ${status.codingScore}/10`);
        if (status.fallback)      console.log(`  ${chalk.gray('Fallback:')}     ${status.fallback}`);
        console.log();
      } catch (err) {
        spinner.fail(chalk.red('Status check failed'));
        die(err.message);
      }
    });

  modelsCmd
    .command('select <model-name> [path]')
    .description('Set the active model in project config')
    .option('--project <path>', 'Path to target project')
    .action(async (modelName, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      const mm = (await import('../local-agent/models/ModelManager.js')).default;
      mm.selectModel(modelName, targetDir);
      console.log(chalk.green(`✓ Active model set to: ${modelName}`));
      console.log(chalk.gray('  Config updated in .local-agent/config.json\n'));
    });

  modelsCmd
    .command('test [path]')
    .description('Send a test prompt to verify the active model responds')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const config    = loadConfig(targetDir);
      const mm        = (await import('../local-agent/models/ModelManager.js')).default;
      const spinner   = ora('Testing model...').start();
      try {
        const result = await mm.testModel(config);
        spinner[result.success ? 'succeed' : 'fail'](
          result.success ? chalk.green(`Model responded in ${result.latencyMs}ms`) : chalk.red('Model test failed')
        );
        if (result.response) console.log(chalk.gray('\n  Response preview:\n  ' + result.response.slice(0, 200) + '\n'));
        if (result.error)    console.log(chalk.red('  Error: ' + result.error + '\n'));
      } catch (err) {
        spinner.fail(chalk.red('Test failed'));
        die(err.message);
      }
    });

  modelsCmd
    .command('benchmark [path]')
    .description('Benchmark all available models and save results')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const config    = loadConfig(targetDir);
      const mm        = (await import('../local-agent/models/ModelManager.js')).default;
      const spinner   = ora('Benchmarking models (this may take a while)...').start();
      try {
        const results = await mm.benchmarkModels(config);
        spinner.stop();
        if (!results?.length) { console.log(chalk.yellow('No models available to benchmark.\n')); return; }
        console.log(chalk.bold(`Benchmark Results (${results.length} models):\n`));
        results.forEach((r) => {
          const tps = r.tokensPerSec ? `${r.tokensPerSec.toFixed(1)} tok/s` : 'timeout';
          console.log(`  ${chalk.bold(r.model?.padEnd(30))} ${chalk.gray('lat:')} ${(r.latencyMs ?? 0).toFixed(0)}ms  ${chalk.gray('speed:')} ${tps}`);
        });
        console.log(chalk.gray(`\n  Results saved to .local-agent/model-benchmarks.json\n`));
      } catch (err) {
        spinner.fail(chalk.red('Benchmark failed'));
        die(err.message);
      }
    });

  program.addCommand(modelsCmd);

  // ── coding-db (Phase 10) ──────────────────────────────────────────────────
  const codingDbCmd = new Command('coding-db').description('Local coding knowledge database');

  codingDbCmd
    .command('status [path]')
    .description('Show coding knowledge DB status')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { getStatus } = await import('../local-agent/coding-db/CodingDBManager.js');
      const status = await getStatus(targetDir);
      console.log(chalk.bold('Coding DB Status:'));
      console.log(`  ${chalk.gray('Local SQLite DB:')}   ${status.localDb ? chalk.green('exists') : chalk.yellow('not yet created')}`);
      console.log(`  ${chalk.gray('Remote service:')}    ${status.remoteService ? chalk.green('online at ' + status.url) : chalk.gray('offline')}`);
      console.log(`  ${chalk.gray('Recipes stored:')}    ${status.recipeCount ?? 0}`);
      console.log(`  ${chalk.gray('DB path:')}           ${status.dbPath}`);
      if (!status.localDb) console.log(chalk.gray('\n  Run: local-agent coding-db sync-local  to initialize.\n'));
      console.log();
    });

  codingDbCmd
    .command('search <query> [path]')
    .description('Search for fix recipes matching an error description')
    .option('--project <path>', 'Path to target project')
    .action(async (query, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { search } = await import('../local-agent/coding-db/CodingDBManager.js');
      const spinner = ora('Searching...').start();
      const { results, source, warning } = await search(query, targetDir);
      spinner.stop();
      if (warning) console.log(chalk.yellow(`⚠  ${warning}\n`));
      console.log(chalk.bold(`Recipes (${results.length} found, source: ${source}):\n`));
      if (!results.length) { console.log(chalk.gray('  No recipes found. Try: local-agent coding-db sync-local\n')); return; }
      results.forEach((r, i) => {
        console.log(`  ${chalk.bold(String(i+1) + '.')} ${chalk.cyan(r.error_pattern ?? r.errorPattern)}`);
        console.log(`     ${r.fix_description ?? r.fixDescription}`);
        if (r.fix_snippet ?? r.fixSnippet) console.log(chalk.gray('     ' + (r.fix_snippet ?? r.fixSnippet).split('\n')[0]));
        console.log();
      });
    });

  codingDbCmd
    .command('diagnose <logfile> [path]')
    .description('Parse a build/test log and look up recipes for each error')
    .option('--project <path>', 'Path to target project')
    .action(async (logfile, pathArg, opts) => {
      printBanner();
      const logPath   = resolve(logfile);
      if (!existsSync(logPath)) die(`Log file not found: ${logPath}`);
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { diagnose } = await import('../local-agent/coding-db/CodingDBManager.js');
      const spinner = ora('Diagnosing log...').start();
      const { readFileSync: rfs } = await import('fs');
      const content = rfs(logPath, 'utf8');
      const result  = await diagnose(content, targetDir);
      spinner.stop();
      console.log(chalk.bold(`Diagnosis: ${result.errors.length} error type(s), ${result.totalRecipes} recipe(s)\n`));
      result.errors.forEach(({ errorText, recipes }) => {
        console.log(`  ${chalk.red('›')} ${errorText.slice(0, 80)}`);
        if (recipes.length) {
          recipes.forEach((r) => console.log(`    ${chalk.green('→')} ${r.fix_description ?? r.fixDescription}`));
        } else {
          console.log(chalk.gray('    (no recipe found)'));
        }
        console.log();
      });
    });

  codingDbCmd
    .command('sync-local [path]')
    .description('Build/update local DB from project fix history')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      const { syncLocal } = await import('../local-agent/coding-db/CodingDBManager.js');
      const spinner = ora('Syncing local knowledge base...').start();
      const result  = syncLocal(targetDir);
      spinner.succeed(chalk.green(`Sync complete — ${result.synced} new, ${result.updated} updated, ${result.total} total recipes`));
      console.log();
    });

  program.addCommand(codingDbCmd);

  // ── context (Phase 11) ───────────────────────────────────────────────────
  const contextCmd = new Command('context').description('Advanced context engine for LLM prompts');

  contextCmd
    .command('build <task> [path]')
    .description('Build optimized context for a task and show summary')
    .option('--project <path>', 'Path to target project')
    .action(async (task, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      const config  = loadConfig(targetDir);
      const { buildContext, getContextSummary } = await import('../local-agent/context/AdvancedContextEngine.js');
      const spinner = ora('Building context...').start();
      const ctx     = await buildContext(task, targetDir, config);
      spinner.stop();
      const summary = getContextSummary(ctx);
      console.log(chalk.bold('Context Summary:'));
      console.log(`  ${chalk.gray('Files selected:')}  ${summary.fileCount}`);
      console.log(`  ${chalk.gray('Total tokens:')}    ~${summary.totalTokens}`);
      console.log(`  ${chalk.gray('Truncated:')}       ${summary.truncated ? chalk.yellow('yes') : 'no'}`);
      console.log(`  ${chalk.gray('Keywords:')}        ${ctx.keywords.join(', ')}`);
      console.log(`\n${chalk.bold('Top files:')}`);
      summary.topFiles.forEach((f) => console.log(`  ${chalk.cyan('›')} ${f}`));
      console.log();
    });

  contextCmd
    .command('explain <task> [path]')
    .description('Explain why each file was chosen for this task')
    .option('--project <path>', 'Path to target project')
    .action(async (task, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const config    = loadConfig(targetDir);
      const { buildContext, explainContext } = await import('../local-agent/context/AdvancedContextEngine.js');
      const ctx  = await buildContext(task, targetDir, config);
      const expl = explainContext(ctx);
      console.log(expl + '\n');
    });

  contextCmd
    .command('files <task> [path]')
    .description('List the files that would be included in context for a task')
    .option('--project <path>', 'Path to target project')
    .action(async (task, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const config    = loadConfig(targetDir);
      const { buildContext } = await import('../local-agent/context/AdvancedContextEngine.js');
      const ctx = await buildContext(task, targetDir, config);
      console.log(chalk.bold(`Context files (${ctx.files.length}):\n`));
      ctx.files.forEach((f) => console.log(`  ${chalk.cyan(f.relPath)}  ${chalk.gray('~' + f.tokens + ' tok')}`));
      if (ctx.truncated) console.log(chalk.yellow(`\n  + ${ctx.skippedCount} file(s) skipped (budget exhausted)`));
      console.log();
    });

  contextCmd
    .command('budget [path]')
    .description('Show current context token budget settings')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const { DEFAULT_BUDGET } = await import('../local-agent/context/ContextBudget.js');
      console.log(chalk.bold('Context Token Budget:'));
      Object.entries(DEFAULT_BUDGET).forEach(([k, v]) =>
        console.log(`  ${chalk.gray(k.padEnd(16))} ${v.toLocaleString()} tokens`)
      );
      console.log();
    });

  program.addCommand(contextCmd);

  // ── generate-test (Phase 12) ─────────────────────────────────────────────
  program
    .command('generate-test <task> [path]')
    .description('Generate a test file for a task (creates patch proposal — does NOT auto-apply)')
    .option('--project <path>', 'Path to target project')
    .action(async (task, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      if (!isWorkspaceInitialized(targetDir)) die('Workspace not initialized. Run: local-agent init');
      const config  = loadConfig(targetDir);
      const { generateTest } = await import('../local-agent/testing/TestGenerator.js');
      const spinner = ora('Generating test...').start();
      try {
        const result = await generateTest(task, targetDir, config);
        spinner.succeed(chalk.green(`Test patch created: ${result.patchId}`));
        console.log(`  ${chalk.gray('Framework:')} ${result.testFramework}`);
        console.log(`  ${chalk.gray('Target:')}    ${result.targetFile}`);
        console.log(`  ${chalk.gray('LLM used:')}  ${result.llmUsed ? 'yes' : 'no (template fallback)'}`);
        console.log(`\n  ${chalk.gray('Review:')}  local-agent show-patch ${result.patchId}`);
        console.log(`  ${chalk.gray('Apply:')}   local-agent apply ${result.patchId} --project ${opts.project ?? '.'}\n`);
      } catch (err) {
        spinner.fail(chalk.red('Test generation failed'));
        die(err.message);
      }
    });

  program
    .command('test:regression <patch-id> [path]')
    .description('Generate a regression test for an applied patch')
    .option('--project <path>', 'Path to target project')
    .action(async (patchId, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      const config = loadConfig(targetDir);
      const { generateRegressionTest } = await import('../local-agent/testing/TestGenerator.js');
      const spinner = ora('Generating regression test...').start();
      try {
        const result = await generateRegressionTest(patchId, targetDir, config);
        spinner.succeed(chalk.green(`Regression test patch: ${result.patchId}`));
        console.log(`  ${chalk.gray('Target:')} ${result.targetFile}`);
        console.log(`  local-agent show-patch ${result.patchId}\n`);
      } catch (err) {
        spinner.fail(chalk.red('Failed'));
        die(err.message);
      }
    });

  // ── release-check (Phase 13) ─────────────────────────────────────────────
  program
    .command('release-check [path]')
    .description('Check release readiness (build, tests, secrets, debug code, docs)')
    .option('--project <path>', 'Path to target project')
    .option('--deep', 'Also run build and test commands (slower)')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      if (!existsSync(targetDir)) die(`Directory does not exist: ${targetDir}`);
      const config  = loadConfig(targetDir);
      const { runAllChecks } = await import('../local-agent/release/ReleaseChecker.js');
      const { generateReport } = await import('../local-agent/release/ReleaseReporter.js');
      const spinner = ora('Running release checks...').start();
      try {
        const result = await runAllChecks(targetDir, config, { deep: opts.deep ?? false });
        spinner.stop();
        const { checks, failCount, warnCount, blockers, recommendations } = result;
        const rcCol = result.result === 'PASS' ? 'green' : result.result === 'WARNING' ? 'yellow' : 'red';

        console.log(chalk.bold('Release Readiness:\n'));
        for (const c of checks) {
          const ic = c.passed === true ? chalk.green('✓') : c.passed === false && c.severity === 'FAIL' ? chalk.red('✗') :
                     c.passed === false ? chalk.yellow('⚠') : chalk.gray('–');
          const sc = c.severity === 'FAIL' ? chalk.red('[FAIL]') : c.severity === 'WARN' ? chalk.yellow('[WARN]') : chalk.gray('[INFO]');
          console.log(`  ${ic}  ${chalk.gray(c.name.padEnd(28))} ${sc}  ${c.message}`);
          c.details.slice(0, 2).forEach((d) => console.log(`       ${chalk.gray('→')} ${d}`));
        }

        console.log(`\n  ${chalk[rcCol].bold(`Overall: ${result.result}`)}  ${chalk.gray(`(${failCount} fail, ${warnCount} warn)`)}`);

        if (blockers.length) {
          console.log('\n' + chalk.bold.red('Blockers:'));
          blockers.forEach((b) => console.log(`  ${chalk.red('✗')} ${b.name}: ${b.message}`));
        }
        if (recommendations.length) {
          console.log('\n' + chalk.bold('Recommendations:'));
          recommendations.slice(0, 5).forEach((r) => console.log(`  ${chalk.gray('›')} ${r}`));
        }

        const { mdPath, jsonPath } = generateReport(targetDir, result);
        console.log(`\n  ${chalk.gray('Report:')} ${mdPath}`);
        console.log(`  ${chalk.gray('JSON:')}   ${jsonPath}\n`);

        if (result.result === 'FAIL') process.exit(1);
      } catch (err) {
        spinner.fail(chalk.red('Release check failed'));
        die(err.message);
      }
    });

  program
    .command('release-report [path]')
    .description('Show the latest release readiness report')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { getLatestReport, listReports } = await import('../local-agent/release/ReleaseReporter.js');
      const reports = listReports(targetDir);
      if (!reports.length) {
        console.log(chalk.yellow('No release reports yet. Run: local-agent release-check\n'));
        return;
      }
      const latest = getLatestReport(targetDir);
      const rcCol  = latest.result === 'PASS' ? 'green' : latest.result === 'WARNING' ? 'yellow' : 'red';
      console.log(chalk.bold('Latest Release Report:'));
      console.log(`  ${chalk.gray('Generated:')} ${formatDate(latest.generatedAt)}`);
      console.log(`  ${chalk.gray('Project:')}   ${latest.projectName}`);
      console.log(`  ${chalk.gray('Checks:')}    ${latest.checks?.length ?? 0} total`);
      console.log(`  ${chalk[rcCol].bold(`  Result: ${latest.result}  (${latest.failCount} fail, ${latest.warnCount} warn)`)}`);
      console.log(`\n  All reports: ${latest.checks ? '' : ''}`);
      reports.slice(0, 5).forEach((r) => {
        const col = r.result === 'PASS' ? 'green' : r.result === 'WARNING' ? 'yellow' : 'red';
        console.log(`  ${chalk[col]('●')} ${r.filename.replace('.json', '')}  ${chalk.gray(r.result ?? '?')}`);
      });
      console.log();
    });

  program.parse(process.argv);

  if (process.argv.length <= 2) {
    printBanner();
    program.help();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
