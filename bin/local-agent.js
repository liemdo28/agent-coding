#!/usr/bin/env node
// bin/local-agent.js - CLI entrypoint for the local/offline AI Coding Agent

import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dynamic imports (loaded after we confirm packages exist)
async function main() {
  const { program } = await import('commander');
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  const { loadConfig } = await import('../local-agent/core/config.js');
  const { initWorkspace, getWorkspacePaths, isWorkspaceInitialized } = await import('../local-agent/core/workspace.js');
  const { initLogger, logger } = await import('../local-agent/core/logger.js');
  const { scanProject } = await import('../local-agent/scanner/scanner.js');

  // ── Banner ────────────────────────────────────────────────────────────────
  function printBanner() {
    console.log(chalk.bold.cyan('\n  local-agent') + chalk.gray(' v1.0.0'));
    console.log(chalk.bgGreen.black.bold('  OFFLINE MODE  ') + '  ' + chalk.gray('No internet. No telemetry. Fully local.\n'));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function resolveTarget(pathArg) {
    return pathArg ? resolve(pathArg) : process.cwd();
  }

  function die(msg) {
    console.error(chalk.red('ERROR: ') + msg);
    process.exit(1);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  }

  function formatDate(isoStr) {
    if (!isoStr) return 'never';
    return new Date(isoStr).toLocaleString();
  }

  // ── Program definition ────────────────────────────────────────────────────
  program
    .name('local-agent')
    .description('Fully local/offline AI Coding Agent')
    .version('1.0.0');

  // ── init ──────────────────────────────────────────────────────────────────
  program
    .command('init [path]')
    .description('Initialize the agent in a project directory and run first scan')
    .action(async (pathArg) => {
      printBanner();
      const targetDir = resolveTarget(pathArg);

      if (!existsSync(targetDir)) {
        die(`Directory does not exist: ${targetDir}`);
      }

      const spinner = ora('Initializing workspace...').start();

      try {
        const { workspaceDir, created } = initWorkspace(targetDir);
        const config = loadConfig(targetDir);
        initLogger(targetDir, 'info', false);

        if (created) {
          spinner.succeed(chalk.green(`Workspace created at ${workspaceDir}`));
        } else {
          spinner.info(chalk.yellow(`Workspace already exists at ${workspaceDir}`));
        }

        // First scan
        const scanSpinner = ora('Scanning project...').start();
        const projectMap = await scanProject(targetDir, config);
        scanSpinner.succeed(
          chalk.green(`Scan complete — ${projectMap.stats.totalFiles} files, `) +
          chalk.cyan(formatBytes(projectMap.stats.totalSize))
        );

        logger.info('init command completed', { targetDir, files: projectMap.stats.totalFiles });

        console.log('\n' + chalk.bold('Project info:'));
        console.log(`  ${chalk.gray('Types:')}    ${projectMap.projectTypes.join(', ') || 'unknown'}`);
        console.log(`  ${chalk.gray('Files:')}    ${projectMap.stats.totalFiles}`);
        console.log(`  ${chalk.gray('Size:')}     ${formatBytes(projectMap.stats.totalSize)}`);
        console.log(`  ${chalk.gray('TODOs:')}    ${projectMap.todos.length}`);
        console.log(`  ${chalk.gray('Routes:')}   ${projectMap.routes.length}`);
        console.log(`  ${chalk.gray('Workspace:')}${workspaceDir}`);
        console.log('\n' + chalk.bold.green('✓ Ready. Run `local-agent ask "<question>" [path]` to get started.\n'));
      } catch (err) {
        spinner.fail(chalk.red('Init failed'));
        die(err.message);
      }
    });

  // ── scan ──────────────────────────────────────────────────────────────────
  program
    .command('scan [path]')
    .description('Scan or rescan the project and update the project map')
    .option('--verbose', 'Show detailed file list')
    .action(async (pathArg, opts) => {
      printBanner();
      const targetDir = resolveTarget(pathArg);

      if (!existsSync(targetDir)) {
        die(`Directory does not exist: ${targetDir}`);
      }

      if (!isWorkspaceInitialized(targetDir)) {
        die(`Workspace not initialized. Run: local-agent init ${pathArg ?? '.'}`);
      }

      const config = loadConfig(targetDir);
      initLogger(targetDir, 'info', false);

      const spinner = ora('Scanning project files...').start();

      try {
        const projectMap = await scanProject(targetDir, config);
        spinner.succeed(
          chalk.green(`Scan complete — ${projectMap.stats.totalFiles} files`)
        );

        logger.info('scan command completed', { targetDir, files: projectMap.stats.totalFiles });

        console.log('\n' + chalk.bold('Scan results:'));
        console.log(`  ${chalk.gray('Project types:')} ${projectMap.projectTypes.join(', ') || 'unknown'}`);
        console.log(`  ${chalk.gray('Total files:')}   ${projectMap.stats.totalFiles}`);
        console.log(`  ${chalk.gray('Total size:')}    ${formatBytes(projectMap.stats.totalSize)}`);
        console.log(`  ${chalk.gray('Routes found:')}  ${projectMap.routes.length}`);
        console.log(`  ${chalk.gray('TODOs/FIXMEs:')}  ${projectMap.todos.length}`);
        console.log(`  ${chalk.gray('Scanned at:')}    ${formatDate(projectMap.scannedAt)}`);

        if (projectMap.buildCommands.length > 0) {
          console.log('\n' + chalk.bold('Build commands detected:'));
          projectMap.buildCommands.slice(0, 8).forEach((cmd) => {
            console.log(`  ${chalk.cyan('›')} ${cmd}`);
          });
        }

        if (opts.verbose && projectMap.files.length > 0) {
          console.log('\n' + chalk.bold('Files:'));
          projectMap.files.slice(0, 50).forEach((f) => {
            console.log(`  ${chalk.gray(formatBytes(f.size).padStart(8))}  ${f.path}`);
          });
          if (projectMap.files.length > 50) {
            console.log(chalk.gray(`  ... and ${projectMap.files.length - 50} more`));
          }
        }

        const paths = getWorkspacePaths(targetDir);
        console.log(`\n  ${chalk.gray('Project map written to:')} ${paths.projectMap}`);
        console.log(`  ${chalk.gray('Summary written to:')}     ${paths.summary}\n`);
      } catch (err) {
        spinner.fail(chalk.red('Scan failed'));
        die(err.message);
      }
    });

  // ── status ────────────────────────────────────────────────────────────────
  program
    .command('status [path]')
    .description('Show agent status, configuration, and last scan info')
    .action(async (pathArg) => {
      printBanner();
      const targetDir = resolveTarget(pathArg);

      if (!existsSync(targetDir)) {
        die(`Directory does not exist: ${targetDir}`);
      }

      const initialized = isWorkspaceInitialized(targetDir);
      const paths = getWorkspacePaths(targetDir);

      console.log(chalk.bold('Workspace:'));
      console.log(`  ${chalk.gray('Directory:')}   ${targetDir}`);
      console.log(`  ${chalk.gray('Initialized:')} ${initialized ? chalk.green('yes') : chalk.red('no (run local-agent init)')}`);

      if (!initialized) {
        console.log();
        return;
      }

      const config = loadConfig(targetDir);

      console.log('\n' + chalk.bold('Configuration:'));
      console.log(`  ${chalk.gray('Offline mode:')} ${chalk.green(String(config.offline))}`);
      console.log(`  ${chalk.gray('Telemetry:')}    ${chalk.green(String(config.telemetry))}`);
      console.log(`  ${chalk.gray('Cloud sync:')}   ${chalk.green(String(config.cloudSync))}`);
      console.log('\n' + chalk.bold('LLM:'));
      console.log(`  ${chalk.gray('Provider:')}    ${config.llm.provider}`);
      console.log(`  ${chalk.gray('Model:')}       ${config.llm.model}`);
      console.log(`  ${chalk.gray('Base URL:')}    ${config.llm.baseUrl}`);
      console.log(`  ${chalk.gray('Fallback:')}    ${config.llm.fallbackModel}`);
      console.log(`  ${chalk.gray('Max tokens:')}  ${config.llm.maxTokens}`);

      // Last scan info
      const projectMapPath = paths.projectMap;
      if (existsSync(projectMapPath)) {
        try {
          const projectMap = JSON.parse(readFileSync(projectMapPath, 'utf8'));
          console.log('\n' + chalk.bold('Last scan:'));
          console.log(`  ${chalk.gray('At:')}           ${formatDate(projectMap.scannedAt)}`);
          console.log(`  ${chalk.gray('Project types:')}${projectMap.projectTypes.join(', ') || 'unknown'}`);
          console.log(`  ${chalk.gray('Files:')}        ${projectMap.stats.totalFiles}`);
          console.log(`  ${chalk.gray('Size:')}         ${formatBytes(projectMap.stats.totalSize)}`);
          console.log(`  ${chalk.gray('TODOs:')}        ${projectMap.todos.length}`);
          console.log(`  ${chalk.gray('Routes:')}       ${projectMap.routes.length}`);
        } catch {
          console.log('\n' + chalk.yellow('  Last scan data unreadable.'));
        }
      } else {
        console.log('\n' + chalk.yellow('  No scan data yet. Run: local-agent scan'));
      }

      console.log('\n' + chalk.bold('Paths:'));
      console.log(`  ${chalk.gray('Workspace:')} ${paths.workspace}`);
      console.log(`  ${chalk.gray('Logs:')}      ${paths.logFile}`);
      console.log(`  ${chalk.gray('Index:')}     ${paths.index}`);
      console.log(`  ${chalk.gray('Reports:')}   ${paths.reports}`);
      console.log();
    });

  // ── ask (Phase 2 placeholder) ─────────────────────────────────────────────
  program
    .command('ask <question> [path]')
    .description('Ask the AI agent a question about the codebase (Phase 2)')
    .action((question, pathArg) => {
      printBanner();
      console.log(chalk.yellow('⚠  Coming in Phase 2: LLM integration.'));
      console.log(chalk.gray(`   Your question: "${question}"`));
      console.log(chalk.gray('   The agent will use the local Ollama model to answer questions about your codebase.\n'));
    });

  // ── fix (Phase 3 placeholder) ─────────────────────────────────────────────
  program
    .command('fix <issue> [path]')
    .description('Auto-fix an issue in the codebase (Phase 3)')
    .action((issue, pathArg) => {
      printBanner();
      console.log(chalk.yellow('⚠  Coming in Phase 3: Autonomous code editing.'));
      console.log(chalk.gray(`   Issue: "${issue}"\n`));
    });

  // ── apply (Phase 3 placeholder) ───────────────────────────────────────────
  program
    .command('apply <patch> [path]')
    .description('Apply a patch file to the codebase (Phase 3)')
    .action((patch, pathArg) => {
      printBanner();
      console.log(chalk.yellow('⚠  Coming in Phase 3: Patch application system.'));
      console.log(chalk.gray(`   Patch: "${patch}"\n`));
    });

  // ── rollback (Phase 3 placeholder) ───────────────────────────────────────
  program
    .command('rollback [path]')
    .description('Roll back the last applied change (Phase 3)')
    .action((pathArg) => {
      printBanner();
      console.log(chalk.yellow('⚠  Coming in Phase 3: Rollback / backup system.\n'));
    });

  // ── qa (Phase 4 placeholder) ──────────────────────────────────────────────
  program
    .command('qa [path]')
    .description('Run quality assurance checks (Phase 4)')
    .action((pathArg) => {
      printBanner();
      console.log(chalk.yellow('⚠  Coming in Phase 4: Automated QA and code analysis.\n'));
    });

  // ── report (Phase 5 placeholder) ─────────────────────────────────────────
  program
    .command('report [path]')
    .description('Generate a project health report (Phase 5)')
    .action((pathArg) => {
      printBanner();
      console.log(chalk.yellow('⚠  Coming in Phase 5: Reporting and dashboards.\n'));
    });

  // ── Parse ─────────────────────────────────────────────────────────────────
  program.parse(process.argv);

  // Show help if no command given
  if (process.argv.length <= 2) {
    printBanner();
    program.help();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
