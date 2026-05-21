#!/usr/bin/env node

/**
 * aos — CLI entry point for the AI Operating System Runtime
 *
 * Commands:
 *   aos boot          — Start the runtime
 *   aos execute       — Execute a task
 *   aos analyze       — Analyze a project
 *   aos search        — Semantic search
 *   aos health        — Runtime health check
 *   aos shutdown      — Graceful shutdown
 */

import { AOSRuntime } from '../core/index.js';
import { resolve } from 'path';

const COMMANDS = {
    boot: cmdBoot,
    execute: cmdExecute,
    analyze: cmdAnalyze,
    search: cmdSearch,
    health: cmdHealth,
    help: cmdHelp,
};

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';
    const handler = COMMANDS[command];

    if (!handler) {
        console.error(`Unknown command: ${command}`);
        cmdHelp();
        process.exit(1);
    }

    try {
        await handler(args.slice(1));
    } catch (error) {
        console.error(`[AOS ERROR] ${error.message}`);
        process.exit(1);
    }
}

/** Boot the runtime and keep it running */
async function cmdBoot(args) {
    console.log('[AOS] Booting runtime...');
    const runtime = new AOSRuntime();

    runtime.on('ready', () => {
        console.log('[AOS] Runtime ready');
        const health = runtime.getHealth();
        console.log(`[AOS] State: ${health.state} | Workers: ${health.maxWorkers}`);
    });

    runtime.on('state', (state) => {
        console.log(`[AOS] State changed: ${state}`);
    });

    await runtime.boot();

    // Keep process alive
    process.on('SIGINT', async () => {
        console.log('\n[AOS] Shutting down...');
        await runtime.shutdown();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await runtime.shutdown();
        process.exit(0);
    });

    // If --once flag, just boot and exit
    if (args.includes('--once')) {
        const health = runtime.getHealth();
        console.log(JSON.stringify(health, null, 2));
        await runtime.shutdown();
    }
}

/** Execute a task */
async function cmdExecute(args) {
    const runtime = new AOSRuntime();
    await runtime.boot();

    const task = parseTaskArgs(args);
    console.log(`[AOS] Executing task: ${task.type || 'generic'}`);

    const result = await runtime.execute(task);
    console.log(JSON.stringify(result, null, 2));

    await runtime.shutdown();
}

/** Analyze a project */
async function cmdAnalyze(args) {
    const projectPath = resolve(args[0] || process.cwd());
    console.log(`[AOS] Analyzing: ${projectPath}`);

    const runtime = new AOSRuntime();
    await runtime.boot();

    const profile = await runtime.analyzeProject(projectPath);
    console.log(JSON.stringify(profile, null, 2));

    await runtime.shutdown();
}

/** Semantic search */
async function cmdSearch(args) {
    const query = args.join(' ');
    if (!query) {
        console.error('Usage: aos search <query>');
        process.exit(1);
    }

    const runtime = new AOSRuntime();
    await runtime.boot();

    const results = await runtime.search(query);
    console.log(JSON.stringify(results, null, 2));

    await runtime.shutdown();
}

/** Health check */
async function cmdHealth() {
    const runtime = new AOSRuntime();
    await runtime.boot();

    const health = runtime.getHealth();
    console.log(JSON.stringify(health, null, 2));

    await runtime.shutdown();
}

/** Help */
function cmdHelp() {
    console.log(`
AOS — AI Operating System Runtime

Usage: aos <command> [options]

Commands:
  boot              Start the runtime (stays running)
  boot --once       Boot, report health, and exit
  execute           Execute a task through the pipeline
  analyze [path]    Analyze a project directory
  search <query>    Semantic search across indexed projects
  health            Show runtime health metrics
  help              Show this help

Task options (for execute):
  --type <type>     Task type (build, test, lint, deploy)
  --command <cmd>   Command to execute
  --project <path>  Project directory

Examples:
  aos boot
  aos analyze ./my-project
  aos search "projects using websocket"
  aos execute --type build --command "npm run build" --project ./app
`);
}

function parseTaskArgs(args) {
    const task = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--type' && args[i + 1]) task.type = args[++i];
        else if (args[i] === '--command' && args[i + 1]) task.command = args[++i];
        else if (args[i] === '--project' && args[i + 1]) task.project = resolve(args[++i]);
        else if (args[i] === '--priority' && args[i + 1]) task.priority = args[++i];
    }
    return task;
}

main();
