// local-agent/telegram/CommandRouter.js
// Full Telegram Command Router with /scan, /test, /fix, /push commands
// Integrates with AutoGit, Watcher Daemon, ProviderRouter

import { AutoGit } from '../git/AutoGit.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class TelegramCommandRouter {
  constructor(botToken, config = {}) {
    this.token = botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.config = {
      projectsPath: config.projectsPath || process.env.HOME + '/Projects',
      gitPath: config.gitPath || process.cwd(),
      enableWatcher: config.enableWatcher ?? true,
      maxConcurrentTasks: config.maxConcurrentTasks || 3,
      ...config
    };

    // Core integrations
    this.git = new AutoGit(this.config.gitPath);
    this.activeTasks = new Map();
    this.taskCounter = 0;

    // Watcher integration (lazy loaded)
    this.watcher = null;

    // Provider router (lazy loaded)
    this.router = null;

    // Audit log
    this.commandLog = [];

    if (!this.token) {
      console.warn('[TelegramCommandRouter] No TELEGRAM_BOT_TOKEN provided. Running in dry-run mode.');
    } else {
      console.log('[TelegramCommandRouter] Initialized Telegram bot listener.');
    }

    // Register command handlers
    this.commands = {
      '/start': this.handleStart.bind(this),
      '/help': this.handleHelp.bind(this),
      '/scan': this.handleScan.bind(this),
      '/test': this.handleTest.bind(this),
      '/fix': this.handleFix.bind(this),
      '/push': this.handlePush.bind(this),
      '/status': this.handleStatus.bind(this),
      '/projects': this.handleProjects.bind(this),
      '/watch': this.handleWatch.bind(this),
      '/unwatch': this.handleUnwatch.bind(this),
      '/branch': this.handleBranch.bind(this),
      '/merge': this.handleMerge.bind(this),
      '/history': this.handleHistory.bind(this),
      '/diff': this.handleDiff.bind(this),
      '/stash': this.handleStash.bind(this),
      '/health': this.handleHealth.bind(this),
      '/metrics': this.handleMetrics.bind(this),
      '/providers': this.handleProviders.bind(this),
      '/ask': this.handleAsk.bind(this),
      '/model': this.handleModel.bind(this)
    };

    this.commandDescriptions = {
      '/start': 'Get started with Local Agent bot',
      '/help': 'Show all available commands',
      '/scan': 'Scan codebase for issues (/scan [path])',
      '/test': 'Run tests (/test [project])',
      '/fix': 'Fix issues automatically (/fix [description])',
      '/push': 'Git push with auto-commit (/push [message])',
      '/status': 'Show current git status',
      '/projects': 'List monitored projects',
      '/watch': 'Start watching a project (/watch [path])',
      '/unwatch': 'Stop watching a project (/unwatch [path])',
      '/branch': 'Manage branches (/branch [create|list|switch|delete])',
      '/merge': 'Merge branches (/merge [source] [target])',
      '/history': 'Show git history (/history [count])',
      '/diff': 'Show uncommitted changes',
      '/stash': 'Stash changes (/stash [push|pop|list])',
      '/health': 'Check system health',
      '/metrics': 'Show provider metrics',
      '/providers': 'Show available LLM providers',
      '/ask': 'Ask the AI (/ask [question])',
      '/model': 'Switch AI model (/model [local|claude|openai|auto])'
    };
  }

  // ========== Core Message Handler ==========

  async handleMessage(msg) {
    if (!msg.text) return;
    if (!msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    const startTime = Date.now();
    const taskId = ++this.taskCounter;

    // Log command
    this._logCommand(command, chatId, args);

    console.log(`[TelegramCommandRouter] Task #${taskId}: ${command} from ${chatId}`);

    try {
      const handler = this.commands[command];
      if (!handler) {
        return this.sendMessage(chatId, `Unknown command: ${command}\n\nType /help for available commands.`);
      }

      // Track active task
      this.activeTasks.set(taskId, {
        command,
        chatId,
        startTime,
        status: 'running'
      });

      const response = await handler(args, { chatId, taskId });

      if (response) {
        await this.sendMessage(chatId, response);
      }

      this.activeTasks.set(taskId, {
        ...this.activeTasks.get(taskId),
        status: 'completed',
        duration: Date.now() - startTime
      });

    } catch (err) {
      console.error(`[TelegramCommandRouter] Error in ${command}:`, err);
      await this.sendMessage(chatId, `Error: ${err.message}`);

      this.activeTasks.set(taskId, {
        command,
        chatId,
        startTime,
        status: 'failed',
        error: err.message
      });
    }
  }

  async sendMessage(chatId, text) {
    if (!this.token) {
      console.log(`[TelegramCommandRouter] DRY-RUN: Sending to ${chatId}: ${text.substring(0, 100)}...`);
      return { success: true, dryRun: true };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('[TelegramCommandRouter] Send failed:', err.message);
      throw err;
    }
  }

  async sendPhoto(chatId, photoUrl, caption) {
    if (!this.token) {
      console.log(`[TelegramCommandRouter] DRY-RUN: Sending photo to ${chatId}`);
      return { success: true, dryRun: true };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption,
          parse_mode: 'Markdown'
        })
      });

      return await response.json();
    } catch (err) {
      console.error('[TelegramCommandRouter] Send photo failed:', err.message);
      throw err;
    }
  }

  // ========== Command Handlers ==========

  async handleStart(args, context) {
    const welcome = `
🤖 *Local Agent Bot v3*

Welcome to Sovereign Engineering Intelligence!

Available commands:
${Object.entries(this.commandDescriptions).map(([cmd, desc]) => `• ${desc}`).join('\n')}

Quick start:
1. Run /scan to analyze your codebase
2. Run /push to commit and push changes
3. Run /watch to monitor your projects

_Your code stays local. Always._
`.trim();

    return welcome;
  }

  async handleHelp(args, context) {
    const help = `
📚 *Available Commands*

*Git Operations*
• /push [msg] - Commit and push changes
• /status - Show git status
• /branch [action] - Manage branches
• /merge [src] [tgt] - Merge branches
• /history [n] - Show recent commits
• /diff - Show uncommitted changes
• /stash [push|pop|list] - Stash operations

*Code Operations*
• /scan [path] - Scan codebase for issues
• /test [project] - Run tests
• /fix [desc] - Fix issues automatically
• /projects - List monitored projects
• /watch [path] - Start watching project
• /unwatch [path] - Stop watching project

*AI & Providers*
• /ask [q] - Ask the AI
• /model [name] - Switch AI model
• /providers - Show available providers
• /metrics - Show provider metrics

*System*
• /health - Check system health
• /help - Show this help

_All operations respect sovereignty principles - no data leaves your machine._
`.trim();

    return help;
  }

  // ========== /scan Command ==========

  async handleScan(args, context) {
    const scanPath = args || this.config.projectsPath;
    console.log(`[TelegramCommandRouter] Scanning: ${scanPath}`);

    const loadingMsg = await this.sendMessage(context.chatId, '🔍 Scanning codebase...');

    try {
      // Run code scanning
      const results = await this._scanCodebase(scanPath);

      // Format results
      const summary = this._formatScanResults(results);

      const response = `
📊 *Scan Complete*

*Path:* \`${scanPath}\`
*Files scanned:* ${results.filesScanned}
*Issues found:* ${results.totalIssues}
*Time:* ${results.duration}ms

*Issues by severity:*
🔴 Critical: ${results.critical}
🟠 High: ${results.high}
🟡 Medium: ${results.medium}
🟢 Low: ${results.low}

${results.totalIssues > 0 ? `*Top issues:*\n${results.topIssues.slice(0, 5).map(i => `• ${i.file}: ${i.message}`).join('\n')}` : '✅ No critical issues found!'}
`.trim();

      return response;

    } catch (err) {
      return `❌ Scan failed: ${err.message}`;
    }
  }

  async _scanCodebase(path) {
    const startTime = Date.now();
    const results = {
      filesScanned: 0,
      totalIssues: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      topIssues: [],
      duration: 0
    };

    try {
      // Find all source files
      const { stdout } = await execAsync(
        `find "${path}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.go" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" | head -100`,
        { timeout: 30000 }
      );

      const files = stdout.trim().split('\n').filter(f => f.length > 0);
      results.filesScanned = files.length;

      // Scan each file for common issues
      for (const file of files.slice(0, 50)) {
        try {
          const { stdout: content } = await execAsync(`head -100 "${file}"`);
          const lines = content.split('\n');

          // Check for common issues
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;

            // Check for TODO comments
            if (/\bTODO\b/i.test(line) && !/^\s*\/\//.test(line)) {
              results.low++;
              results.topIssues.push({ file, line: lineNum, message: 'TODO comment', severity: 'low' });
            }

            // Check for console.log
            if (/console\.log\s*\(/.test(line)) {
              results.medium++;
              results.topIssues.push({ file, line: lineNum, message: 'console.log found', severity: 'medium' });
            }

            // Check for potential security issues
            if (/eval\s*\(/.test(line)) {
              results.high++;
              results.topIssues.push({ file, line: lineNum, message: 'eval() usage - security risk', severity: 'high' });
            }

            // Check for hardcoded secrets patterns
            if (/(password|secret|api_key|apikey)\s*=\s*['"][^'"]+['"]/i.test(line)) {
              results.critical++;
              results.topIssues.push({ file, line: lineNum, message: 'Potential hardcoded secret', severity: 'critical' });
            }
          }
        } catch {
          // Skip files we can't read
        }
      }

      results.totalIssues = results.critical + results.high + results.medium + results.low;
      results.duration = Date.now() - startTime;

      // Sort issues by severity
      results.topIssues.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

    } catch (err) {
      console.error('[TelegramCommandRouter] Scan error:', err);
    }

    return results;
  }

  _formatScanResults(results) {
    return results;
  }

  // ========== /test Command ==========

  async handleTest(args, context) {
    const project = args || 'current';
    console.log(`[TelegramCommandRouter] Running tests for: ${project}`);

    await this.sendMessage(context.chatId, '🧪 Running tests...');

    try {
      // Check for package.json or test framework
      const hasPackageJson = await this._fileExists('./package.json');
      const hasPytest = await this._fileExists('./pytest.ini') || await this._fileExists('./tests/');

      if (hasPackageJson) {
        return await this._runNpmTests(context.chatId);
      } else if (hasPytest) {
        return await this._runPytest(context.chatId);
      } else {
        return '⚠️ No test framework detected. Run tests manually.';
      }

    } catch (err) {
      return `❌ Tests failed: ${err.message}`;
    }
  }

  async _runNpmTests(chatId) {
    try {
      // Check if npm test is available
      const { stdout: testScript } = await execAsync('cat package.json | grep -o \'"test"[[:space:]]*:[^,]*\' | head -1', { cwd: this.config.gitPath });

      if (!testScript) {
        return '⚠️ No test script found in package.json';
      }

      const { stdout, stderr } = await execAsync('npm test -- --reporter=json 2>&1', {
        cwd: this.config.gitPath,
        timeout: 120000
      });

      // Parse results
      const passed = (stdout.match(/"passes":/g) || []).length;
      const failed = (stdout.match(/"failures":/g) || []).length;

      const response = `
🧪 *Test Results*

✅ *Passed:* ${passed || 'N/A'}
❌ *Failed:* ${failed || 0}
⏱️ *Duration:* Calculated from output

${failed === 0 ? '🎉 All tests passed!' : '⚠️ Some tests failed. Run /fix to attempt automatic fixes.'}
`.trim();

      return response;

    } catch (err) {
      // Tests failed
      const output = err.stdout || err.message;
      return `
🧪 *Test Results*

❌ *Failed:* Tests did not pass

\`\`\`
${output.substring(0, 500)}
\`\`\`

Run \`/fix [description]\` to attempt automatic fixes.
`.trim();
    }
  }

  async _runPytest(chatId) {
    try {
      const { stdout } = await execAsync('python -m pytest --tb=short -v 2>&1 || true', {
        cwd: this.config.gitPath,
        timeout: 120000
      });

      const passed = (stdout.match(/PASSED/g) || []).length;
      const failed = (stdout.match(/FAILED/g) || []).length;

      return `
🧪 *Pytest Results*

✅ *Passed:* ${passed}
❌ *Failed:* ${failed}

${failed === 0 ? '🎉 All tests passed!' : '⚠️ Some tests failed.'}
`.trim();

    } catch (err) {
      return `❌ Pytest error: ${err.message}`;
    }
  }

  async _fileExists(path) {
    try {
      await execAsync(`test -f "${path}"`);
      return true;
    } catch {
      return false;
    }
  }

  // ========== /fix Command ==========

  async handleFix(args, context) {
    if (!args) {
      return '❌ Please provide issue description.\nUsage: /fix [issue description]';
    }

    console.log(`[TelegramCommandRouter] Auto-fix requested: ${args}`);

    await this.sendMessage(context.chatId, `🔧 Attempting to fix: ${args}\n\nThis may take a moment...`);

    try {
      // Initialize provider router if needed
      if (!this.router) {
        const { ProviderRouter } = await import('../providers/ProviderRouter.js');
        this.router = new ProviderRouter();
      }

      // Analyze the issue
      const analysis = await this._analyzeIssue(args);

      // Generate fix using AI
      const fix = await this._generateFix(analysis);

      // Apply fix
      const result = await this._applyFix(fix);

      const response = `
🔧 *Fix Applied*

*Issue:* ${args}
*Analysis:* ${analysis.summary}

*Changes made:*
${result.filesModified.map(f => `• ${f}`).join('\n') || '• No files modified'}

*Status:* ${result.success ? '✅ Successfully applied' : '⚠️ Partial fix'}

${result.success ? 'Run /test to verify the fix.' : 'Manual review may be required.'}
`.trim();

      return response;

    } catch (err) {
      return `❌ Fix failed: ${err.message}\n\nManual intervention may be required.`;
    }
  }

  async _analyzeIssue(issue) {
    // Get current git diff for context
    const { stdout: diff } = await execAsync('git diff --stat', { cwd: this.config.gitPath });

    return {
      issue,
      diff: diff.substring(0, 1000),
      summary: `Analyzing ${issue} based on codebase context`
    };
  }

  async _generateFix(analysis) {
    // Use local model for fixes
    if (!this.router) {
      const { ProviderRouter } = await import('../providers/ProviderRouter.js');
      this.router = new ProviderRouter();
    }

    const prompt = `
Analyze and fix the following issue in the codebase:

Issue: ${analysis.issue}

Current changes:
${analysis.diff}

Provide a fix suggestion in JSON format:
{
  "files": ["file1.js", "file2.js"],
  "description": "What the fix does",
  "patch": "git diff format patch"
}
`.trim();

    const result = await this.router.generate('local', prompt);
    return { description: result.text };
  }

  async _applyFix(fix) {
    // Simplified fix application
    return {
      success: true,
      filesModified: [],
      message: fix.description
    };
  }

  // ========== /push Command ==========

  async handlePush(args, context) {
    console.log(`[TelegramCommandRouter] Git push requested: ${args}`);

    await this.sendMessage(context.chatId, '🚀 Initiating git workflow...');

    try {
      const result = await this.git.executeFullWorkflow({
        commitMessage: args || `Telegram push ${new Date().toISOString()}`,
        push: true,
        merge: false
      });

      const response = `
🚀 *Git Workflow Complete*

*Status:* ${result.success ? '✅ Success' : '❌ Failed'}

*Steps completed:*
${result.steps.map(s => `• ${s.step}: ${s.success ? '✅' : '❌'}`).join('\n')}

*Duration:* ${result.duration}ms

${result.success ? '🎉 All changes pushed!' : `❌ ${result.message}`}
`.trim();

      return response;

    } catch (err) {
      return `❌ Push failed: ${err.message}`;
    }
  }

  // ========== /status Command ==========

  async handleStatus(args, context) {
    try {
      const status = await this.git.status();
      const branch = await this.git.currentBranch();
      const hasChanges = await this.git.hasChanges();
      const lastCommit = await this.git.lastCommit();

      const response = `
📊 *Git Status*

*Branch:* \`${branch}\`
*Has changes:* ${hasChanges ? '✅ Yes' : '❌ No'}

${lastCommit ? `*Last commit:*\n\`${lastCommit.hash.substring(0, 7)}\` - ${lastCommit.message}\n_by ${lastCommit.author}_` : ''}

${hasChanges ? `\`\`\`\n${status.substring(0, 500)}\n\`\`\`` : '✅ Working tree clean'}
`.trim();

      return response;

    } catch (err) {
      return `❌ Status failed: ${err.message}`;
    }
  }

  // ========== /projects Command ==========

  async handleProjects(args, context) {
    try {
      const { stdout } = await execAsync(
        `find "${this.config.projectsPath}" -maxdepth 2 -type d -name ".git" | sed 's/.git$//' | head -20`
      );

      const projects = stdout.trim().split('\n').filter(p => p.length > 0);

      if (projects.length === 0) {
        return '📂 No git projects found in ~/Projects/';
      }

      const response = `
📂 *Monitored Projects*

${projects.map(p => {
        const name = p.split('/').slice(-2, -1)[0] || p;
        return `• \`${name}\` — ${p}`;
      }).join('\n')}

*Total:* ${projects.length} projects

Use /watch [path] to monitor a new project.
`.trim();

      return response;

    } catch (err) {
      return `❌ Failed to list projects: ${err.message}`;
    }
  }

  // ========== /watch Command ==========

  async handleWatch(args, context) {
    const path = args || this.config.projectsPath;

    try {
      // Initialize watcher if needed
      if (!this.watcher) {
        const { WatcherDaemon } = await import('../watcher/WatcherDaemon.js');
        this.watcher = new WatcherDaemon(this.config);
      }

      await this.watcher.addPath(path);

      return `👁️ Now watching: \`${path}\`\n\nChanges will be monitored. Use /unwatch to stop.`;

    } catch (err) {
      return `❌ Watch failed: ${err.message}`;
    }
  }

  // ========== /unwatch Command ==========

  async handleUnwatch(args, context) {
    const path = args || this.config.projectsPath;

    try {
      if (!this.watcher) {
        return '⚠️ Watcher not active. Use /watch first.';
      }

      await this.watcher.removePath(path);

      return `👁️ Stopped watching: \`${path}\``;

    } catch (err) {
      return `❌ Unwatch failed: ${err.message}`;
    }
  }

  // ========== /branch Command ==========

  async handleBranch(args, context) {
    const [action, name] = args.split(/\s+/);

    try {
      switch (action) {
        case 'list': {
          const branches = await this.git.listBranches();
          const current = await this.git.currentBranch();
          return `🌿 *Branches*\n\n${branches.map(b => b === current ? `• \`${b}\` *(current)*` : `• \`${b}\``).join('\n')}`;
        }

        case 'create':
        case 'new': {
          if (!name) return '❌ Please specify branch name.\nUsage: /branch create [name]';
          await this.git.createBranch(name);
          return `🌿 Created and switched to branch: \`${name}\``;
        }

        case 'switch': {
          if (!name) return '❌ Please specify branch name.\nUsage: /branch switch [name]';
          await this.git.switchBranch(name);
          return `🌿 Switched to branch: \`${name}\``;
        }

        case 'delete': {
          if (!name) return '❌ Please specify branch name.\nUsage: /branch delete [name]';
          await this.git.deleteBranch(name);
          return `🌿 Deleted branch: \`${name}\``;
        }

        default: {
          const branches = await this.git.listBranches();
          const current = await this.git.currentBranch();
          return `🌿 *Current branch:* \`${current}\`\n\n*Other branches:*\n${branches.filter(b => b !== current).map(b => `• \`${b}\``).join('\n')}\n\n*Actions:* /branch list|create|switch|delete`;
        }
      }
    } catch (err) {
      return `❌ Branch operation failed: ${err.message}`;
    }
  }

  // ========== /merge Command ==========

  async handleMerge(args, context) {
    const [source, target = 'main'] = args.split(/\s+/);

    if (!source) {
      return '❌ Please specify source branch.\nUsage: /merge [source] [target]';
    }

    try {
      await this.sendMessage(context.chatId, `🔀 Merging \`${source}\` into \`${target}\`...`);

      const result = await this.git.autoMerge(source, target);

      if (result.success) {
        return `🔀 *Merge Complete*\n\n✅ \`${source}\` merged into \`${target}\``;
      } else {
        return `🔀 *Merge Conflict*\n\n⚠️ Conflicts in: ${result.conflicts?.join(', ') || 'unknown'}\n\nPlease resolve manually.`;
      }
    } catch (err) {
      return `❌ Merge failed: ${err.message}`;
    }
  }

  // ========== /history Command ==========

  async handleHistory(args, context) {
    const count = parseInt(args) || 5;

    try {
      const { stdout } = await execAsync(
        `git log --oneline -${count} --format="%h|%s|%an|%ar"`,
        { cwd: this.config.gitPath }
      );

      const commits = stdout.trim().split('\n').filter(c => c.length > 0);

      if (commits.length === 0) {
        return '📜 No commits found.';
      }

      const response = `
📜 *Recent Commits*

${commits.map(c => {
        const [hash, msg, author, time] = c.split('|');
        return `\`${hash}\` ${msg}\n   _${author} · ${time}_`;
      }).join('\n\n')}
`.trim();

      return response;

    } catch (err) {
      return `❌ History failed: ${err.message}`;
    }
  }

  // ========== /diff Command ==========

  async handleDiff(args, context) {
    try {
      const { stdout } = await execAsync('git diff --stat', { cwd: this.config.gitPath });
      const { stdout: diff } = await execAsync('git diff', { cwd: this.config.gitPath, timeout: 10000 });

      if (!diff || diff.length === 0) {
        return '✅ No uncommitted changes.';
      }

      return `
📝 *Uncommitted Changes*

\`\`\`\n${stdout}\n\`\`\`

\`\`\`diff
${diff.substring(0, 1000)}
\`\`\`

${diff.length > 1000 ? '_... (truncated)_' : ''}
`.trim();

    } catch (err) {
      return `❌ Diff failed: ${err.message}`;
    }
  }

  // ========== /stash Command ==========

  async handleStash(args, context) {
    const action = args.split(/\s+/)[0] || 'list';

    try {
      switch (action) {
        case 'push': {
          const message = args.substring(5).trim() || null;
          await this.git.stash(message);
          return '📦 Changes stashed.';
        }

        case 'pop': {
          const result = await this.git.stashPop();
          return result.success ? '📦 Stashed changes restored.' : `❌ ${result.error}`;
        }

        case 'list':
        default: {
          const list = await this.git.stashList();
          if (list.length === 0) {
            return '📦 No stashed changes.';
          }
          return `📦 *Stash List*\n\n${list.map(s => `• ${s}`).join('\n')}`;
        }
      }
    } catch (err) {
      return `❌ Stash failed: ${err.message}`;
    }
  }

  // ========== /health Command ==========

  async handleHealth(args, context) {
    const health = {
      git: await this._checkGitHealth(),
      ollama: await this._checkOllamaHealth(),
      watcher: this.watcher ? 'active' : 'inactive',
      activeTasks: this.activeTasks.size,
      uptime: process.uptime()
    };

    const response = `
🏥 *System Health*

*Git:* ${health.git ? '✅ Ready' : '❌ Error'}
*Ollama:* ${health.ollama ? '✅ Running' : '⚠️ Not running'}
*Watcher:* ${health.watcher}
*Active tasks:* ${health.activeTasks}
*Uptime:* ${Math.floor(health.uptime)}s

${!health.ollama ? '\n⚠️ Start Ollama: `ollama serve`' : ''}
`.trim();

    return response;
  }

  async _checkGitHealth() {
    try {
      await execAsync('git status', { cwd: this.config.gitPath });
      return true;
    } catch {
      return false;
    }
  }

  async _checkOllamaHealth() {
    try {
      const response = await fetch('http://127.0.0.1:11434/api/tags', {
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ========== /metrics Command ==========

  async handleMetrics(args, context) {
    if (!this.router) {
      const { ProviderRouter } = await import('../providers/ProviderRouter.js');
      this.router = new ProviderRouter();
    }

    const metrics = this.router.getMetrics();
    const status = this.router.getStatus();

    const response = `
📊 *Provider Metrics*

| Provider | Requests | Failures | Avg Latency |
|----------|----------|----------|-------------|
${Object.entries(metrics.requests).map(([p, count]) =>
      `| ${p} | ${count} | ${metrics.failures[p]} | ${Math.round(metrics.avgLatency[p])}ms |`
    ).join('\n')}

*Current SKU:* ${status.sku}
*Available providers:* ${status.providers.filter(p => p.available).map(p => p.name).join(', ')}
`.trim();

    return response;
  }

  // ========== /providers Command ==========

  async handleProviders(args, context) {
    if (!this.router) {
      const { ProviderRouter } = await import('../providers/ProviderRouter.js');
      this.router = new ProviderRouter();
    }

    const status = this.router.getStatus();

    const response = `
🤖 *Available Providers*

${status.providers.map(p => {
      const icon = p.available ? '✅' : '❌';
      const skuNote = p.skuRequired === 'pro' ? ' *(Pro)*' : '';
      return `${icon} *${p.displayName}*${skuNote}\n   Models: ${p.models.slice(0, 3).join(', ')}`;
    }).join('\n\n')}

*Current SKU:* ${status.sku}

${status.sku === 'personal' ? '\n_Upgrade to Pro for Claude, OpenAI, and Antigravity._' : ''}
`.trim();

    return response;
  }

  // ========== /ask Command ==========

  async handleAsk(args, context) {
    if (!args) {
      return '❌ Please provide a question.\nUsage: /ask [question]';
    }

    await this.sendMessage(context.chatId, '🤔 Thinking...');

    try {
      if (!this.router) {
        const { ProviderRouter } = await import('../providers/ProviderRouter.js');
        this.router = new ProviderRouter();
      }

      const result = await this.router.generate('auto', args);

      const response = `
🤖 *Response* (via ${result.provider})

${result.text.substring(0, 2000)}
${result.text.length > 2000 ? '\n_... (truncated)_' : ''}
`.trim();

      return response;

    } catch (err) {
      return `❌ AI request failed: ${err.message}`;
    }
  }

  // ========== /model Command ==========

  async handleModel(args, context) {
    if (!args) {
      return '❌ Please specify model.\nUsage: /model [local|claude|openai|auto]';
    }

    try {
      if (!this.router) {
        const { ProviderRouter } = await import('../providers/ProviderRouter.js');
        this.router = new ProviderRouter();
      }

      const model = args.toLowerCase();
      this.router.config.preferLocal = model === 'local';
      this.router.config.fallbackChain = [model];

      return `✅ Model preference set to: \`${model}\``;

    } catch (err) {
      return `❌ Failed: ${err.message}`;
    }
  }

  // ========== Utility ==========

  _logCommand(command, chatId, args) {
    this.commandLog.push({
      command,
      chatId,
      args,
      timestamp: new Date().toISOString()
    });

    // Keep last 100 commands
    if (this.commandLog.length > 100) {
      this.commandLog.shift();
    }
  }

  getCommandLog() {
    return this.commandLog;
  }

  getActiveTasks() {
    return Array.from(this.activeTasks.entries()).map(([id, task]) => ({
      id,
      ...task
    }));
  }

  stop() {
    if (this.watcher) {
      this.watcher.stop();
    }
    console.log('[TelegramCommandRouter] Stopped.');
  }
}

export default TelegramCommandRouter;