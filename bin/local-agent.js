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

  memoryCmd
    .command('global-stats')
    .description('Show global memory statistics')
    .action(async () => {
      printBanner();
      const { globalMemory } = await import('../local-agent/memory/GlobalMemoryManager.js');
      const stats = globalMemory.getStats();
      console.log(chalk.bold('Global Memory Statistics:'));
      console.log(`  ${chalk.gray('Semantic concepts:')} ${stats.semanticCount}`);
      console.log(`  ${chalk.gray('Tasks tracked:')}     ${stats.taskCount}`);
      console.log(`  ${chalk.gray('Prompts recorded:')}  ${stats.promptCount}`);
      console.log(`  ${chalk.gray('Fixes recorded:')}    ${stats.fixCount}`);
      console.log(`  ${chalk.gray('Last updated:')}      ${formatDate(stats.lastUpdated)}`);
      console.log();
    });

  memoryCmd
    .command('semantic-store <key> <val>')
    .description('Store a key/value concept in global semantic memory')
    .action(async (key, val) => {
      printBanner();
      const { globalMemory } = await import('../local-agent/memory/GlobalMemoryManager.js');
      globalMemory.storeSemantic(key, val);
      console.log(chalk.green(`✓ Stored: ${chalk.cyan(key)} = ${val}\n`));
    });

  memoryCmd
    .command('semantic-search <query>')
    .description('Search global semantic memory')
    .action(async (query) => {
      printBanner();
      const { globalMemory } = await import('../local-agent/memory/GlobalMemoryManager.js');
      const results = globalMemory.searchSemantic(query);
      console.log(chalk.bold(`Semantic Search Results for "${query}" (${results.length} found):`));
      results.forEach((r) => {
        console.log(`  ${chalk.cyan(r.key)}: ${r.value}`);
      });
      console.log();
    });

  memoryCmd
    .command('tasks')
    .description('List recent tasks run by the agent')
    .action(async () => {
      printBanner();
      const { globalMemory } = await import('../local-agent/memory/GlobalMemoryManager.js');
      const tasks = globalMemory.memory.tasks;
      if (!tasks.length) {
        console.log(chalk.gray('No tasks tracked yet.\n'));
        return;
      }
      console.log(chalk.bold(`Recent Tasks (${tasks.length} tracked):`));
      tasks.slice(-20).reverse().forEach((t) => {
        const icon = t.status === 'success' ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${icon} ${chalk.gray(`[${formatDate(t.timestamp)}]`)} ${t.task}`);
      });
      console.log();
    });

  memoryCmd
    .command('prompts')
    .description('List recent prompts/responses history')
    .action(async () => {
      printBanner();
      const { globalMemory } = await import('../local-agent/memory/GlobalMemoryManager.js');
      const prompts = globalMemory.memory.prompts;
      if (!prompts.length) {
        console.log(chalk.gray('No prompt history yet.\n'));
        return;
      }
      console.log(chalk.bold(`Recent Prompt History (${prompts.length} tracked):`));
      prompts.slice(-10).reverse().forEach((p) => {
        console.log(`  ${chalk.cyan(`[${formatDate(p.timestamp)}]`)} Q: ${p.prompt.slice(0, 60)}...`);
        console.log(`    A: ${p.response.slice(0, 80).replace(/\n/g, ' ')}...`);
      });
      console.log();
    });

  memoryCmd
    .command('fixes')
    .description('List recent code fixes history')
    .action(async () => {
      printBanner();
      const { globalMemory } = await import('../local-agent/memory/GlobalMemoryManager.js');
      const fixes = globalMemory.memory.fixes;
      if (!fixes.length) {
        console.log(chalk.gray('No fixes history yet.\n'));
        return;
      }
      console.log(chalk.bold(`Recent Fixes History (${fixes.length} tracked):`));
      fixes.slice(-15).reverse().forEach((f) => {
        const icon = f.status === 'applied' ? chalk.green('✓') : f.status === 'proposed' ? chalk.blue('?') : chalk.yellow('✗');
        console.log(`  ${icon} ${chalk.bold(f.patchId)} [${f.status}] - ${f.task}`);
        console.log(`    Files: ${f.filesChanged.join(', ')}`);
      });
      console.log();
    });

  program.addCommand(memoryCmd);

  // ── indexer ──────────────────────────────────────────────────────────────
  const indexerCmd = new Command('indexer').description('Global file indexer management');
  
  indexerCmd
    .command('scan')
    .description('Run a recursive scan across /Users/liemdo/ to index repositories')
    .action(async () => {
      printBanner();
      const spinner = ora('Initializing global scan...').start();
      try {
        const { GlobalFileIndexer } = await import('../local-agent/global-indexer/GlobalFileIndexer.js');
        const indexer = new GlobalFileIndexer();
        spinner.text = 'Scanning directories... (this might take a few moments)';
        const index = await indexer.scan();
        spinner.succeed(chalk.green(`Global scan complete. Indexed ${index.projects.length} projects.`));
      } catch (err) {
        spinner.fail(chalk.red(`Scan failed: ${err.message}`));
        process.exit(1);
      }
    });

  indexerCmd
    .command('stats')
    .description('Show stats of the global file index')
    .action(async () => {
      printBanner();
      const { GlobalFileIndexer } = await import('../local-agent/global-indexer/GlobalFileIndexer.js');
      const indexer = new GlobalFileIndexer();
      const index = indexer.loadIndex();
      if (!index) {
        console.log(chalk.yellow('No global index found. Run: local-agent indexer scan\n'));
        return;
      }
      const stats = indexer.getStats();
      console.log(chalk.bold('Global Index Stats:'));
      console.log(`  ${chalk.gray('Last Scanned:')} ${formatDate(stats.lastScanned)}`);
      console.log(`  ${chalk.gray('Total Projects:')} ${stats.totalProjects}`);
      console.log(`  ${chalk.gray('Total Repos:')} ${stats.totalRepos}`);
      console.log(`  ${chalk.gray('Languages Detected:')}`);
      Object.entries(stats.languages || {}).forEach(([lang, count]) => {
        console.log(`    - ${chalk.cyan(lang)}: ${count}`);
      });
      console.log();
    });

  indexerCmd
    .command('search <query>')
    .description('Search projects in the global file index')
    .action(async (query) => {
      printBanner();
      const { GlobalFileIndexer } = await import('../local-agent/global-indexer/GlobalFileIndexer.js');
      const indexer = new GlobalFileIndexer();
      const index = indexer.loadIndex();
      if (!index) {
        console.log(chalk.yellow('No global index found. Run: local-agent indexer scan\n'));
        return;
      }
      const results = indexer.searchProjects(query);
      console.log(chalk.bold(`Search Results for "${query}" (${results.length} found):`));
      results.forEach((p) => {
        const typeIcon = p.type === 'git-repo' ? chalk.cyan('[Git]') : chalk.yellow('[Node]');
        const dupBadge = p.isDuplicate ? chalk.red(' [DUPLICATE]') : '';
        console.log(`  ${typeIcon}${dupBadge} ${chalk.bold(p.name)}`);
        console.log(`    Path:   ${p.path}`);
        if (p.remoteUrl) console.log(`    Remote: ${p.remoteUrl}`);
        if (p.description) console.log(`    Desc:   ${p.description}`);
      });
      console.log();
    });

  program.addCommand(indexerCmd);

  // ── content ──────────────────────────────────────────────────────────────
  const contentCmd = new Command('content').description('Automated content generation pipeline');

  contentCmd
    .command('generate <project-alias> <content-type>')
    .description('Generate strategy and polished marketing copy for a project')
    .option('--audience <text>', 'Override target audience')
    .option('--angle <text>', 'Marketing angle override')
    .action(async (alias, type, opts) => {
      printBanner();
      const spinner = ora(`Locating project "${alias}"...`).start();
      try {
        const { ProjectContextEngine } = await import('../local-agent/project-context/ProjectContextEngine.js');
        const contextEngine = new ProjectContextEngine();
        const context = await contextEngine.buildContext(alias);
        if (!context.found) {
          spinner.fail(chalk.red(`Project "${alias}" not found.`));
          return;
        }
        spinner.text = `Generating draft for "${type}"...`;
        const { ContentGenerator } = await import('../local-agent/content-pipeline/ContentGenerator.js');
        const generator = new ContentGenerator();
        const draft = generator.generate(context, type, {
          audience: opts.audience,
          angle: opts.angle,
        });

        spinner.text = 'Refining content with Local LLM...';
        
        // Load default config
        const { loadConfig } = await import('../local-agent/core/config.js');
        const config = loadConfig(context.resolvedPath);
        const { LocalLLMAdapter } = await import('../local-agent/llm/LocalLLMAdapter.js');
        const adapter = new LocalLLMAdapter(config);
        
        spinner.stop();
        console.log(chalk.bold.cyan('\nDrafting polished marketing copy:\n'));

        const { runAutoContentPipeline } = await import('../local-agent/project-context/AutoContextPipeline.js');
        await runAutoContentPipeline(type, alias, adapter, (token) => {
          process.stdout.write(token);
        }, config);
        
        console.log('\n');
      } catch (err) {
        spinner.stop();
        console.error(chalk.red(`Generation failed: ${err.message}`));
      }
    });

  program.addCommand(contentCmd);

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
        if (rc === 'FAIL') process.exit(1);
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

  projectsCmd
    .command('check-dupes')
    .description('Scan registry for duplicate paths, stale entries, and name conflicts')
    .option('--fix', 'Remove stale entries and deduplicate (keeps most-recently-updated per path)')
    .option('--json', 'Machine-readable JSON output (exit 1 on errors)')
    .action(async (opts) => {
      printBanner();
      const {
        loadRegistry, canonicalizePath, findDuplicates, pruneStale,
      } = await import('../local-agent/orchestrator/ProjectRegistry.js');
      const { existsSync: fsExists } = await import('fs');

      const projects = loadRegistry();
      if (!projects.length) {
        console.log(chalk.yellow('No projects registered.\n'));
        return;
      }

      const issues = [];

      // 1. Stale paths
      const stale = projects.filter((p) => !fsExists(p.root));
      for (const p of stale) {
        issues.push({ type: 'stale', severity: 'error', projectId: p.projectId, name: p.name, root: p.root,
          message: `Path does not exist: "${p.root}"` });
      }

      // 2. Duplicate realpaths
      const groups = findDuplicates();
      for (const group of groups) {
        const ids = group.map((p) => `${p.name} (${p.projectId})`).join(', ');
        for (const p of group) {
          issues.push({ type: 'duplicate', severity: 'error', projectId: p.projectId, name: p.name, root: p.root,
            message: `Same realpath as: ${ids}` });
        }
      }

      // 3. Subpath overlaps (warn)
      const isSubpath = (parent, child) => {
        const p = process.platform === 'darwin' ? parent.toLowerCase() : parent;
        const c = process.platform === 'darwin' ? child.toLowerCase()  : child;
        return c.startsWith((p.endsWith('/') ? p : p + '/'));
      };
      for (let i = 0; i < projects.length; i++) {
        for (let j = 0; j < projects.length; j++) {
          if (i === j) continue;
          const a = projects[i], b = projects[j];
          if (isSubpath(canonicalizePath(a.root), canonicalizePath(b.root))) {
            issues.push({ type: 'overlap', severity: 'warn', projectId: b.projectId, name: b.name, root: b.root,
              message: `"${b.name}" is inside "${a.name}" (${a.root})` });
          }
        }
      }

      // 4. Duplicate names (info)
      const nameMap = new Map();
      for (const p of projects) {
        const k = p.name.toLowerCase();
        if (!nameMap.has(k)) nameMap.set(k, []);
        nameMap.get(k).push(p);
      }
      for (const [, g] of nameMap) {
        if (g.length < 2) continue;
        for (const p of g) {
          issues.push({ type: 'duplicate-name', severity: 'info', projectId: p.projectId, name: p.name, root: p.root,
            message: `Name "${p.name}" used by ${g.length} entries at different paths` });
        }
      }

      const errors = issues.filter((i) => i.severity === 'error');
      const warns  = issues.filter((i) => i.severity === 'warn');
      const infos  = issues.filter((i) => i.severity === 'info');

      if (opts.json) {
        console.log(JSON.stringify({ ok: errors.length === 0, totalProjects: projects.length, issues }, null, 2));
      } else {
        console.log(chalk.bold(`Registry check — ${projects.length} projects:\n`));
        if (!issues.length) {
          console.log(chalk.green('  ✅  No issues found. Registry is clean.\n'));
        } else {
          if (errors.length) {
            console.log(chalk.red(`  ❌  Errors (${errors.length}):`));
            for (const i of errors)
              console.log(`     ${chalk.red(i.type.toUpperCase().padEnd(12))} ${chalk.bold(i.name.padEnd(28))} ${chalk.gray(i.message)}`);
            console.log();
          }
          if (warns.length) {
            console.log(chalk.yellow(`  ⚠   Warnings (${warns.length}):`));
            for (const i of warns)
              console.log(`     ${chalk.yellow(i.type.toUpperCase().padEnd(12))} ${chalk.bold(i.name.padEnd(28))} ${chalk.gray(i.message)}`);
            console.log();
          }
          if (infos.length) {
            console.log(chalk.gray(`  ℹ   Info (${infos.length}):`));
            for (const i of infos)
              console.log(`     ${chalk.gray(i.type.toUpperCase().padEnd(12))} ${chalk.bold(i.name.padEnd(28))} ${chalk.gray(i.message)}`);
            console.log();
          }
        }
      }

      if (opts.fix && errors.length > 0) {
        const { deduplicateRegistry } = await import('../local-agent/orchestrator/ProjectRegistry.js');
        const removedStale = pruneStale();
        const removedDupes = deduplicateRegistry();
        const all = [...removedStale, ...removedDupes];
        if (!opts.json) {
          console.log(chalk.bold(`  🔧  Fixed — removed ${all.length} entries:`));
          for (const p of all) console.log(`     ${chalk.red('–')} ${p.name} (${p.projectId})  ${chalk.gray(p.root)}`);
          console.log();
        }
      }

      if (errors.length > 0 && !opts.fix) process.exit(1);
    });

  projectsCmd
    .command('prune-stale')
    .description('Remove registry entries whose root path no longer exists on disk')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (opts) => {
      printBanner();
      const { pruneStale } = await import('../local-agent/orchestrator/ProjectRegistry.js');
      const { existsSync: fsExists } = await import('fs');
      const { loadRegistry } = await import('../local-agent/orchestrator/ProjectRegistry.js');

      const stale = loadRegistry().filter((p) => !fsExists(p.root));
      if (!stale.length) {
        console.log(chalk.green('✅  No stale entries found.\n'));
        return;
      }
      console.log(chalk.yellow(`Found ${stale.length} stale entry/entries:\n`));
      for (const p of stale)
        console.log(`  ${chalk.red('✗')} ${chalk.bold(p.name.padEnd(30))} ${chalk.gray(p.root)}`);
      console.log();
      if (!opts.yes) {
        console.log(chalk.yellow('Pass --yes to remove them.\n'));
        return;
      }
      const removed = pruneStale();
      console.log(chalk.green(`✓ Removed ${removed.length} stale entry/entries.\n`));
    });

  projectsCmd
    .command('repath <project-id> <new-path>')
    .description('Update the root path of a registered project (e.g. after moving a directory)')
    .action(async (projectId, newPath) => {
      printBanner();
      const { repathProject } = await import('../local-agent/orchestrator/ProjectRegistry.js');
      const { resolve: resolvePath } = await import('path');
      try {
        const updated = repathProject(projectId, resolvePath(newPath));
        console.log(chalk.green(`✓ Repathed: ${updated.name}`));
        console.log(`  ${chalk.gray('Root:')} ${updated.root}\n`);
      } catch (err) {
        die(err.message);
      }
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

  // ── heal (Phase 24 — Self-Healing Engine) ────────────────────────────────
  const healCmd = program
    .command('heal [path]')
    .description('Self-healing: diagnose and repair workspace health issues')
    .option('--project <path>', 'Path to target project')
    .option('--dry-run', 'Show what would be done without making changes');

  healCmd
    .command('status [path]')
    .description('Show workspace health status and recovery plan')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { SelfHealManager } = await import('../local-agent/self-heal/SelfHealManager.js');
      const mgr    = new SelfHealManager(targetDir);
      const { health, plan } = mgr.status();
      const urg    = plan.urgency === 'critical' ? 'red' : plan.urgency === 'warning' ? 'yellow' : 'green';
      console.log(chalk.bold('Health Status:'));
      console.log(`  ${health.healthy ? chalk.green('✓ Healthy') : chalk.red('✗ Issues found')}`);
      console.log(`  ${chalk.gray('Memory:')}     ${health.memMB} MB`);
      console.log(`  ${chalk.gray('Index files:')} ${health.indexFiles}`);
      console.log(`  ${chalk.gray('Urgency:')}    ${chalk[urg](plan.urgency.toUpperCase())}`);
      if (plan.steps.length > 0) {
        console.log(chalk.bold('\nRecovery Plan:'));
        plan.steps.forEach((s) => {
          const ic = s.auto ? chalk.green('►') : chalk.yellow('►');
          console.log(`  ${ic} [${s.action}]  ${chalk.gray(s.description)}`);
        });
        console.log(`\n  Run ${chalk.cyan('local-agent heal repair-index')} / ${chalk.cyan('clear-cache')} / ${chalk.cyan('recover-runtime')} to fix.\n`);
      } else {
        console.log(chalk.green('\n  No issues found.\n'));
      }
    });

  healCmd
    .command('repair-index [path]')
    .description('Remove corrupt index fragments and schedule rebuild')
    .option('--project <path>', 'Path to target project')
    .option('--dry-run', 'Show what would be done without making changes')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { SelfHealManager } = await import('../local-agent/self-heal/SelfHealManager.js');
      const mgr    = new SelfHealManager(targetDir);
      const spinner = ora('Repairing index...').start();
      try {
        const result = mgr.repairIndex({ dryRun: opts.dryRun ?? false });
        spinner.succeed(chalk.green(`Index repair ${result.dryRun ? '(dry-run) ' : ''}complete`));
        console.log(`  Removed: ${result.removed} file(s)`);
        console.log(`  Rebuild marker: ${result.markerWritten ? 'written' : 'skipped (dry-run)'}`);
        if (result.issues.length) result.issues.forEach((i) => console.log(`  ${chalk.yellow('⚠')} ${i}`));
        console.log(`\n  Run ${chalk.cyan('local-agent scan')} to rebuild the index.\n`);
      } catch (err) { spinner.fail(chalk.red('Failed')); die(err.message); }
    });

  healCmd
    .command('clear-cache [path]')
    .description('Clear stale logs and old backup files')
    .option('--project <path>', 'Path to target project')
    .option('--dry-run', 'Show what would be done without making changes')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { SelfHealManager } = await import('../local-agent/self-heal/SelfHealManager.js');
      const mgr    = new SelfHealManager(targetDir);
      const spinner = ora('Clearing cache...').start();
      try {
        const result = mgr.clearCache({ dryRun: opts.dryRun ?? false });
        spinner.succeed(chalk.green(`Cache clear ${result.dryRun ? '(dry-run) ' : ''}complete`));
        console.log(`  Cleared: ${result.cleared} file(s)  freed: ${formatBytes(result.freedBytes)}`);
        if (result.errors.length) result.errors.forEach((e) => console.log(`  ${chalk.red('✗')} ${e}`));
        console.log();
      } catch (err) { spinner.fail(chalk.red('Failed')); die(err.message); }
    });

  healCmd
    .command('recover-runtime [path]')
    .description('Remove stale locks and reset corrupt runtime state')
    .option('--project <path>', 'Path to target project')
    .option('--dry-run', 'Show what would be done without making changes')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { SelfHealManager } = await import('../local-agent/self-heal/SelfHealManager.js');
      const mgr    = new SelfHealManager(targetDir);
      const spinner = ora('Recovering runtime...').start();
      try {
        const result = mgr.recoverRuntime({ dryRun: opts.dryRun ?? false });
        spinner.succeed(chalk.green(`Runtime recovery ${result.dryRun ? '(dry-run) ' : ''}complete`));
        result.actions.forEach((a) => console.log(`  ${chalk.green('✓')} ${a}`));
        if (result.errors.length) result.errors.forEach((e) => console.log(`  ${chalk.red('✗')} ${e}`));
        if (result.recovered === 0) console.log('  No runtime issues found.');
        console.log();
      } catch (err) { spinner.fail(chalk.red('Failed')); die(err.message); }
    });

  healCmd.action(async (pathArg, opts) => {
    printBanner();
    const targetDir = resolveTarget(opts.project ?? pathArg);
    const { SelfHealManager } = await import('../local-agent/self-heal/SelfHealManager.js');
    const mgr    = new SelfHealManager(targetDir);
    const spinner = ora('Running auto-heal...').start();
    try {
      const result = mgr.autoHeal({ dryRun: opts.dryRun ?? false });
      spinner.succeed(chalk.green(`Auto-heal ${result.dryRun ? '(dry-run) ' : ''}complete — ${result.healed} action(s)`));
      result.results.forEach((r) => console.log(`  ${chalk.green('✓')} ${r.step}: ${r.type}`));
      if (result.healed === 0) console.log('  Nothing to heal.');
      console.log();
    } catch (err) { spinner.fail(chalk.red('Failed')); die(err.message); }
  });

  // ── reason (Phase 25 — AI Reasoning Engine) ──────────────────────────────
  const reasonCmd = program
    .command('reason <task>')
    .description('Decompose a task, generate strategies, and build a verification plan')
    .option('--project <path>', 'Path to target project')
    .option('--files <list>', 'Comma-separated list of affected files')
    .option('--json', 'Output raw JSON');

  reasonCmd.action(async (task, opts) => {
    printBanner();
    const targetDir = resolveTarget(opts.project);
    const files     = opts.files ? opts.files.split(',').map((f) => f.trim()) : [];
    const { decompose }            = await import('../local-agent/reasoning/TaskDecomposer.js');
    const { generateStrategies }   = await import('../local-agent/reasoning/MultiStrategyPlanner.js');
    const { scoreRisk }            = await import('../local-agent/reasoning/RiskWeightedPlanner.js');
    const { compareStrategies }    = await import('../local-agent/reasoning/DecisionComparator.js');
    const { buildVerificationPlan } = await import('../local-agent/reasoning/VerificationPlanner.js');

    const plan       = decompose(task, { files });
    const strategies = generateStrategies(task, { complexity: plan.complexity, files });
    const ranked     = compareStrategies(strategies.strategies);
    const risk       = scoreRisk({ files, stepCount: plan.steps.length, complexity: plan.complexity });
    const verify     = buildVerificationPlan({ ...plan, files });

    if (opts.json) { console.log(JSON.stringify({ plan, strategies, ranked, risk, verify }, null, 2)); return; }

    const riskCol = risk.level === 'critical' ? 'red' : risk.level === 'high' ? 'yellow' : risk.level === 'medium' ? 'cyan' : 'green';
    console.log(chalk.bold(`Task Analysis: "${task}"`));
    console.log(`  ${chalk.gray('Complexity:')} ${plan.complexity}  ${chalk.gray('Confidence:')} ${(plan.confidence * 100).toFixed(0)}%\n`);

    console.log(chalk.bold('Steps:'));
    plan.steps.forEach((s) => console.log(`  ${chalk.gray(String(s.seq).padStart(2, '0'))}. [${chalk.cyan(s.phase)}] ${s.description}`));

    console.log(chalk.bold('\nStrategies:'));
    ranked.ranked.forEach((s) => {
      const rec = s.id === ranked.winner ? chalk.green(' ← recommended') : '';
      console.log(`  ${chalk.bold(s.name)} (score: ${s.score})${rec}`);
      console.log(`     ${chalk.gray(s.description)}`);
    });

    console.log(chalk.bold('\nRisk Assessment:'));
    console.log(`  ${chalk[riskCol](risk.level.toUpperCase())}  score: ${risk.riskScore}/100`);
    risk.factors.forEach((f) => console.log(`  ${chalk.gray('→')} ${f}`));

    console.log(chalk.bold('\nVerification Checklist:'));
    verify.checks.forEach((c) => {
      const req = c.required ? chalk.red('[required]') : chalk.gray('[optional]');
      console.log(`  ${chalk.gray('□')} ${c.description}  ${req}`);
    });
    console.log();
  });

  // plan compare
  program
    .command('plan-compare <task>')
    .description('Compare strategies for a task by risk/effort trade-off')
    .option('--files <list>', 'Comma-separated affected files')
    .action(async (task, opts) => {
      printBanner();
      const files = opts.files ? opts.files.split(',').map((f) => f.trim()) : [];
      const { decompose }          = await import('../local-agent/reasoning/TaskDecomposer.js');
      const { generateStrategies } = await import('../local-agent/reasoning/MultiStrategyPlanner.js');
      const { compareStrategies }  = await import('../local-agent/reasoning/DecisionComparator.js');
      const plan       = decompose(task, { files });
      const strategies = generateStrategies(task, { complexity: plan.complexity, files });
      const ranked     = compareStrategies(strategies.strategies);
      console.log(chalk.bold(`Strategy Comparison for: "${task}"\n`));
      ranked.ranked.forEach((s, i) => {
        const rec = s.id === ranked.winner ? chalk.green(' ← pick this') : '';
        console.log(`  #${i + 1}  ${chalk.bold(s.name)}${rec}`);
        console.log(`       Risk: ${s.risk}   Effort: ${s.effort}   Score: ${s.score}`);
        console.log(`       ${chalk.gray(s.description)}\n`);
      });
    });

  // ── optimize (Phase 26 — Large Project Optimizer) ─────────────────────────
  const optCmd = program
    .command('optimize [path]')
    .description('Optimize indexing and scanning for large projects')
    .option('--project <path>', 'Path to target project');

  optCmd
    .command('index [path]')
    .description('Run incremental index scan (only changed files)')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { LargeProjectCoordinator } = await import('../local-agent/optimizer/LargeProjectCoordinator.js');
      const coord   = new LargeProjectCoordinator(targetDir);
      const spinner = ora('Running incremental scan...').start();
      try {
        const result = await coord.scan({ onProgress: (d, t) => spinner.text = `Scanning ${d}/${t} files...` });
        spinner.succeed(chalk.green('Incremental scan complete'));
        console.log(`  Strategy:  ${result.strategy} (${result.projectSize})`);
        console.log(`  Total:     ${result.totalFiles} files`);
        console.log(`  Changed:   ${result.changedFiles}`);
        console.log(`  Unchanged: ${result.unchangedFiles}`);
        console.log(`  Duration:  ${result.durationMs}ms`);
        console.log(`  Cache:     ${result.cacheStats.entries} entries (${result.cacheStats.usagePct}% full)\n`);
      } catch (err) { spinner.fail(chalk.red('Failed')); die(err.message); }
    });

  optCmd
    .command('benchmark [path]')
    .description('Benchmark project scan performance')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { LargeProjectCoordinator } = await import('../local-agent/optimizer/LargeProjectCoordinator.js');
      const coord   = new LargeProjectCoordinator(targetDir);
      const spinner = ora('Benchmarking...').start();
      const result  = coord.benchmark();
      spinner.succeed(chalk.green('Benchmark complete'));
      const tgtCol = result.meetsTarget ? 'green' : 'yellow';
      console.log(`  Project size: ${result.projectSize} (${result.totalFiles} files)`);
      console.log(`  Changed files: ${result.changedFiles}`);
      console.log(`  Detect time: ${result.benchmarkMs}ms`);
      console.log(`  Target met: ${chalk[tgtCol](result.meetsTarget ? 'YES' : 'NO')}\n`);
    });

  optCmd.action(async (pathArg, opts) => {
    printBanner();
    const targetDir = resolveTarget(opts.project ?? pathArg);
    const { LargeProjectCoordinator } = await import('../local-agent/optimizer/LargeProjectCoordinator.js');
    const coord = new LargeProjectCoordinator(targetDir);
    const cls   = coord.classify();
    console.log(chalk.bold('Project Classification:'));
    console.log(`  Size:     ${cls.size}`);
    console.log(`  Files:    ${cls.fileCount}`);
    console.log(`  Strategy: ${cls.strategy}`);
    console.log(`\n  Run ${chalk.cyan('local-agent optimize index')} or ${chalk.cyan('optimize benchmark')}\n`);
  });

  // ── plugins (Phase 27 — Plugin System) ───────────────────────────────────
  const pluginCmd = program
    .command('plugins')
    .description('Manage local plugins and extensions');

  pluginCmd
    .command('list [path]')
    .description('List installed plugins')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { listPlugins } = await import('../local-agent/plugins/PluginRegistry.js');
      const plugins = listPlugins(targetDir);
      if (!plugins.length) {
        console.log(chalk.yellow('No plugins installed. Use: local-agent plugins install <path>\n'));
        return;
      }
      console.log(chalk.bold(`Installed Plugins (${plugins.length}):\n`));
      plugins.forEach((p) => {
        const st = p.enabled ? chalk.green('enabled') : chalk.gray('disabled');
        console.log(`  ${chalk.bold(p.name)}  v${p.version}  [${st}]`);
        console.log(`    ${chalk.gray(p.description)}`);
        console.log(`    Permissions: ${p.permissions.join(', ') || 'none'}`);
      });
      console.log();
    });

  pluginCmd
    .command('install <pluginPath> [workspacePath]')
    .description('Install a local plugin from a directory')
    .option('--project <path>', 'Path to target project')
    .action(async (pluginPath, workspacePath, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? workspacePath);
      const { installPlugin } = await import('../local-agent/plugins/PluginLoader.js');
      const spinner = ora(`Installing plugin from ${pluginPath}...`).start();
      try {
        const result = await installPlugin(targetDir, resolve(pluginPath));
        if (result.success) {
          spinner.succeed(chalk.green(`Plugin "${result.name}" installed (disabled by default)`));
          if (result.warnings?.length) result.warnings.forEach((w) => console.log(`  ${chalk.yellow('⚠')} ${w}`));
          console.log(`  Enable with: ${chalk.cyan(`local-agent plugins enable ${result.name}`)}\n`);
        } else {
          spinner.fail(chalk.red('Installation failed'));
          result.errors?.forEach((e) => console.log(`  ${chalk.red('✗')} ${e}`));
        }
      } catch (err) { spinner.fail(chalk.red('Failed')); die(err.message); }
    });

  pluginCmd
    .command('enable <name> [workspacePath]')
    .description('Enable a plugin')
    .option('--project <path>', 'Path to target project')
    .action(async (name, workspacePath, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? workspacePath);
      const { setEnabled } = await import('../local-agent/plugins/PluginRegistry.js');
      try { setEnabled(targetDir, name, true); console.log(chalk.green(`Plugin "${name}" enabled.\n`)); }
      catch (err) { die(err.message); }
    });

  pluginCmd
    .command('disable <name> [workspacePath]')
    .description('Disable a plugin')
    .option('--project <path>', 'Path to target project')
    .action(async (name, workspacePath, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? workspacePath);
      const { setEnabled } = await import('../local-agent/plugins/PluginRegistry.js');
      try { setEnabled(targetDir, name, false); console.log(chalk.green(`Plugin "${name}" disabled.\n`)); }
      catch (err) { die(err.message); }
    });

  pluginCmd
    .command('validate <pluginPath>')
    .description('Validate a plugin manifest without installing')
    .action(async (pluginPath) => {
      printBanner();
      const { readFileSync, existsSync: _ex } = await import('fs');
      const { join: _j } = await import('path');
      const { validateManifest } = await import('../local-agent/plugins/PluginValidator.js');
      const mPath = _j(resolve(pluginPath), 'manifest.json');
      if (!_ex(mPath)) die('manifest.json not found');
      let manifest;
      try { manifest = JSON.parse(readFileSync(mPath, 'utf8')); } catch (err) { die(err.message); }
      const { valid, errors, warnings } = validateManifest(manifest);
      console.log(chalk.bold(`Validation: ${valid ? chalk.green('PASS') : chalk.red('FAIL')}`));
      errors.forEach((e)   => console.log(`  ${chalk.red('✗')} ${e}`));
      warnings.forEach((w) => console.log(`  ${chalk.yellow('⚠')} ${w}`));
      if (valid && !warnings.length) console.log(chalk.green('  Manifest is valid.\n'));
      else console.log();
    });

  // ── team (Phase 28 — Team Collaboration Mode) ─────────────────────────────
  const teamCmd = program
    .command('team')
    .description('Team collaboration: export/import memory and recipes via LAN/NAS');

  teamCmd
    .command('export-memory <targetDir> [workspacePath]')
    .description('Export workspace memory to a shared folder (LAN/NAS)')
    .option('--project <path>', 'Path to target project')
    .option('--dry-run', 'Show what would be exported without writing')
    .action(async (targetDir, workspacePath, opts) => {
      printBanner();
      const src = resolveTarget(opts.project ?? workspacePath);
      const { exportMemory } = await import('../local-agent/team/SharedMemorySync.js');
      const { auditLog }     = await import('../local-agent/team/CollaborationAudit.js');
      const spinner = ora('Exporting memory...').start();
      try {
        const result = exportMemory(src, resolve(targetDir), { dryRun: opts.dryRun ?? false });
        spinner.succeed(chalk.green(`Memory export ${result.dryRun ? '(dry-run) ' : ''}complete`));
        console.log(`  Exported: ${result.exported} files  (${formatBytes(result.totalBytes)})`);
        console.log(`  Skipped:  ${result.skipped}`);
        if (result.errors.length) result.errors.forEach((e) => console.log(`  ${chalk.red('✗')} ${e}`));
        if (!result.dryRun) auditLog(src, 'export-memory', { target: targetDir, exported: result.exported });
        console.log();
      } catch (err) { spinner.fail(chalk.red('Failed')); die(err.message); }
    });

  teamCmd
    .command('import-memory <sourceDir> [workspacePath]')
    .description('Import memory from a shared folder into workspace')
    .option('--project <path>', 'Path to target project')
    .option('--overwrite', 'Overwrite existing memory files')
    .option('--dry-run', 'Show what would be imported without writing')
    .action(async (sourceDir, workspacePath, opts) => {
      printBanner();
      const dst = resolveTarget(opts.project ?? workspacePath);
      const { importMemory } = await import('../local-agent/team/SharedMemorySync.js');
      const { auditLog }     = await import('../local-agent/team/CollaborationAudit.js');
      const spinner = ora('Importing memory...').start();
      try {
        const result = importMemory(dst, resolve(sourceDir), { dryRun: opts.dryRun ?? false, overwrite: opts.overwrite ?? false });
        spinner.succeed(chalk.green(`Memory import ${result.dryRun ? '(dry-run) ' : ''}complete`));
        console.log(`  Imported: ${result.imported}  Skipped: ${result.skipped}`);
        if (result.errors.length) result.errors.forEach((e) => console.log(`  ${chalk.red('✗')} ${e}`));
        if (!result.dryRun) auditLog(dst, 'import-memory', { source: sourceDir, imported: result.imported });
        console.log();
      } catch (err) { spinner.fail(chalk.red('Failed')); die(err.message); }
    });

  teamCmd
    .command('export-recipes <targetDir> [workspacePath]')
    .description('Export reports/recipes to a shared folder')
    .option('--project <path>', 'Path to target project')
    .option('--dry-run', 'Show what would be exported without writing')
    .action(async (targetDir, workspacePath, opts) => {
      printBanner();
      const src = resolveTarget(opts.project ?? workspacePath);
      const { exportPack } = await import('../local-agent/team/TeamPackExporter.js');
      const { auditLog }   = await import('../local-agent/team/CollaborationAudit.js');
      const spinner = ora('Exporting recipes...').start();
      try {
        const result = exportPack(src, resolve(targetDir), { dryRun: opts.dryRun ?? false, includeMemory: false, includeRecipes: true });
        spinner.succeed(chalk.green(`Recipe export ${result.dryRun ? '(dry-run) ' : ''}complete`));
        console.log(`  Exported: ${result.exported.length} file(s)`);
        if (result.errors.length) result.errors.forEach((e) => console.log(`  ${chalk.red('✗')} ${e}`));
        if (!result.dryRun) auditLog(src, 'export-recipes', { target: targetDir, count: result.exported.length });
        console.log();
      } catch (err) { spinner.fail(chalk.red('Failed')); die(err.message); }
    });

  teamCmd
    .command('audit-share [workspacePath]')
    .description('View team collaboration audit log')
    .option('--project <path>', 'Path to target project')
    .option('--limit <n>', 'Number of recent entries to show', '20')
    .action(async (workspacePath, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? workspacePath);
      const { readAuditLog } = await import('../local-agent/team/CollaborationAudit.js');
      const entries = readAuditLog(targetDir, { limit: parseInt(opts.limit, 10) || 20 });
      if (!entries.length) { console.log(chalk.yellow('No team audit entries yet.\n')); return; }
      console.log(chalk.bold(`Team Collaboration Audit (last ${entries.length}):\n`));
      entries.forEach((e) => {
        console.log(`  ${chalk.gray(e.ts)}  ${chalk.cyan(e.action.padEnd(18))}  ${chalk.gray(`user: ${e.user}`)}`);
      });
      console.log();
    });

  // ── timeline (Phase 34 — Source Timeline Engine) ─────────────────────────
  const tlCmd = program
    .command('timeline [path]')
    .description('Source timeline: file changes, QA runs, patches, regressions')
    .option('--project <path>', 'Path to target project');

  tlCmd.action(async (pathArg, opts) => {
    printBanner();
    const targetDir = resolveTarget(opts.project ?? pathArg);
    const { getSummary } = await import('../local-agent/timeline/TimelineEngine.js');
    const s = getSummary(targetDir);
    console.log(chalk.bold('Timeline Summary:'));
    console.log(`  Total events:  ${s.totalEvents}`);
    console.log(`  QA runs:       ${s.qaRuns}  (pass rate: ${s.qaPassRate ?? 'n/a'}%)`);
    console.log(`  Regressions:   ${s.regressions}`);
    if (s.unstable.length) {
      console.log(chalk.bold('\nMost Changed Files:'));
      s.unstable.forEach((f) => console.log(`  ${chalk.yellow('↑')} ${f.file}  (${f.changeCount} changes)`));
    }
    console.log();
  });

  tlCmd
    .command('file <file> [path]')
    .description('Show timeline for a specific file')
    .option('--project <path>', 'Path to target project')
    .action(async (file, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { getFileTimeline } = await import('../local-agent/timeline/TimelineEngine.js');
      const events = getFileTimeline(targetDir, file);
      if (!events.length) { console.log(chalk.yellow(`No timeline events for: ${file}\n`)); return; }
      console.log(chalk.bold(`Timeline for: ${file}  (${events.length} events)\n`));
      events.slice(-20).forEach((e) => {
        const col = e.type === 'regression' ? 'red' : e.type === 'file_change' ? 'cyan' : 'gray';
        console.log(`  ${chalk.gray(e.ts.slice(0, 19))}  ${chalk[col](e.type.padEnd(14))}  ${e.action ?? e.patchId ?? ''}`);
      });
      console.log();
    });

  tlCmd
    .command('regressions [path]')
    .description('Show regression history')
    .option('--project <path>', 'Path to target project')
    .option('--limit <n>', 'Max results', '30')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { getRegressions } = await import('../local-agent/timeline/TimelineEngine.js');
      const events = getRegressions(targetDir, { limit: parseInt(opts.limit) || 30 });
      if (!events.length) { console.log(chalk.green('No regression events recorded.\n')); return; }
      console.log(chalk.bold(`Regression History (${events.length}):\n`));
      events.forEach((e) => console.log(`  ${chalk.gray(e.ts.slice(0, 19))}  ${chalk.red(e.file ?? '?')}  ${chalk.gray(e.test ?? '')}`));
      console.log();
    });

  // ── deps (Phase 35 — Dependency Health) ──────────────────────────────────
  const depsCmd = program
    .command('deps')
    .description('Dependency health analysis');

  depsCmd
    .command('scan [path]')
    .description('Scan dependencies for health issues')
    .option('--project <path>', 'Path to target project')
    .option('--json', 'Output JSON')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { scanDeps } = await import('../local-agent/deps/DepScanner.js');
      const spinner = ora('Scanning dependencies...').start();
      const result  = scanDeps(targetDir);
      spinner.stop();
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      const { summary, totalDeps, unhealthy } = result;
      const col = unhealthy === 0 ? 'green' : unhealthy < 5 ? 'yellow' : 'red';
      console.log(chalk.bold(`Dependency Scan: ${totalDeps} packages, ${chalk[col](unhealthy + ' issues')}\n`));
      console.log(`  Risky:     ${summary.risky}   Abandoned: ${summary.abandoned}`);
      console.log(`  Oversized: ${summary.oversized}  Duplicate: ${summary.duplicate}  Unpinned: ${summary.unpinned}`);
      if (unhealthy > 0) {
        console.log(chalk.bold('\nIssues:'));
        result.packages.filter((p) => !p.healthy).slice(0, 15).forEach((p) => {
          p.issues.forEach((i) => console.log(`  ${chalk.yellow('⚠')} ${chalk.bold(p.name)}  [${i.type}]  ${i.msg}`));
        });
      }
      console.log();
    });

  depsCmd
    .command('tree [path]')
    .description('Show dependency tree (depth 2)')
    .option('--project <path>', 'Path to target project')
    .option('--depth <n>', 'Tree depth', '2')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { buildTree, renderTree } = await import('../local-agent/deps/DepTree.js');
      const tree = buildTree(targetDir, { depth: parseInt(opts.depth) || 2 });
      console.log(chalk.bold('Dependency Tree:\n'));
      console.log(renderTree(tree));
      console.log();
    });

  depsCmd
    .command('risk [path]')
    .description('Show only risky and abandoned dependencies')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { scanDeps } = await import('../local-agent/deps/DepScanner.js');
      const result = scanDeps(targetDir);
      const risky  = result.packages.filter((p) => p.issues.some((i) => i.type === 'risky' || i.type === 'abandoned'));
      if (!risky.length) { console.log(chalk.green('No risky or abandoned dependencies found.\n')); return; }
      console.log(chalk.bold.red(`Risk Report: ${risky.length} packages\n`));
      risky.forEach((p) => {
        p.issues.filter((i) => i.type === 'risky' || i.type === 'abandoned').forEach((i) => {
          console.log(`  ${chalk.red('✗')} ${chalk.bold(p.name)}@${p.installed ?? '?'}  ${i.msg}`);
        });
      });
      console.log();
    });

  depsCmd
    .command('conflicts [path]')
    .description('Show duplicate / conflicting dependency versions')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { scanDeps } = await import('../local-agent/deps/DepScanner.js');
      const result    = scanDeps(targetDir);
      const conflicts = result.packages.filter((p) => p.issues.some((i) => i.type === 'duplicate'));
      if (!conflicts.length) { console.log(chalk.green('No duplicate dependencies detected.\n')); return; }
      console.log(chalk.bold(`Duplicate Versions: ${conflicts.length} packages\n`));
      conflicts.forEach((p) => console.log(`  ${chalk.yellow('⚠')} ${chalk.bold(p.name)}  declared: ${p.declared}  installed: ${p.installed ?? '?'}`));
      console.log();
    });

  // ── vault (Phase 36 — Secret Isolation Vault) ─────────────────────────────
  const vaultCmd = program
    .command('vault')
    .description('Local secret isolation vault — detect and isolate accidental secret exposure');

  vaultCmd
    .command('scan [path]')
    .description('Scan workspace for accidentally exposed secrets')
    .option('--project <path>', 'Path to target project')
    .option('--json', 'Output JSON')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { scanForSecrets } = await import('../local-agent/vault/SecretScanner.js');
      const spinner = ora('Scanning for secrets...').start();
      const result  = scanForSecrets(targetDir);
      spinner.stop();
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      const col = result.count === 0 ? 'green' : 'red';
      console.log(chalk.bold(`Secret Scan: ${chalk[col](result.count + ' potential finding(s)')}\n`));
      if (result.count === 0) { console.log(chalk.green('  No secrets detected.\n')); return; }
      result.findings.slice(0, 20).forEach((f) => {
        console.log(`  ${chalk.red('⚠')} ${chalk.bold(f.file)}:${f.line}  [${f.secretType}]  ${chalk.gray(f.snippet)}`);
        console.log(`     Hash: ${chalk.gray(f.hash)}`);
      });
      if (result.count > 20) console.log(`  ... and ${result.count - 20} more`);
      console.log('\n  Raw values are NEVER stored. Only content hashes are recorded.\n');
    });

  vaultCmd
    .command('audit [path]')
    .description('View vault audit log')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { readVaultAudit, loadVault } = await import('../local-agent/vault/SecretVault.js');
      const vault   = loadVault(targetDir);
      const entries = readVaultAudit(targetDir);
      const count   = Object.keys(vault.entries).length;
      console.log(chalk.bold(`Vault Index: ${count} secret reference(s)`));
      Object.values(vault.entries).forEach((e) =>
        console.log(`  ${chalk.cyan(e.name.padEnd(20))} ${chalk.gray(e.hash)}  ${e.file ?? ''}`));
      if (entries.length) {
        console.log(chalk.bold('\nVault Audit Log:'));
        entries.slice(-10).forEach((e) =>
          console.log(`  ${chalk.gray(e.ts.slice(0, 19))}  ${chalk.cyan(e.action)}  ${e.name ?? ''}`));
      }
      console.log();
    });

  vaultCmd
    .command('isolate <name> [path]')
    .description('Register a secret reference by name (provide raw value interactively)')
    .option('--project <path>', 'Path to target project')
    .option('--hash <hash>', 'Provide pre-computed hash instead of raw value')
    .option('--desc <description>', 'Description of the secret')
    .option('--file <file>', 'Source file of the secret')
    .action(async (name, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { registerSecret } = await import('../local-agent/vault/SecretVault.js');
      if (!opts.hash) {
        console.log(chalk.yellow('  Tip: Use --hash to provide a pre-computed SHA-256 hash instead of the raw value.\n'));
      }
      try {
        const entry = registerSecret(targetDir, {
          name,
          hash:        opts.hash,
          rawValue:    opts.hash ? undefined : 'placeholder-' + Date.now(), // never store real value from CLI
          description: opts.desc ?? '',
          file:        opts.file,
        });
        console.log(chalk.green(`Secret reference "${name}" registered in vault.`));
        console.log(`  Hash: ${chalk.gray(entry.hash)}\n`);
      } catch (err) { die(err.message); }
    });

  // ── incident (Phase 37 — Incident Response) ───────────────────────────────
  const incCmd = program
    .command('incident')
    .description('Local engineering incident response');

  incCmd
    .command('create [path]')
    .description('Create a new incident')
    .option('--project <path>', 'Path to target project')
    .option('--title <title>', 'Incident title')
    .option('--severity <s>', 'critical|high|medium|low', 'high')
    .option('--category <c>', 'corrupted_workspace|broken_release|destructive_patch|severe_regression|db_corruption|crash_loop|security|other', 'other')
    .option('--desc <description>', 'Description')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { createIncident } = await import('../local-agent/incident/IncidentManager.js');
      const title = opts.title ?? `Incident ${new Date().toISOString().slice(0, 10)}`;
      const inc   = createIncident(targetDir, { title, severity: opts.severity, category: opts.category, description: opts.desc ?? '' });
      const col   = inc.severity === 'critical' ? 'red' : inc.severity === 'high' ? 'yellow' : 'cyan';
      console.log(chalk.bold(`Incident created: ${chalk[col](inc.id)}`));
      console.log(`  Title:    ${inc.title}`);
      console.log(`  Severity: ${chalk[col](inc.severity.toUpperCase())}`);
      console.log(`  Category: ${inc.category}`);
      console.log(`\n  Analyze: local-agent incident analyze ${inc.id}`);
      console.log(`  Recover: local-agent incident recover ${inc.id}\n`);
    });

  incCmd
    .command('analyze <id> [path]')
    .description('Analyze an incident and get recovery steps')
    .option('--project <path>', 'Path to target project')
    .action(async (id, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { analyzeIncident } = await import('../local-agent/incident/IncidentAnalyzer.js');
      try {
        const { analysis, recoverySteps } = analyzeIncident(targetDir, id);
        const col = analysis.severity === 'critical' ? 'red' : analysis.severity === 'high' ? 'yellow' : 'cyan';
        console.log(chalk.bold(`Incident Analysis: ${id}`));
        console.log(`  Severity: ${chalk[col](analysis.severity.toUpperCase())}   Age: ${analysis.age}`);
        console.log(`  Urgency:  ${chalk[col](analysis.urgency)}`);
        console.log(`  Status:   ${analysis.status}`);
        console.log(chalk.bold('\nRecovery Playbook:'));
        recoverySteps.forEach((s, i) => console.log(`  ${chalk.cyan(String(i+1).padStart(2))}. ${s}`));
        console.log();
      } catch (err) { die(err.message); }
    });

  incCmd
    .command('recover <id> [path]')
    .description('Mark incident as recovering with a note')
    .option('--project <path>', 'Path to target project')
    .option('--note <note>', 'Recovery note')
    .action(async (id, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { updateIncident } = await import('../local-agent/incident/IncidentManager.js');
      try {
        const inc = updateIncident(targetDir, id, { status: 'recovering', note: opts.note ?? 'Recovery started' });
        console.log(chalk.green(`Incident ${id} status → recovering`));
        console.log(`  Timeline entries: ${inc.timeline.length}\n`);
      } catch (err) { die(err.message); }
    });

  incCmd
    .command('report [path]')
    .description('List all incidents')
    .option('--project <path>', 'Path to target project')
    .option('--status <s>', 'Filter by status: open|recovering|resolved')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { listIncidents } = await import('../local-agent/incident/IncidentManager.js');
      const incidents = listIncidents(targetDir, { status: opts.status });
      if (!incidents.length) { console.log(chalk.green('No incidents found.\n')); return; }
      console.log(chalk.bold(`Incidents (${incidents.length}):\n`));
      incidents.forEach((inc) => {
        const col = inc.severity === 'critical' ? 'red' : inc.severity === 'high' ? 'yellow' : 'cyan';
        console.log(`  ${chalk[col](inc.id.padEnd(12))} ${chalk.bold(inc.severity.padEnd(10))} [${inc.status.padEnd(12)}] ${inc.title}`);
        console.log(`    ${chalk.gray(inc.createdAt.slice(0, 19))}  ${inc.category}`);
      });
      console.log();
    });

  // ── analytics (Phase 38 — Engineering Analytics) ─────────────────────────
  const analyticsCmd = program
    .command('analytics [path]')
    .description('Local engineering metrics and analytics')
    .option('--project <path>', 'Path to target project')
    .option('--json', 'Output JSON');

  analyticsCmd.action(async (pathArg, opts) => {
    printBanner();
    const targetDir = resolveTarget(opts.project ?? pathArg);
    const { fullAnalytics } = await import('../local-agent/analytics/AnalyticsEngine.js');
    const data = fullAnalytics(targetDir);
    if (opts.json) { console.log(JSON.stringify(data, null, 2)); return; }
    const qaCol = data.qa.passRate === null ? 'gray' : data.qa.passRate >= 80 ? 'green' : data.qa.passRate >= 50 ? 'yellow' : 'red';
    console.log(chalk.bold('Engineering Analytics\n'));
    console.log(`  QA pass rate:      ${chalk[qaCol]((data.qa.passRate ?? 'n/a') + '%')}`);
    console.log(`  Total regressions: ${data.regressions.total}`);
    console.log(`  Patches applied:   ${data.patches.applied}  rolled back: ${data.patches.rolledBack}`);
    console.log(`  Fix success rate:  ${data.patches.fixSuccessRate ?? 'n/a'}%`);
    if (data.unstableModules.length) {
      console.log(chalk.bold('\nMost Unstable Modules:'));
      data.unstableModules.forEach((m) => console.log(`  ${chalk.yellow('↑')} ${m.file}  (${m.changes} changes)`));
    }
    console.log();
  });

  analyticsCmd
    .command('qa [path]')
    .description('QA pass rate trend')
    .option('--project <path>', 'Path to target project')
    .option('--days <n>', 'Days of history', '14')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { qaAnalytics } = await import('../local-agent/analytics/AnalyticsEngine.js');
      const { trend, currentPassRate, totalRuns } = qaAnalytics(targetDir, { days: parseInt(opts.days) || 14 });
      console.log(chalk.bold(`QA Analytics (last ${opts.days} days, ${totalRuns} runs)\n`));
      if (!trend.length) { console.log(chalk.yellow('  No QA events recorded yet.\n')); return; }
      trend.forEach((t) => {
        const bar = '█'.repeat(Math.round(t.passRate / 10));
        const col = t.passRate >= 80 ? 'green' : t.passRate >= 50 ? 'yellow' : 'red';
        console.log(`  ${t.date}  ${chalk[col](bar.padEnd(10))} ${t.passRate}%  (${t.passed}/${t.total})`);
      });
      console.log(`\n  Current pass rate: ${currentPassRate ?? 'n/a'}%\n`);
    });

  analyticsCmd
    .command('regressions [path]')
    .description('Regression frequency analysis')
    .option('--project <path>', 'Path to target project')
    .option('--days <n>', 'Days of history', '30')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { regressionAnalytics } = await import('../local-agent/analytics/AnalyticsEngine.js');
      const { perDay, hotFiles, totalRegressions } = regressionAnalytics(targetDir, { days: parseInt(opts.days) || 30 });
      console.log(chalk.bold(`Regression Analytics (last ${opts.days} days): ${totalRegressions} total\n`));
      if (hotFiles.length) {
        console.log(chalk.bold('Hot Files:'));
        hotFiles.forEach((f) => console.log(`  ${chalk.red('↑')} ${f.file}  (${f.count} regressions)`));
      }
      if (perDay.length) {
        console.log(chalk.bold('\nBy Day:'));
        perDay.slice(-7).forEach((d) => console.log(`  ${d.date}  ${'●'.repeat(Math.min(d.count, 10))} ${d.count}`));
      }
      console.log();
    });

  // ── governance (Phase 39 — AI Governance) ────────────────────────────────
  const govCmd = program
    .command('governance')
    .description('Local AI governance: patch policies, risk thresholds, restricted zones');

  govCmd
    .command('status [path]')
    .description('Show current governance policy')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { loadGovernance } = await import('../local-agent/governance/GovernanceEngine.js');
      const gov = loadGovernance(targetDir);
      console.log(chalk.bold('AI Governance Policy:\n'));
      console.log(`  Patch approval required: ${gov.patchApprovalRequired ? chalk.yellow('YES') : chalk.green('NO')}`);
      console.log(`  Risk threshold:          ${chalk.cyan(gov.riskThreshold)}`);
      console.log(`  Offline mode required:   ${gov.modelPolicy.requireOffline ? chalk.green('YES') : chalk.red('NO')}`);
      console.log(`  Restricted files:        ${gov.restrictedFiles.join(', ')}`);
      console.log(`  Workflow approvals:`);
      Object.entries(gov.workflowApprovals).forEach(([k, v]) =>
        console.log(`    ${k.padEnd(20)} ${v ? chalk.yellow('required') : chalk.green('auto')}`));
      console.log();
    });

  govCmd
    .command('policies [path]')
    .description('List all governance policies with role permissions')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { loadGovernance } = await import('../local-agent/governance/GovernanceEngine.js');
      const gov = loadGovernance(targetDir);
      console.log(chalk.bold('Governance Roles:\n'));
      Object.entries(gov.roles).forEach(([role, perms]) => {
        console.log(`  ${chalk.cyan(role.padEnd(14))} ${Object.entries(perms).filter(([,v]) => v).map(([k]) => k).join(', ')}`);
      });
      console.log();
    });

  govCmd
    .command('audit [path]')
    .description('View governance audit log')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { readGovernanceAudit } = await import('../local-agent/governance/GovernanceEngine.js');
      const entries = readGovernanceAudit(targetDir);
      if (!entries.length) { console.log(chalk.yellow('No governance audit events yet.\n')); return; }
      console.log(chalk.bold('Governance Audit Log:\n'));
      entries.slice(-15).forEach((e) =>
        console.log(`  ${chalk.gray(e.ts.slice(0, 19))}  ${chalk.cyan(e.action.padEnd(22))}  ${JSON.stringify(e).slice(0, 60)}`));
      console.log();
    });

  // ── users / roles (Phase 40 — RBAC) ──────────────────────────────────────
  const usersCmd = program
    .command('users')
    .description('Local RBAC user management');

  usersCmd
    .command('list [path]')
    .description('List all users and their roles')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { listUsers } = await import('../local-agent/rbac/RBACManager.js');
      const users = listUsers(targetDir);
      if (!users.length) { console.log(chalk.yellow('No users registered. Use: local-agent roles assign\n')); return; }
      console.log(chalk.bold(`Users (${users.length}):\n`));
      users.forEach((u) => {
        console.log(`  ${chalk.bold(u.username.padEnd(20))} ${chalk.cyan(u.role.padEnd(14))} level: ${u.level}`);
        console.log(`    ${chalk.gray(u.permissions.join(', ').slice(0, 80))}`);
      });
      console.log();
    });

  const rolesCmd = program
    .command('roles')
    .description('Role assignment and definitions');

  rolesCmd.action(async () => {
    printBanner();
    const { getRoleDefinitions } = await import('../local-agent/rbac/RBACManager.js');
    const roles = getRoleDefinitions();
    console.log(chalk.bold('Available Roles:\n'));
    roles.forEach((r) => {
      const perms = r.permissions.join(', ');
      console.log(`  ${chalk.cyan(r.role.padEnd(14))} [level ${r.level}]  ${chalk.gray(perms.slice(0, 70))}`);
    });
    console.log(`\n  Assign: local-agent roles assign <username> <role>\n`);
  });

  rolesCmd
    .command('assign <username> <role> [path]')
    .description('Assign a role to a user')
    .option('--project <path>', 'Path to target project')
    .action(async (username, role, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { assignRole } = await import('../local-agent/rbac/RBACManager.js');
      try {
        const entry = assignRole(targetDir, username, role);
        console.log(chalk.green(`Role assigned: ${username} → ${role}`));
        console.log(`  Permissions: ${(entry.permissions ?? []).length}\n`);
      } catch (err) { die(err.message); }
    });

  const accessCmd = program
    .command('access')
    .description('Access control and RBAC audit');

  accessCmd
    .command('audit [path]')
    .description('View RBAC access audit log')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { readAccessAudit } = await import('../local-agent/rbac/RBACManager.js');
      const entries = readAccessAudit(targetDir);
      if (!entries.length) { console.log(chalk.yellow('No access audit entries yet.\n')); return; }
      console.log(chalk.bold('Access Audit Log:\n'));
      entries.slice(-15).forEach((e) =>
        console.log(`  ${chalk.gray(e.ts.slice(0, 19))}  ${chalk.cyan(e.action.padEnd(18))}  ${e.username ?? ''}  ${e.role ?? ''}`));
      console.log();
    });

  // ── resources (Phase 41 — Resource Monitor) ───────────────────────────────
  const resCmd = program
    .command('resources [path]')
    .description('Monitor local machine resources for agent runtime')
    .option('--project <path>', 'Path to target project');

  resCmd.action(async (pathArg, opts) => {
    printBanner();
    const { snapshot, checkThresholds } = await import('../local-agent/resources/ResourceMonitor.js');
    const snap   = snapshot();
    const health = checkThresholds(snap);
    const col    = health.healthy ? 'green' : 'yellow';
    console.log(chalk.bold('Resource Snapshot:\n'));
    console.log(`  CPU:       ${chalk[col](snap.cpuPct + '%')}`);
    console.log(`  RSS Memory: ${snap.rssMB} MB  (heap: ${snap.heapMB}/${snap.heapTotMB} MB)`);
    console.log(`  Disk free: ${snap.diskFreeGB !== null ? snap.diskFreeGB + ' GB' : 'n/a'}`);
    console.log(`  GPU:       ${snap.gpuMB !== null ? snap.gpuMB + ' MB' : 'n/a (no NVIDIA)'}`);
    console.log(`  Temp:      ${snap.tempC !== null ? snap.tempC + '°C' : 'n/a'}`);
    if (!health.healthy) {
      console.log(chalk.bold.yellow('\nWarnings:'));
      health.warnings.forEach((w) => console.log(`  ${chalk.yellow('⚠')} ${w}`));
    } else {
      console.log(chalk.green('\n  All resources within normal limits.'));
    }
    console.log();
  });

  resCmd
    .command('monitor [path]')
    .description('Continuously monitor resources (10s interval, Ctrl+C to stop)')
    .option('--project <path>', 'Path to target project')
    .option('--interval <ms>', 'Sample interval in ms', '10000')
    .action(async (pathArg, opts) => {
      printBanner();
      const { ResourceWatcher } = await import('../local-agent/resources/ResourceMonitor.js');
      const intervalMs = parseInt(opts.interval) || 10000;
      const watcher    = new ResourceWatcher({ intervalMs });
      console.log(chalk.bold(`Resource Monitor (interval: ${intervalMs}ms, Ctrl+C to stop)\n`));
      watcher.on('sample', (s) => {
        const col = s.healthy ? 'green' : 'yellow';
        process.stdout.write(`\r  ${new Date().toISOString().slice(11, 19)}  CPU:${chalk[col](s.cpuPct + '%')}  RAM:${s.rssMB}MB  Disk:${s.diskFreeGB ?? 'n/a'}GB  Temp:${s.tempC ?? 'n/a'}°C  `);
        if (!s.healthy) console.log('\n' + s.warnings.map((w) => '  ⚠ ' + w).join('\n'));
      });
      watcher.start();
      await new Promise(() => {}); // run until Ctrl+C
    });

  resCmd
    .command('report [path]')
    .description('Generate resource health report (10 samples)')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const { snapshot, checkThresholds } = await import('../local-agent/resources/ResourceMonitor.js');
      const spinner = ora('Sampling resources (10 samples)...').start();
      const samples = [];
      for (let i = 0; i < 10; i++) {
        samples.push(snapshot());
        await new Promise((r) => setTimeout(r, 500));
      }
      spinner.succeed('Resource report complete');
      const avgCPU  = +(samples.reduce((s, x) => s + x.cpuPct, 0) / samples.length).toFixed(1);
      const peakRSS = Math.max(...samples.map((s) => s.rssMB));
      const avgRSS  = +(samples.reduce((s, x) => s + x.rssMB, 0) / samples.length).toFixed(1);
      console.log(`  Avg CPU:   ${avgCPU}%`);
      console.log(`  Avg RAM:   ${avgRSS} MB   Peak: ${peakRSS} MB`);
      console.log(`  Disk free: ${samples[0].diskFreeGB ?? 'n/a'} GB`);
      console.log(`  GPU:       ${samples[0].gpuMB ?? 'n/a'}`);
      console.log(`  Temp:      ${samples[0].tempC ?? 'n/a'}°C`);
      console.log();
    });

  // ── vision (Phase 42 — Visual Debug) ──────────────────────────────────────
  const visionCmd = program
    .command('vision')
    .description('Local visual debug: analyze screenshots and detect UI issues (no cloud)');

  visionCmd
    .command('analyze <imagePath>')
    .description('Analyze a local screenshot for UI issues')
    .option('--json', 'Output JSON')
    .action(async (imagePath, opts) => {
      printBanner();
      const { analyzeImage } = await import('../local-agent/vision/VisionAnalyzer.js');
      const spinner = ora(`Analyzing ${imagePath}...`).start();
      try {
        const result = analyzeImage(resolve(imagePath));
        spinner.stop();
        if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
        const col = result.healthy ? 'green' : 'yellow';
        console.log(chalk.bold(`Visual Analysis: ${result.file}`));
        console.log(`  Size:      ${result.fileSizeKB} KB`);
        if (result.dimensions) console.log(`  Dimensions: ${result.dimensions.width}×${result.dimensions.height}px`);
        console.log(`  Entropy:   ${result.entropy} ${result.entropy < 0.05 ? chalk.red('(low — may be blank)') : chalk.green('(ok)')}`);
        console.log(`  Result:    ${result.healthy ? chalk.green('✓ No issues') : chalk.yellow(`${result.issueCount} issue(s)`)}`);
        result.issues.forEach((i) => console.log(`  ${chalk.yellow('⚠')} [${i.type}] ${i.msg}`));
        console.log(`\n  ${chalk.gray(result.note)}\n`);
      } catch (err) { spinner.fail(chalk.red('Failed')); die(err.message); }
    });

  visionCmd
    .command('compare <before> <after>')
    .description('Compare two screenshots for visual differences')
    .option('--json', 'Output JSON')
    .action(async (before, after, opts) => {
      printBanner();
      const { compareImages } = await import('../local-agent/vision/VisionAnalyzer.js');
      const spinner = ora('Comparing images...').start();
      try {
        const result = compareImages(resolve(before), resolve(after));
        spinner.stop();
        if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
        console.log(chalk.bold('Visual Comparison:\n'));
        console.log(`  Before: ${result.before.path}  (${result.before.sizeKB} KB${result.before.dimensions ? ` ${result.before.dimensions.width}×${result.before.dimensions.height}` : ''})`);
        console.log(`  After:  ${result.after.path}  (${result.after.sizeKB} KB${result.after.dimensions ? ` ${result.after.dimensions.width}×${result.after.dimensions.height}` : ''})`);
        console.log(`\n  ${result.identical ? chalk.green('Identical — no visual change') : chalk.yellow(`Changed (${result.diffPct}% byte difference)`)}`);
        result.changes.forEach((c) => console.log(`  ${chalk.yellow('→')} ${c}`));
        console.log();
      } catch (err) { spinner.fail(chalk.red('Failed')); die(err.message); }
    });

  // ── knowledge (Phase 43 — Knowledge Evolution) ────────────────────────────
  const knowCmd = program
    .command('knowledge [path]')
    .description('Local knowledge evolution: promote fixes, downgrade failures, audit learning')
    .option('--project <path>', 'Path to target project');

  knowCmd
    .command('evolve [path]')
    .description('Run a knowledge evolution pass (promote/demote/expire recipes)')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { evolveKnowledge } = await import('../local-agent/knowledge/KnowledgeEvolver.js');
      const spinner = ora('Evolving knowledge base...').start();
      const result  = evolveKnowledge(targetDir);
      spinner.succeed(chalk.green('Knowledge evolution complete'));
      console.log(`  Total recipes: ${result.totalRecipes}`);
      console.log(`  Promoted:      ${result.promoted}  ${result.promotedItems.map((r) => r.id).join(', ')}`);
      console.log(`  Demoted:       ${result.demoted}   ${result.demotedItems.map((r) => r.id).join(', ')}`);
      console.log(`  Stale:         ${result.stale}     ${result.staleItems.join(', ')}`);
      console.log();
    });

  knowCmd
    .command('audit [path]')
    .description('Audit the knowledge base — confidence distribution and staleness')
    .option('--project <path>', 'Path to target project')
    .option('--json', 'Output JSON')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { auditKnowledge } = await import('../local-agent/knowledge/KnowledgeEvolver.js');
      const result = auditKnowledge(targetDir);
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      console.log(chalk.bold('Knowledge Base Audit:\n'));
      console.log(`  Total recipes:     ${result.total}`);
      console.log(`  High confidence:   ${result.highConfidence}  (≥ 0.80)`);
      console.log(`  Low confidence:    ${result.lowConfidence}   (≤ 0.25)`);
      console.log(`  Stale (>30d):      ${result.stale}`);
      console.log(`  Average confidence: ${result.averageConfidence ?? 'n/a'}`);
      if (result.topRecipes.length) {
        console.log(chalk.bold('\nTop Recipes:'));
        result.topRecipes.forEach((r) => console.log(`  ${chalk.green('★')} ${r.id.padEnd(30)} conf: ${r.confidence}  uses: ${r.uses}`));
      }
      if (result.bottomRecipes.length && result.total > 3) {
        console.log(chalk.bold('\nLow-Confidence Recipes:'));
        result.bottomRecipes.forEach((r) => console.log(`  ${chalk.red('↓')} ${r.id.padEnd(30)} conf: ${r.confidence}  uses: ${r.uses}`));
      }
      console.log();
    });

  knowCmd
    .command('refresh [path]')
    .description('Clear demoted+stale recipes and reset mis-demoted active ones')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { refreshKnowledge } = await import('../local-agent/knowledge/KnowledgeEvolver.js');
      const result = refreshKnowledge(targetDir);
      console.log(chalk.green('Knowledge refresh complete'));
      console.log(`  Cleared (demoted+stale): ${result.cleared}`);
      console.log(`  Reset (mis-demoted):     ${result.reset}\n`);
    });

  knowCmd.action(async (pathArg, opts) => {
    printBanner();
    const targetDir = resolveTarget(opts.project ?? pathArg);
    const { auditKnowledge } = await import('../local-agent/knowledge/KnowledgeEvolver.js');
    const result = auditKnowledge(targetDir);
    console.log(chalk.bold('Knowledge Base:'));
    console.log(`  Recipes: ${result.total}  High-conf: ${result.highConfidence}  Stale: ${result.stale}`);
    console.log(`\n  Subcommands: evolve | audit | refresh\n`);
  });

  // ── terminal (Phase 44) ───────────────────────────────────────────────────
  const termCmd = program
    .command('terminal')
    .description('Terminal intelligence: parse history, classify failures, recommend next steps');

  termCmd
    .command('analyze [histFile]')
    .description('Analyze terminal history for failures and dangerous commands')
    .option('--limit <n>', 'Lines to analyze', '100')
    .action(async (histFile, opts) => {
      printBanner();
      const { loadHistory, analyzeHistory } = await import('../local-agent/terminal/TerminalAnalyzer.js');
      const lines   = loadHistory(histFile ?? null);
      if (!lines.length) { console.log(chalk.yellow('No terminal history found.\n')); return; }
      const result  = analyzeHistory(lines, { limit: parseInt(opts.limit) || 100 });
      const col     = result.failures === 0 ? 'green' : result.failures < 5 ? 'yellow' : 'red';
      console.log(chalk.bold('Terminal Analysis:\n'));
      console.log(`  Commands analyzed: ${result.total}`);
      console.log(`  Failures:          ${chalk[col](result.failures)}`);
      console.log(`  Dangerous cmds:    ${result.dangerous > 0 ? chalk.red(result.dangerous) : chalk.green('0')}`);
      if (result.dangerous > 0) {
        console.log(chalk.bold.red('\nDangerous Commands Detected:'));
        result.dangerousCmds.forEach((c) => console.log(`  ${chalk.red('⚠')} ${c}`));
      }
      if (result.recentFails.length) {
        console.log(chalk.bold('\nRecent Failures:'));
        result.recentFails.forEach((f) => console.log(`  ${chalk.yellow('✗')} [${f.type}] ${f.cmd.slice(0, 80)}`));
      }
      if (result.suggestions.length) {
        console.log(chalk.bold('\nSuggested Next Commands:'));
        result.suggestions.forEach((s) => console.log(`  ${chalk.cyan('→')} ${s}`));
      }
      console.log();
    });

  termCmd
    .command('history [histFile]')
    .description('Show recent build/run commands from history')
    .option('--limit <n>', 'Lines to show', '50')
    .action(async (histFile, opts) => {
      printBanner();
      const { loadHistory, analyzeHistory } = await import('../local-agent/terminal/TerminalAnalyzer.js');
      const lines  = loadHistory(histFile ?? null);
      const result = analyzeHistory(lines, { limit: parseInt(opts.limit) || 50 });
      console.log(chalk.bold('Recent Build/Run Commands:\n'));
      if (!result.buildCmds.length) { console.log(chalk.yellow('  No build commands in recent history.\n')); return; }
      result.buildCmds.forEach((c) => console.log(`  ${chalk.gray('$')} ${c}`));
      console.log();
    });

  termCmd
    .command('summarize [histFile]')
    .description('Summarize the recent build/test session')
    .action(async (histFile) => {
      printBanner();
      const { loadHistory, summarizeSession } = await import('../local-agent/terminal/TerminalAnalyzer.js');
      const lines   = loadHistory(histFile ?? null);
      const summary = summarizeSession(lines);
      console.log(chalk.bold('Session Summary:\n'));
      summary.split('\n').forEach((l) => console.log(`  ${l}`));
      console.log();
    });

  // ── config (Phase 45) ─────────────────────────────────────────────────────
  const cfgCmd = program
    .command('config-drift')
    .description('Configuration drift detection: env mismatch, duplicate configs, stale config');

  cfgCmd
    .command('scan [path]')
    .description('Scan project for config issues')
    .option('--project <path>', 'Path to target project')
    .option('--json', 'Output JSON')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { scanConfig } = await import('../local-agent/config-drift/ConfigDriftDetector.js');
      const spinner  = ora('Scanning config files...').start();
      const result   = scanConfig(targetDir);
      spinner.stop();
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      const col = result.healthy ? 'green' : 'yellow';
      console.log(chalk.bold(`Config Scan: ${chalk[col](result.issueCount + ' issue(s)')}\n`));
      console.log(`  Configs found: ${result.foundConfigs.join(', ') || 'none'}`);
      result.issues.forEach((i) =>
        console.log(`  ${chalk.yellow('⚠')} [${i.type}] ${i.severity.toUpperCase()}  ${i.msg}`));
      if (result.healthy) console.log(chalk.green('  All configs look healthy.'));
      console.log();
    });

  cfgCmd
    .command('drift [path]')
    .description('Show env drift between .env files')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { scanConfig } = await import('../local-agent/config-drift/ConfigDriftDetector.js');
      const result  = scanConfig(targetDir);
      const drifts  = result.issues.filter((i) => i.type === 'env_drift' || i.type === 'env_extra');
      if (!drifts.length) { console.log(chalk.green('No env drift detected.\n')); return; }
      console.log(chalk.bold('Env Drift:\n'));
      drifts.forEach((d) => console.log(`  ${chalk.yellow('⚠')} ${d.msg}`));
      console.log();
    });

  cfgCmd
    .command('compare <pathA> <pathB>')
    .description('Compare config files between two directories')
    .option('--json', 'Output JSON')
    .action(async (pathA, pathB, opts) => {
      printBanner();
      const { compareConfigDirs } = await import('../local-agent/config-drift/ConfigDriftDetector.js');
      const result = compareConfigDirs(resolve(pathA), resolve(pathB));
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      console.log(chalk.bold(`Config Compare: ${pathA} vs ${pathB}\n`));
      if (!result.drifts.length) { console.log(chalk.green('  No config drift found.\n')); return; }
      result.drifts.forEach((d) =>
        console.log(`  ${chalk.yellow('⚠')} ${d.file.padEnd(28)} [${d.type}]`));
      console.log();
    });

  // ── fs (Phase 46) ─────────────────────────────────────────────────────────
  const fsCmd = program
    .command('fs')
    .description('Filesystem intelligence: orphans, duplicates, oversized folders, junk');

  fsCmd
    .command('scan [path]')
    .description('Scan filesystem for health issues')
    .option('--project <path>', 'Path to target project')
    .option('--json', 'Output JSON')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { scanFilesystem } = await import('../local-agent/fsint/FilesystemIntelligence.js');
      const spinner = ora('Scanning filesystem...').start();
      const result  = scanFilesystem(targetDir);
      spinner.stop();
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      console.log(chalk.bold(`Filesystem Scan: ${result.totalFiles} files  ${result.totalMB} MB total\n`));
      console.log(`  Junk files:     ${result.junkFiles.length}`);
      console.log(`  Orphan files:   ${result.orphanFiles.length}`);
      console.log(`  Oversized dirs: ${result.oversizedDirs.length}`);
      console.log(`  Stale artifacts: ${result.staleArtifacts.length}`);
      if (result.oversizedDirs.length) {
        console.log(chalk.bold('\nOversized Directories:'));
        result.oversizedDirs.forEach((d) => console.log(`  ${chalk.yellow('⚠')} ${d.dir}  ${d.sizeMB} MB`));
      }
      if (result.staleArtifacts.length) {
        console.log(chalk.bold('\nStale Build Artifacts:'));
        result.staleArtifacts.forEach((a) => console.log(`  ${chalk.gray('○')} ${a.dir}  ${a.sizeMB} MB`));
      }
      console.log();
    });

  fsCmd
    .command('cleanup-plan [path]')
    .description('Generate a cleanup plan for junk and stale artifacts')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { scanFilesystem, buildCleanupPlan } = await import('../local-agent/fsint/FilesystemIntelligence.js');
      const spinner = ora('Building cleanup plan...').start();
      const scan    = scanFilesystem(targetDir);
      const plan    = buildCleanupPlan(scan);
      spinner.stop();
      console.log(chalk.bold(`Cleanup Plan: ${plan.totalSteps} action(s) — saves ${plan.savedMB} MB\n`));
      plan.steps.slice(0, 20).forEach((s) =>
        console.log(`  ${chalk.gray('[' + s.action + ']')}  ${s.path}  ${chalk.gray('(' + s.reason + ')')}`));
      console.log(`\n  ${chalk.gray(plan.note)}\n`);
    });

  fsCmd
    .command('duplicates [path]')
    .description('Find duplicate files by content hash')
    .option('--project <path>', 'Path to target project')
    .option('--min-size <bytes>', 'Minimum file size', '1024')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { findDuplicates } = await import('../local-agent/fsint/FilesystemIntelligence.js');
      const spinner = ora('Finding duplicates...').start();
      const groups  = findDuplicates(targetDir, { minSizeBytes: parseInt(opts.minSize) || 1024 });
      spinner.stop();
      if (!groups.length) { console.log(chalk.green('No duplicate files found.\n')); return; }
      const totalWaste = groups.reduce((s, g) => s + g.sizeBytes * (g.count - 1), 0);
      console.log(chalk.bold(`Duplicates: ${groups.length} group(s)  wasted: ${formatBytes(totalWaste)}\n`));
      groups.slice(0, 10).forEach((g) => {
        console.log(`  ${chalk.yellow('≡')} ${formatBytes(g.sizeBytes)} × ${g.count}  ${chalk.gray(g.hash.slice(0, 8) + '...')}`);
        g.paths.forEach((p) => console.log(`    ${chalk.gray(p)}`));
      });
      console.log();
    });

  // ── standards (Phase 47) ──────────────────────────────────────────────────
  const stdCmd = program
    .command('standards')
    .description('Coding standards enforcement: naming, architecture, test coverage, commit hooks');

  stdCmd
    .command('check [path]')
    .description('Run all coding standards checks')
    .option('--project <path>', 'Path to target project')
    .option('--json', 'Output JSON')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { checkStandards } = await import('../local-agent/standards/StandardsChecker.js');
      const spinner  = ora('Checking coding standards...').start();
      const result   = checkStandards(targetDir);
      spinner.stop();
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      const col = result.healthy ? 'green' : result.findings < 10 ? 'yellow' : 'red';
      console.log(chalk.bold(`Standards Check: ${result.totalFiles} files  ${chalk[col](result.findings + ' finding(s)')}\n`));
      Object.entries(result.byRule).forEach(([rule, count]) =>
        console.log(`  ${chalk.yellow('⚠')} ${rule.padEnd(35)} ${count} file(s)`));
      if (result.details.length) {
        console.log(chalk.bold('\nTop Findings:'));
        result.details.slice(0, 10).forEach((f) =>
          console.log(`  ${chalk.gray(f.ruleId.padEnd(35))} ${f.file}`));
      }
      if (result.healthy) console.log(chalk.green('  All standards met.'));
      console.log();
    });

  stdCmd
    .command('fix-plan [path]')
    .description('Generate fix suggestions for standards violations')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { checkStandards, buildFixPlan } = await import('../local-agent/standards/StandardsChecker.js');
      const result = checkStandards(targetDir);
      const plan   = buildFixPlan(result);
      console.log(chalk.bold('Standards Fix Plan:\n'));
      if (!plan.steps.length) { console.log(chalk.green('  No fixes needed.\n')); return; }
      plan.steps.forEach((s) =>
        console.log(`  ${chalk.cyan('[' + s.ruleId + ']')} (${s.count} issues)\n    ${chalk.gray('→')} ${s.suggestion}\n`));
    });

  stdCmd
    .command('report [path]')
    .description('Standards compliance report')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { checkStandards } = await import('../local-agent/standards/StandardsChecker.js');
      const result  = checkStandards(targetDir);
      const score   = Math.max(0, 100 - Math.round((result.findings / Math.max(result.totalFiles, 1)) * 100));
      const col     = score >= 90 ? 'green' : score >= 70 ? 'yellow' : 'red';
      console.log(chalk.bold('Standards Compliance Report:\n'));
      console.log(`  Files checked:  ${result.totalFiles}`);
      console.log(`  Findings:       ${result.findings}`);
      console.log(`  Compliance:     ${chalk[col](score + '%')}`);
      console.log();
    });

  // ── patch-sim (Phase 48) ──────────────────────────────────────────────────
  const patchSimCmd = program
    .command('patch-sim')
    .description('Patch simulation engine: estimate regression risk, test/API impact before apply');

  patchSimCmd
    .command('simulate <patchId> [path]')
    .description('Simulate patch impact before applying')
    .option('--project <path>', 'Path to target project')
    .option('--json', 'Output JSON')
    .action(async (patchId, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { simulatePatch } = await import('../local-agent/patch-sim/PatchSimulator.js');
      const spinner  = ora(`Simulating ${patchId}...`).start();
      const result   = simulatePatch(targetDir, patchId);
      spinner.stop();
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      const rCol = result.regressionRisk.level === 'critical' ? 'red'
                 : result.regressionRisk.level === 'high' ? 'yellow' : 'green';
      console.log(chalk.bold(`Patch Simulation: ${patchId}\n`));
      if (!result.found) console.log(chalk.yellow('  Patch not found — showing generic simulation\n'));
      console.log(`  Files affected:   ${result.fileCount}`);
      console.log(`  Regression risk:  ${chalk[rCol](result.regressionRisk.level.toUpperCase())} (score: ${result.regressionRisk.score})`);
      console.log(`  Tests affected:   ${result.testCount}`);
      console.log(`  API impact:       ${result.apiImpact.length > 0 ? result.apiImpact.join(', ') : 'none'}`);
      console.log(`  Rollback:         ${result.rollback.complexity} — ${result.rollback.reason}`);
      console.log(chalk.bold('\nRisk Factors:'));
      result.regressionRisk.factors.slice(0, 5).forEach((f) => console.log(`  ${chalk.gray('→')} ${f}`));
      console.log(`\n  ${chalk[rCol](result.recommendation)}\n`);
    });

  patchSimCmd
    .command('impact <patchId> [path]')
    .description('Show patch impact on tests and APIs')
    .option('--project <path>', 'Path to target project')
    .action(async (patchId, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { simulatePatch } = await import('../local-agent/patch-sim/PatchSimulator.js');
      const result = simulatePatch(targetDir, patchId);
      console.log(chalk.bold(`Patch Impact: ${patchId}\n`));
      console.log(chalk.bold('Affected Tests:'));
      if (result.affectedTests.length) result.affectedTests.forEach((t) => console.log(`  ${chalk.cyan('→')} ${t}`));
      else console.log('  (none detected)');
      console.log(chalk.bold('\nAffected APIs/Routes:'));
      if (result.apiImpact.length) result.apiImpact.forEach((a) => console.log(`  ${chalk.cyan('→')} ${a}`));
      else console.log('  (none detected)');
      console.log();
    });

  // ── mode (Phase 49) ───────────────────────────────────────────────────────
  const modeCmd = program
    .command('mode')
    .description('Agent operational modes and personality');

  modeCmd
    .command('list')
    .description('List all available agent modes')
    .action(async () => {
      printBanner();
      const { listModes } = await import('../local-agent/modes/AgentModes.js');
      const modes = listModes();
      console.log(chalk.bold('Agent Modes:\n'));
      modes.forEach((m) => {
        console.log(`  ${chalk[m.color]('●')} ${chalk.bold(m.name.padEnd(28))} [${m.id}]`);
        console.log(`    ${chalk.gray(m.description)}`);
        console.log(`    Retry: ${m.retryDepth}  Patch: ${m.patchAggression}  QA: ${m.qaStrictness}  Verbose: ${m.verbosity}`);
      });
      console.log();
    });

  modeCmd
    .command('set <modeId> [path]')
    .description('Set the active agent mode')
    .option('--project <path>', 'Path to target project')
    .action(async (modeId, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { setMode } = await import('../local-agent/modes/AgentModes.js');
      try {
        const mode = setMode(targetDir, modeId);
        console.log(chalk.green(`Mode set: ${chalk.bold(mode.name)}`));
        console.log(`  ${chalk.gray(mode.description)}\n`);
      } catch (err) { die(err.message); }
    });

  modeCmd
    .command('status [path]')
    .description('Show current agent mode')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { getMode } = await import('../local-agent/modes/AgentModes.js');
      const mode = getMode(targetDir);
      console.log(chalk.bold(`Current Mode: ${chalk[mode.color](mode.name)}\n`));
      console.log(`  ${chalk.gray(mode.description)}`);
      console.log(`  Retry depth:    ${mode.retryDepth}`);
      console.log(`  Patch style:    ${mode.patchAggression}`);
      console.log(`  QA strictness:  ${mode.qaStrictness}`);
      console.log(`  Verbosity:      ${mode.verbosity}`);
      console.log(`  Risk tolerance: ${mode.riskTolerance}\n`);
    });

  // ── memory (Phase 50 — Memory Visualizer) ─────────────────────────────────
  const memCmd = program
    .command('memory-viz')
    .description('Engineering memory visualizer: trends, unstable modules, patch chains');

  memCmd
    .command('graph [path]')
    .description('Show memory graph: patch chains, QA trend, unstable modules')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { qaTrendChart, patchChainSummary } = await import('../local-agent/memviz/MemoryVisualizer.js');
      const qa      = qaTrendChart(targetDir);
      const patches = patchChainSummary(targetDir);
      console.log(chalk.bold('QA Pass Rate (last 14 days):\n'));
      console.log(qa.chart || '  (no QA events recorded)');
      console.log(chalk.bold('\nPatch Chain Outcomes:\n'));
      console.log(patches.chart);
      console.log(`\n  Success rate: ${patches.successRate ?? 'n/a'}%\n`);
    });

  memCmd
    .command('trends [path]')
    .description('Show regression bug type trends')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { bugTrends } = await import('../local-agent/memviz/MemoryVisualizer.js');
      const result = bugTrends(targetDir);
      console.log(chalk.bold(`Bug Trends (${result.total} total regressions):\n`));
      console.log(result.chart || '  (no regression events)');
      console.log();
    });

  memCmd
    .command('unstable [path]')
    .description('Show most-changed (unstable) modules')
    .option('--project <path>', 'Path to target project')
    .option('--top <n>', 'Top N files', '10')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { unstableModules } = await import('../local-agent/memviz/MemoryVisualizer.js');
      const result = unstableModules(targetDir, { topN: parseInt(opts.top) || 10 });
      console.log(chalk.bold('Most Unstable Modules:\n'));
      if (!result.data.length) { console.log(chalk.yellow('  No file change events recorded.\n')); return; }
      console.log(result.chart);
      console.log();
    });

  // ── correlate (Phase 51) ──────────────────────────────────────────────────
  const corrCmd = program
    .command('correlate')
    .description('Root cause correlation: map multiple failures to a single cause');

  corrCmd
    .command('failures [descriptions...]')
    .description('Correlate failure descriptions to a root cause')
    .option('--auto', 'Auto-correlate from recent timeline')
    .option('--project <path>', 'Path to target project')
    .action(async (descriptions, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project);
      const { correlateFailures, correlateTimelineFailures } = await import('../local-agent/correlate/RootCauseCorrelator.js');
      let result;
      if (opts.auto || !descriptions.length) {
        result = correlateTimelineFailures(targetDir);
      } else {
        result = correlateFailures(descriptions);
      }
      console.log(chalk.bold('Root Cause Correlation:\n'));
      console.log(`  Symptoms detected: ${result.symptoms.join(', ') || 'none'}`);
      if (result.message) { console.log(chalk.yellow(`  ${result.message}\n`)); return; }
      if (!result.topCause) { console.log(chalk.yellow('  No matching root cause pattern found.\n')); return; }
      const top = result.topCause;
      console.log(chalk.bold(`\nTop Cause: ${chalk.red(top.rootCause)} (confidence: ${top.confidence}%)`));
      console.log(`  Matching symptoms: ${top.hits.join(', ')}`);
      console.log(`  Remedy: ${chalk.cyan(top.remedy)}`);
      if (result.matches.length > 1) {
        console.log(chalk.bold('\nOther Possible Causes:'));
        result.matches.slice(1).forEach((m) =>
          console.log(`  ${chalk.gray('○')} ${m.rootCause} (${m.confidence}%)`));
      }
      console.log();
    });

  corrCmd
    .command('build-runtime [path]')
    .description('Correlate build and runtime failures in timeline')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { correlateBuildRuntime } = await import('../local-agent/correlate/RootCauseCorrelator.js');
      const result = correlateBuildRuntime(targetDir);
      console.log(chalk.bold('Build–Runtime Correlation:\n'));
      console.log(`  Build failures:      ${result.buildFailures}`);
      console.log(`  Regressions:         ${result.regressions}`);
      console.log(`  Correlated pairs:    ${result.correlatedPairs}`);
      if (result.topCause) {
        console.log(chalk.bold(`\nRoot Cause: ${chalk.red(result.topCause.rootCause)}`));
        console.log(`  Remedy: ${chalk.cyan(result.topCause.remedy)}`);
      } else {
        console.log(chalk.green('\n  No strong build-regression correlation found.'));
      }
      console.log();
    });

  // ── playbooks (Phase 52) ──────────────────────────────────────────────────
  const pbCmd = program
    .command('playbooks')
    .description('Engineering playbooks: standard workflows for releases, migrations, incidents');

  pbCmd
    .command('list')
    .description('List all available playbooks')
    .action(async () => {
      printBanner();
      const { BUILTIN_PLAYBOOKS } = await import('../local-agent/playbooks/PlaybookLibrary.js');
      console.log(chalk.bold(`Playbooks (${BUILTIN_PLAYBOOKS.length}):\n`));
      BUILTIN_PLAYBOOKS.forEach((pb) => {
        console.log(`  ${chalk.cyan(pb.id.padEnd(26))} ${chalk.bold(pb.name)}`);
        console.log(`    ${chalk.gray(pb.description)}`);
        console.log(`    Tags: ${pb.tags.join(', ')}  Steps: ${pb.steps.length}`);
      });
      console.log(`\n  Run: local-agent playbooks run <id>\n`);
    });

  pbCmd
    .command('run <query>')
    .description('Show a playbook run plan (dry-run)')
    .option('--json', 'Output JSON')
    .action(async (query, opts) => {
      printBanner();
      const { planRun } = await import('../local-agent/playbooks/PlaybookRunner.js');
      const plan = planRun(query);
      if (!plan) { die(`Playbook not found: "${query}". Run: local-agent playbooks list`); return; }
      if (opts.json) { console.log(JSON.stringify(plan, null, 2)); return; }
      console.log(chalk.bold(`Playbook: ${plan.name}\n`));
      plan.steps.forEach((s) => {
        console.log(`  ${chalk.cyan(String(s.seq).padStart(2, '0'))}. [${chalk.gray(s.phase.padEnd(12))}] ${s.desc}`);
        console.log(`      ${chalk.gray('$')} ${s.cmd}`);
      });
      console.log(`\n  ${chalk.gray(plan.note)}\n`);
    });

  pbCmd
    .command('export <targetDir>')
    .description('Export all playbooks as JSON files to a directory')
    .action(async (targetDir) => {
      printBanner();
      const { exportPlaybooks } = await import('../local-agent/playbooks/PlaybookRunner.js');
      const result = exportPlaybooks(resolve(targetDir));
      console.log(chalk.green(`Exported ${result.exported} playbooks to: ${result.path}\n`));
    });

  // ── os (Phase 53 — Engineering OS) ────────────────────────────────────────
  program
    .command('os [path]')
    .description('Engineering OS — unified dashboard for all local agent systems')
    .option('--project <path>', 'Path to target project')
    .option('--json', 'Output JSON')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);

      // Import all subsystems
      const [
        { getSummary },
        { fullAnalytics },
        { loadGovernance },
        { getMode },
        { snapshot, checkThresholds },
        { listIncidents },
        { auditKnowledge },
        { listUsers },
        { BUILTIN_PLAYBOOKS },
        { scanConfig },
      ] = await Promise.all([
        import('../local-agent/timeline/TimelineEngine.js'),
        import('../local-agent/analytics/AnalyticsEngine.js'),
        import('../local-agent/governance/GovernanceEngine.js'),
        import('../local-agent/modes/AgentModes.js'),
        import('../local-agent/resources/ResourceMonitor.js'),
        import('../local-agent/incident/IncidentManager.js'),
        import('../local-agent/knowledge/KnowledgeEvolver.js'),
        import('../local-agent/rbac/RBACManager.js'),
        import('../local-agent/playbooks/PlaybookLibrary.js'),
        import('../local-agent/config-drift/ConfigDriftDetector.js'),
      ]);

      const [timeline, analytics, governance, mode, resources, incidents, knowledge, users, config] = await Promise.all([
        Promise.resolve(getSummary(targetDir)),
        Promise.resolve(fullAnalytics(targetDir)),
        Promise.resolve(loadGovernance(targetDir)),
        Promise.resolve(getMode(targetDir)),
        Promise.resolve(snapshot()),
        Promise.resolve(listIncidents(targetDir, { status: 'open' })),
        Promise.resolve(auditKnowledge(targetDir)),
        Promise.resolve(listUsers(targetDir)),
        Promise.resolve(scanConfig(targetDir)),
      ]);

      const resHealth   = checkThresholds(resources);
      const qaPassRate  = analytics.qa.passRate;
      const qaCol       = qaPassRate === null ? 'gray' : qaPassRate >= 80 ? 'green' : qaPassRate >= 50 ? 'yellow' : 'red';

      if (opts.json) {
        console.log(JSON.stringify({ timeline, analytics, governance, mode: mode.id, resources, incidents: incidents.length, knowledge, users: users.length, configIssues: config.issueCount }, null, 2));
        return;
      }

      const W = 56;
      const HR = '─'.repeat(W);
      const box = (title, content) => {
        console.log(chalk.gray(`┌─ ${title} ${'─'.repeat(Math.max(0, W - title.length - 3))}┐`));
        content.forEach((line) => console.log(chalk.gray('│') + ' ' + line.padEnd(W - 1) + chalk.gray('│')));
        console.log(chalk.gray('└' + '─'.repeat(W) + '┘'));
      };

      console.log(chalk.bold.cyan(`\n  ╔${'═'.repeat(W)}╗`));
      console.log(chalk.bold.cyan(`  ║${'  LOCAL AI ENGINEERING OS'.padStart(Math.floor(W/2) + 13).padEnd(W)}║`));
      console.log(chalk.bold.cyan(`  ╚${'═'.repeat(W)}╝\n`));

      // Row 1: Mode + Resources
      box('AGENT MODE', [
        `  Mode: ${chalk.bold(mode.name)} [${mode.id}]`,
        `  Risk tolerance: ${mode.riskTolerance}   QA: ${mode.qaStrictness}`,
      ]);

      box('RESOURCES', [
        `  CPU: ${chalk[resHealth.healthy ? 'green' : 'yellow'](resources.cpuPct + '%')}   RAM: ${resources.rssMB} MB   Disk: ${resources.diskFreeGB ?? 'n/a'} GB free`,
        `  Health: ${resHealth.healthy ? chalk.green('✓ OK') : chalk.yellow(resHealth.warnings.join('; '))}`,
      ]);

      // Row 2: QA + Analytics
      box('QA + ANALYTICS', [
        `  QA pass rate:    ${chalk[qaCol]((qaPassRate ?? 'n/a') + '%')}`,
        `  Regressions:     ${analytics.regressions.total}   Patches applied: ${analytics.patches.applied}`,
        `  Fix success:     ${analytics.patches.fixSuccessRate ?? 'n/a'}%`,
      ]);

      box('TIMELINE', [
        `  Total events:   ${timeline.totalEvents}   QA runs: ${timeline.qaRuns}`,
        `  Regressions:    ${timeline.regressions}`,
        `  Most unstable:  ${timeline.unstable[0]?.file ?? 'none'}`,
      ]);

      // Row 3: Incidents + Governance
      box('INCIDENTS', [
        `  Open incidents: ${incidents.length > 0 ? chalk.red(incidents.length) : chalk.green('0')}`,
        incidents.length
          ? `  Latest: [${incidents[0].severity}] ${incidents[0].title.slice(0, 44)}`
          : '  All clear.',
      ]);

      box('GOVERNANCE', [
        `  Patch approval: ${governance.patchApprovalRequired ? chalk.yellow('required') : chalk.green('auto')}`,
        `  Risk threshold: ${governance.riskThreshold}   Offline: ${governance.modelPolicy.requireOffline ? chalk.green('YES') : chalk.red('NO')}`,
        `  Config issues:  ${config.issueCount > 0 ? chalk.yellow(config.issueCount) : chalk.green('0')}`,
      ]);

      // Row 4: Knowledge + Security + RBAC
      box('KNOWLEDGE', [
        `  Recipes: ${knowledge.total}   High-conf: ${knowledge.highConfidence}   Stale: ${knowledge.stale}`,
        `  Avg confidence: ${knowledge.averageConfidence ?? 'n/a'}`,
      ]);

      box('TEAM + ACCESS', [
        `  Users:     ${users.length}`,
        `  Playbooks: ${BUILTIN_PLAYBOOKS.length} built-in`,
      ]);

      console.log(chalk.bold('\n  Quick Commands:'));
      console.log(`  ${chalk.cyan('local-agent heal')}              Self-healing`);
      console.log(`  ${chalk.cyan('local-agent qa')}                Run QA`);
      console.log(`  ${chalk.cyan('local-agent analytics')}         Engineering metrics`);
      console.log(`  ${chalk.cyan('local-agent incident create')}   New incident`);
      console.log(`  ${chalk.cyan('local-agent playbooks list')}    Available playbooks`);
      console.log(`  ${chalk.cyan('local-agent governance status')} Policy status`);
      console.log(`  ${chalk.cyan('local-agent vault scan')}        Secret detection`);
      console.log(`  ${chalk.cyan('local-agent correlate failures --auto')} Root cause\n`);
    });

  // ── logs (Engineering Build Log System) ─────────────────────────────────
  const logsCmd = program
    .command('logs')
    .description('Engineering Build Log — single source of truth for project state');

  logsCmd
    .command('latest [path]')
    .description('Show latest.md — current project state (single source of truth)')
    .option('--project <path>', 'Path to target project')
    .option('--raw', 'Print raw Markdown without paging')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { readLatest, generateLatest, initLogStructure } = await import('../local-agent/eng-log/EngineeringLogManager.js');
      initLogStructure(targetDir);
      let content = readLatest(targetDir);
      if (!content) {
        const spinner = ora('Generating latest.md...').start();
        generateLatest(targetDir);
        spinner.succeed('latest.md generated');
        content = readLatest(targetDir);
      }
      if (!content) { die('Failed to read latest.md'); return; }
      // Render with simple markdown formatting
      console.log('\n' + content.split('\n').map((line) => {
        if (line.startsWith('# '))  return chalk.bold.cyan(line);
        if (line.startsWith('## ')) return chalk.bold.yellow('\n' + line);
        if (line.startsWith('### ')) return chalk.bold(line);
        if (line.startsWith('- **')) return '  ' + chalk.cyan(line.trim());
        if (line.startsWith('- '))  return '  ' + chalk.gray('•') + ' ' + line.slice(2);
        if (line.startsWith('1. ') || /^\d+\. /.test(line)) return '  ' + chalk.cyan(line.trim());
        if (line.startsWith('> '))  return chalk.italic.gray(line);
        if (line.startsWith('`'))   return chalk.green(line);
        return line;
      }).join('\n') + '\n');
    });

  logsCmd
    .command('checkpoints [path]')
    .description('List recent checkpoints')
    .option('--project <path>', 'Path to target project')
    .option('--show <id>', 'Show a specific checkpoint by ID or number')
    .option('--limit <n>', 'Max checkpoints to list', '10')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { listCheckpoints, readCheckpoint } = await import('../local-agent/eng-log/CheckpointWriter.js');
      if (opts.show) {
        const content = readCheckpoint(targetDir, opts.show);
        if (!content) { die(`Checkpoint not found: ${opts.show}`); return; }
        console.log('\n' + content + '\n');
        return;
      }
      const checkpoints = listCheckpoints(targetDir, { limit: parseInt(opts.limit) || 10 });
      if (!checkpoints.length) {
        console.log(chalk.yellow('No checkpoints yet. Run: local-agent logs checkpoint\n'));
        return;
      }
      console.log(chalk.bold(`Checkpoints (${checkpoints.length}):\n`));
      checkpoints.forEach((c) => console.log(`  ${chalk.cyan(c.id)}  ${chalk.gray(c.preview)}`));
      console.log(`\n  View: local-agent logs checkpoints --show <id>\n`);
    });

  logsCmd
    .command('checkpoint [path]')
    .description('Write a new checkpoint for the current progress')
    .option('--project <path>', 'Path to target project')
    .option('--phase <phase>', 'Current phase name')
    .option('--title <title>', 'Checkpoint title')
    .option('--qa <result>', 'QA result (PASS/FAIL/n/a)', 'n/a')
    .option('--next <step>', 'Next step description')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { writeCheckpoint } = await import('../local-agent/eng-log/CheckpointWriter.js');
      const { initLogStructure } = await import('../local-agent/eng-log/EngineeringLogManager.js');
      initLogStructure(targetDir);
      const spinner = ora('Writing checkpoint...').start();
      const result  = writeCheckpoint(targetDir, {
        phase:        opts.phase ?? 'Current Phase',
        title:        opts.title ?? `Checkpoint ${new Date().toISOString().slice(0, 10)}`,
        implemented:  [],
        filesChanged: [],
        risks:        [],
        decisions:    [],
        rollbackNotes: 'Standard git revert applies.',
        qaResult:     opts.qa,
        nextStep:     opts.next ?? 'See latest.md for current priorities.',
      });
      spinner.succeed(chalk.green(`Checkpoint written: ${result.id}`));
      console.log(`  Path: ${result.path}\n`);
    });

  logsCmd
    .command('summary [path]')
    .description('Generate a build/QA summary')
    .option('--project <path>', 'Path to target project')
    .option('--phase <phase>', 'Phase name')
    .option('--qa <result>', 'QA result', 'PASS')
    .option('--score <n>', 'QA score (0-100)')
    .option('--errors <list>', 'Comma-separated errors')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { generateBuildSummary } = await import('../local-agent/eng-log/BuildSummaryGenerator.js');
      const { initLogStructure }     = await import('../local-agent/eng-log/EngineeringLogManager.js');
      initLogStructure(targetDir);
      const result = generateBuildSummary(targetDir, {
        commands:       [],
        durationMs:     0,
        errors:         opts.errors ? opts.errors.split(',').map((e) => e.trim()) : [],
        fixes:          [],
        patches:        [],
        qaResult:       opts.qa ?? 'PASS',
        qaScore:        opts.score ? parseInt(opts.score) : undefined,
        phase:          opts.phase ?? 'current',
        recommendation: 'See latest.md for next steps.',
      });
      console.log(chalk.green(`Build summary written: ${result.filename}`));
      console.log(`  Path: ${result.path}\n`);
    });

  logsCmd
    .command('incidents [path]')
    .description('List engineering log incidents')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { listIncidents } = await import('../local-agent/eng-log/IncidentRecorder.js');
      const incidents = listIncidents(targetDir);
      if (!incidents.length) { console.log(chalk.green('No incidents in engineering log.\n')); return; }
      console.log(chalk.bold(`Engineering Log Incidents (${incidents.length}):\n`));
      incidents.forEach((i) => {
        const col = i.severity === 'critical' ? 'red' : i.severity === 'high' ? 'yellow' : 'gray';
        console.log(`  ${chalk[col](i.incidentId.padEnd(14))} [${i.severity.padEnd(8)}] ${i.title}`);
        console.log(`    Root: ${i.rootCause.slice(0, 70)}`);
      });
      console.log();
    });

  logsCmd
    .command('architecture [path]')
    .description('Show architecture documentation')
    .option('--project <path>', 'Path to target project')
    .option('--file <name>', 'system-architecture|module-map|dependency-map|runtime-flow|security-model')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { writeArchitectureDocs, initLogStructure } = await import('../local-agent/eng-log/EngineeringLogManager.js');
      initLogStructure(targetDir);
      writeArchitectureDocs(targetDir);
      const { join: _j } = await import('path');
      const { existsSync: _ex, readFileSync: _rf } = await import('fs');
      const archDir  = _j(targetDir, '.local-agent', 'engineering-log', 'architecture');
      const fileName = (opts.file ?? 'system-architecture') + '.md';
      const filePath = _j(archDir, fileName);
      if (_ex(filePath)) {
        console.log('\n' + _rf(filePath, 'utf8') + '\n');
      } else {
        const files = ['system-architecture', 'module-map', 'dependency-map', 'runtime-flow', 'security-model'];
        console.log(chalk.bold('Architecture Docs:\n'));
        files.forEach((f) => console.log(`  ${chalk.cyan(f)}`));
        console.log(`\n  View: local-agent logs architecture --file <name>\n`);
      }
    });

  logsCmd
    .command('decision [path]')
    .description('Record an engineering decision')
    .option('--project <path>', 'Path to target project')
    .option('--title <title>', 'Decision title')
    .option('--reason <reason>', 'Reason for the decision')
    .option('--impact <impact>', 'Impact of the decision')
    .option('--risk <risk>', 'Risk level: low|medium|high', 'low')
    .action(async (pathArg, opts) => {
      printBanner();
      if (!opts.title || !opts.reason || !opts.impact) {
        die('Required: --title, --reason, --impact');
        return;
      }
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { recordDecision } = await import('../local-agent/eng-log/DecisionTracker.js');
      const { initLogStructure } = await import('../local-agent/eng-log/EngineeringLogManager.js');
      initLogStructure(targetDir);
      const d = recordDecision(targetDir, {
        title:  opts.title,
        reason: opts.reason,
        impact: opts.impact,
        risk:   opts.risk ?? 'low',
      });
      console.log(chalk.green(`Decision recorded: ${d.decisionId}`));
      console.log(`  ${chalk.bold(d.title)}\n`);
    });

  logsCmd
    .command('update [path]')
    .description('Regenerate latest.md with current project state')
    .option('--project <path>', 'Path to target project')
    .option('--phase <phase>', 'Set current phase')
    .option('--qa <status>', 'Latest QA status string')
    .option('--security <status>', 'Latest security status string')
    .option('--priority <items>', 'Comma-separated priorities')
    .option('--complete <items>', 'Comma-separated completed items')
    .option('--in-progress <items>', 'Comma-separated in-progress items')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { initLogStructure, generateLatest, writeArchitectureDocs } = await import('../local-agent/eng-log/EngineeringLogManager.js');
      const { setCurrentPhase, markCompleted, addInProgress, setPriorities, loadProgress, saveProgress } = await import('../local-agent/eng-log/ProgressTracker.js');
      initLogStructure(targetDir);

      const spinner = ora('Updating engineering log...').start();

      if (opts.phase) setCurrentPhase(targetDir, opts.phase);
      if (opts.priority) setPriorities(targetDir, opts.priority.split(',').map((s) => s.trim()));
      if (opts.complete) {
        for (const item of opts.complete.split(',')) markCompleted(targetDir, item.trim());
      }
      if (opts.inProgress) {
        const p = loadProgress(targetDir);
        p.inProgress = opts.inProgress.split(',').map((s) => s.trim());
        saveProgress(targetDir, p);
      }

      writeArchitectureDocs(targetDir);
      const latestPath = generateLatest(targetDir, {
        qaStatus:       opts.qa,
        securityStatus: opts.security,
      });

      spinner.succeed(chalk.green('Engineering log updated'));
      console.log(`  latest.md → ${latestPath}`);
      console.log(`  Architecture docs → .local-agent/engineering-log/architecture/\n`);
    });

  logsCmd
    .command('file-purpose [path]')
    .description('Show or search the file purpose index (log-first policy)')
    .option('--project <path>', 'Path to target project')
    .option('--search <query>', 'Search file purpose index by keyword')
    .option('--rebuild', 'Rebuild the index from source')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { loadFilePurposeIndex, buildFilePurposeIndex, searchFilePurpose } = await import('../local-agent/eng-log/FilePurposeIndexer.js');
      const { initLogStructure } = await import('../local-agent/eng-log/EngineeringLogManager.js');
      initLogStructure(targetDir);

      if (opts.rebuild) {
        const spinner = ora('Rebuilding file purpose index...').start();
        buildFilePurposeIndex(targetDir);
        spinner.succeed('File purpose index rebuilt');
      }

      if (opts.search) {
        const results = searchFilePurpose(targetDir, opts.search, { limit: 15 });
        if (!results.length) {
          console.log(chalk.yellow(`No files found matching: "${opts.search}"\n`));
          return;
        }
        console.log(chalk.bold(`File Purpose Search: "${opts.search}" (${results.length} results)\n`));
        results.forEach((r) => {
          console.log(`  ${chalk.cyan(r.file)}`);
          console.log(`    → ${chalk.gray(r.purpose)}`);
          console.log(`    Category: ${r.category} | Phase: ${r.phase} | Score: ${r.score}`);
          console.log();
        });
        return;
      }

      const index = loadFilePurposeIndex(targetDir);
      const entries = Object.entries(index);
      console.log(chalk.bold(`File Purpose Index (${entries.length} files)\n`));
      console.log(chalk.gray('  Use --search <keyword> to filter. Example: --search "QA"\n'));

      const byCategory = {};
      for (const [file, info] of entries) {
        const cat = info.category ?? 'other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push({ file, ...info });
      }

      for (const [cat, files] of Object.entries(byCategory).sort()) {
        console.log(chalk.bold.yellow(`\n  [${cat}]`));
        files.forEach((f) => {
          console.log(`    ${chalk.cyan(f.file)}`);
          console.log(`      → ${chalk.gray(f.purpose)}`);
        });
      }
      console.log();
    });

  logsCmd
    .command('current-state [path]')
    .description('Compact current engineering state snapshot')
    .option('--project <path>', 'Path to target project')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const { loadProgress }                           = await import('../local-agent/eng-log/ProgressTracker.js');
      const { listKnownIssues, listBlockers, listRisks } = await import('../local-agent/eng-log/EngineeringStateTracker.js');
      const { listCheckpoints }                        = await import('../local-agent/eng-log/CheckpointWriter.js');
      const { listIncidents }                          = await import('../local-agent/eng-log/IncidentRecorder.js');
      const { getContextPriority }                     = await import('../local-agent/eng-log/ContextPriorityManager.js');

      const progress    = loadProgress(targetDir);
      const issues      = listKnownIssues(targetDir);
      const blockers    = listBlockers(targetDir);
      const risks       = listRisks(targetDir).filter((r) => r.status !== 'mitigated');
      const checkpoints = listCheckpoints(targetDir, { limit: 3 });
      const incidents   = listIncidents(targetDir).filter((i) => i.status === 'open');
      const ctxPriority = getContextPriority(targetDir);

      console.log(chalk.bold.cyan('Current Engineering State\n'));
      console.log(`  ${chalk.bold('Phase:')}       ${progress.currentPhase ?? 'not set'}`);
      console.log(`  ${chalk.bold('In Progress:')} ${progress.inProgress.length ? progress.inProgress.join(', ') : 'none'}`);
      console.log(`  ${chalk.bold('Priorities:')}  ${progress.priorities.length ? progress.priorities[0] : 'none set'}`);
      console.log();

      console.log(chalk.bold('Status:'));
      console.log(`  Known Issues:     ${issues.length ? chalk.yellow(issues.length) : chalk.green('0')}`);
      console.log(`  Active Blockers:  ${blockers.length ? chalk.red(blockers.length) : chalk.green('0')}`);
      console.log(`  Open Risks:       ${risks.length ? chalk.yellow(risks.length) : chalk.green('0')}`);
      console.log(`  Active Incidents: ${incidents.length ? chalk.red(incidents.length) : chalk.green('0')}`);
      console.log(`  Checkpoints:      ${chalk.cyan(checkpoints.length)}`);
      console.log();

      if (blockers.length) {
        console.log(chalk.bold.red('Blockers:'));
        blockers.forEach((b) => console.log(`  ${chalk.red('!')} [${b.severity}] ${b.system}: ${b.reason}`));
        console.log();
      }

      if (issues.length) {
        console.log(chalk.bold.yellow('Known Issues:'));
        issues.forEach((i) => console.log(`  ${chalk.yellow('•')} ${i.id} ${i.title}`));
        console.log();
      }

      console.log(chalk.bold('Context Priority (log-first policy):'));
      ctxPriority.slice(0, 4).forEach((p) =>
        console.log(`  ${chalk.cyan(String(p.order) + '.')} ${p.source.padEnd(22)} ${chalk.gray(p.description.slice(0, 55))}`)
      );
      console.log(`  ${chalk.gray('...')} read source files ONLY if log context is insufficient`);
      console.log();
    });

  logsCmd
    .command('search <query> [path]')
    .description('Search across all engineering log documents')
    .option('--project <path>', 'Path to target project')
    .option('--limit <n>', 'Max results per source', '5')
    .action(async (query, pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(opts.project ?? pathArg);
      const limit = parseInt(opts.limit) || 5;

      const { searchFilePurpose }  = await import('../local-agent/eng-log/FilePurposeIndexer.js');
      const { selectFilesForTask } = await import('../local-agent/eng-log/SmartFileSelector.js');
      const { listDecisions }      = await import('../local-agent/eng-log/DecisionTracker.js');
      const { listIncidents }      = await import('../local-agent/eng-log/IncidentRecorder.js');
      const { listKnownIssues }    = await import('../local-agent/eng-log/EngineeringStateTracker.js');
      const { readLatest }         = await import('../local-agent/eng-log/EngineeringLogManager.js');
      const { readFileSync, existsSync: _ex } = await import('fs');
      const { join: _j } = await import('path');

      console.log(chalk.bold(`Engineering Log Search: "${query}"\n`));

      // 1 — Search latest.md
      const latest = readLatest(targetDir);
      if (latest) {
        const lines  = latest.split('\n');
        const q      = query.toLowerCase();
        const hits   = lines.filter((l) => l.toLowerCase().includes(q)).slice(0, limit);
        if (hits.length) {
          console.log(chalk.bold.yellow('In latest.md:'));
          hits.forEach((l) => console.log(`  ${chalk.gray('│')} ${l.trim()}`));
          console.log();
        }
      }

      // 2 — Search file purpose index
      const fileResults = searchFilePurpose(targetDir, query, { limit });
      if (fileResults.length) {
        console.log(chalk.bold.yellow('In file purpose index:'));
        fileResults.forEach((r) => {
          console.log(`  ${chalk.cyan(r.file)}`);
          console.log(`    → ${chalk.gray(r.purpose)}`);
        });
        console.log();
      }

      // 3 — Smart file selector
      const taskFiles = selectFilesForTask(targetDir, query, { limit });
      if (taskFiles.length) {
        console.log(chalk.bold.yellow('Recommended source files:'));
        taskFiles.forEach((r) => console.log(`  ${chalk.cyan(r.file.padEnd(55))} ${chalk.gray('score: ' + r.score)}`));
        console.log();
      }

      // 4 — Search decisions
      const decisions = listDecisions(targetDir);
      const decHits   = decisions.filter((d) => {
        const text = `${d.title} ${d.reason ?? ''} ${d.impact ?? ''}`.toLowerCase();
        return text.includes(query.toLowerCase());
      }).slice(0, limit);
      if (decHits.length) {
        console.log(chalk.bold.yellow('In decisions:'));
        decHits.forEach((d) => console.log(`  ${chalk.cyan(d.decisionId)} ${d.title}`));
        console.log();
      }

      // 5 — Search known issues
      const issues = listKnownIssues(targetDir);
      const issHits = issues.filter((i) => {
        const text = `${i.title} ${i.rootCause ?? ''} ${i.workaround ?? ''}`.toLowerCase();
        return text.includes(query.toLowerCase());
      }).slice(0, limit);
      if (issHits.length) {
        console.log(chalk.bold.yellow('In known issues:'));
        issHits.forEach((i) => console.log(`  ${chalk.yellow(i.id)} ${i.title}`));
        console.log();
      }

      // 6 — Search architecture docs
      const archDir = _j(targetDir, '.local-agent', 'engineering-log', 'architecture');
      const archFiles = ['system-architecture.md', 'implementation-map.md', 'module-map.md', 'runtime-flow.md'];
      for (const af of archFiles) {
        const fp = _j(archDir, af);
        if (!_ex(fp)) continue;
        const lines = readFileSync(fp, 'utf8').split('\n');
        const q     = query.toLowerCase();
        const hits  = lines.filter((l) => l.toLowerCase().includes(q)).slice(0, limit);
        if (hits.length) {
          console.log(chalk.bold.yellow(`In architecture/${af}:`));
          hits.forEach((l) => console.log(`  ${chalk.gray('│')} ${l.trim()}`));
          console.log();
        }
      }

      const totalSources = [fileResults.length, decHits.length, issHits.length].reduce((a, b) => a + b, 0);
      if (!totalSources && !latest?.toLowerCase().includes(query.toLowerCase())) {
        console.log(chalk.gray(`No results found for "${query}" in engineering log.\n`));
        console.log(chalk.gray('Tip: rebuild index with: local-agent logs file-purpose --rebuild\n'));
      }
    });

  logsCmd.action(async (pathArg, opts) => {
    printBanner();
    console.log(chalk.bold('Engineering Build Log — commands:\n'));
    console.log(chalk.bold.yellow('  Log-First Policy: Read logs BEFORE reading source code.\n'));
    [
      ['latest',        'Show current project state (single source of truth)'],
      ['update',        'Regenerate latest.md with current state'],
      ['file-purpose',  'File purpose index — find files without reading source'],
      ['search',        'Search across all engineering log documents'],
      ['current-state', 'Compact current engineering state snapshot'],
      ['checkpoints',   'List recent checkpoints'],
      ['checkpoint',    'Write a new checkpoint'],
      ['summary',       'Generate a build/QA summary'],
      ['incidents',     'List engineering log incidents'],
      ['architecture',  'Show architecture documentation'],
      ['decision',      'Record an engineering decision'],
    ].forEach(([cmd, desc]) => console.log(`  ${chalk.cyan('local-agent logs ' + cmd.padEnd(18))} ${chalk.gray(desc)}`));
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
