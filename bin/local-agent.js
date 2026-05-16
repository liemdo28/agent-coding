#!/usr/bin/env node
// bin/local-agent.js - CLI entrypoint for the local/offline AI Coding Agent

import { resolve, dirname } from 'path';
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

  // ── fix (Phase 3) ────────────────────────────────────────────────────────
  program
    .command('fix <issue> [path]')
    .description('Auto-fix a detected issue (Phase 3)')
    .action((issue) => {
      printBanner();
      console.log(chalk.yellow('⚠  Coming in Phase 3: Autonomous code editing.'));
      console.log(chalk.gray(`   Issue: "${issue}"\n`));
    });

  // ── apply (Phase 3) ──────────────────────────────────────────────────────
  program
    .command('apply <patch> [path]')
    .description('Apply a patch file (Phase 3)')
    .action((patch) => {
      printBanner();
      console.log(chalk.yellow('⚠  Coming in Phase 3: Patch application system.'));
      console.log(chalk.gray(`   Patch: "${patch}"\n`));
    });

  // ── rollback (Phase 3) ───────────────────────────────────────────────────
  program
    .command('rollback [path]')
    .description('Roll back the last applied change (Phase 3)')
    .action(() => {
      printBanner();
      console.log(chalk.yellow('⚠  Coming in Phase 3: Rollback / backup system.\n'));
    });

  // ── qa (Phase 4) ─────────────────────────────────────────────────────────
  program
    .command('qa [path]')
    .description('Run automated QA checks (Phase 4)')
    .action(() => {
      printBanner();
      console.log(chalk.yellow('⚠  Coming in Phase 4: Automated QA and build/test loop.\n'));
    });

  // ── report (Phase 5) ─────────────────────────────────────────────────────
  program
    .command('report [path]')
    .description('Generate a project health report (Phase 5)')
    .action(() => {
      printBanner();
      console.log(chalk.yellow('⚠  Coming in Phase 5: Reporting and dashboard.\n'));
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
