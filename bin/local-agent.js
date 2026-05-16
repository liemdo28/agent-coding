#!/usr/bin/env node
// bin/local-agent.js - CLI entrypoint for the local/offline AI Coding Agent

import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const { program } = await import('commander');
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
