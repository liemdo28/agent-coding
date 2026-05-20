// local-agent/watcher/WatcherDaemon.js
// Background file watcher daemon for monitoring ~/Projects/
// Integrates with Telegram for notifications and AutoGit for auto-commit

import { EventEmitter } from 'events';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const execAsync = promisify(exec);

export class WatcherDaemon extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      projectsPath: config.projectsPath || process.env.HOME + '/Projects',
      watchPaths: config.watchPaths || [config.projectsPath || process.env.HOME + '/Projects'],
      debounceMs: config.debounceMs || 2000,
      ignoredPatterns: config.ignoredPatterns || [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/coverage/**',
        '**/*.log',
        '**/.DS_Store',
        '**/thumbs.db'
      ],
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      scanInterval: config.scanInterval || 60000, // 1 minute
      enableAutoCommit: config.enableAutoCommit ?? true,
      autoCommitInterval: config.autoCommitInterval || 300000, // 5 minutes
      telegramNotify: config.telegramNotify ?? false,
      telegramChatId: config.telegramChatId || process.env.TELEGRAM_CHAT_ID,
      ...config
    };

    // State
    this.watching = new Map();
    this.watchers = new Map();
    this.fileHashes = new Map();
    this.changeQueue = new Map();
    this.debounceTimers = new Map();
    this.scanIntervalId = null;
    this.autoCommitIntervalId = null;
    this.isRunning = false;

    // Stats
    this.stats = {
      filesScanned: 0,
      changesDetected: 0,
      commitsTriggered: 0,
      errors: 0,
      startTime: null,
      lastScan: null,
      lastCommit: null
    };

    // Import dependencies lazily
    this.git = null;
    this.telegram = null;
    this.router = null;
  }

  // ========== Lifecycle ==========

  async start() {
    if (this.isRunning) {
      console.log('[WatcherDaemon] Already running');
      return { success: true, message: 'Already running' };
    }

    console.log('[WatcherDaemon] Starting background watcher...');
    this.stats.startTime = new Date();
    this.isRunning = true;

    // Initialize dependencies
    await this._initDependencies();

    // Build initial file index
    await this._buildFileIndex();

    // Start watching paths
    for (const watchPath of this.config.watchPaths) {
      await this.addPath(watchPath);
    }

    // Start periodic scan
    this._startPeriodicScan();

    // Start auto-commit timer
    if (this.config.enableAutoCommit) {
      this._startAutoCommitTimer();
    }

    console.log(`[WatcherDaemon] Started. Watching ${this.watching.size} paths.`);
    return { success: true, watching: this.watching.size };
  }

  async stop() {
    if (!this.isRunning) {
      return { success: true, message: 'Not running' };
    }

    console.log('[WatcherDaemon] Stopping...');

    // Clear intervals
    if (this.scanIntervalId) {
      clearInterval(this.scanIntervalId);
      this.scanIntervalId = null;
    }

    if (this.autoCommitIntervalId) {
      clearInterval(this.autoCommitIntervalId);
      this.autoCommitIntervalId = null;
    }

    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close file watchers
    for (const [watchPath, watcher] of this.watchers) {
      try {
        watcher.close();
      } catch (err) {
        console.warn(`[WatcherDaemon] Error closing watcher for ${watchPath}:`, err.message);
      }
    }
    this.watchers.clear();

    this.isRunning = false;
    console.log('[WatcherDaemon] Stopped.');
    return { success: true, stats: this.stats };
  }

  async restart() {
    await this.stop();
    return this.start();
  }

  // ========== Path Management ==========

  async addPath(watchPath) {
    const resolvedPath = path.resolve(watchPath);

    // Check if path exists
    if (!fs.existsSync(resolvedPath)) {
      console.warn(`[WatcherDaemon] Path does not exist: ${resolvedPath}`);
      return { success: false, error: 'Path does not exist' };
    }

    // Check if already watching
    if (this.watching.has(resolvedPath)) {
      return { success: true, message: 'Already watching', path: resolvedPath };
    }

    // Create watcher using chokidar-like approach with fs.watch
    try {
      const watcher = fs.watch(resolvedPath, {
        recursive: true,
        persistent: false // Don't keep process alive, use events
      });

      watcher.on('change', (eventType, filename) => {
        if (filename) {
          this._onFileChange(resolvedPath, filename, eventType);
        }
      });

      watcher.on('error', (err) => {
        console.error(`[WatcherDaemon] Watcher error for ${resolvedPath}:`, err.message);
        this.stats.errors++;
        this.emit('error', { path: resolvedPath, error: err.message });
      });

      this.watchers.set(resolvedPath, watcher);
      this.watching.set(resolvedPath, {
        path: resolvedPath,
        addedAt: new Date(),
        fileCount: 0
      });

      console.log(`[WatcherDaemon] Now watching: ${resolvedPath}`);
      this.emit('watch', { path: resolvedPath });

      return { success: true, path: resolvedPath };

    } catch (err) {
      console.error(`[WatcherDaemon] Failed to watch ${resolvedPath}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async removePath(watchPath) {
    const resolvedPath = path.resolve(watchPath);

    const watcher = this.watchers.get(resolvedPath);
    if (!watcher) {
      return { success: false, error: 'Not watching this path' };
    }

    try {
      watcher.close();
      this.watchers.delete(resolvedPath);
      this.watching.delete(resolvedPath);

      console.log(`[WatcherDaemon] Stopped watching: ${resolvedPath}`);
      this.emit('unwatch', { path: resolvedPath });

      return { success: true, path: resolvedPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ========== File Change Handling ==========

  _onFileChange(basePath, filename, eventType) {
    // Skip ignored patterns
    if (this._isIgnored(filename)) {
      return;
    }

    const fullPath = path.join(basePath, filename);
    const changeKey = fullPath;

    // Queue the change with debounce
    this.changeQueue.set(changeKey, {
      path: fullPath,
      type: eventType,
      timestamp: Date.now()
    });

    // Debounce to avoid rapid-fire events
    if (this.debounceTimers.has(changeKey)) {
      clearTimeout(this.debounceTimers.get(changeKey));
    }

    const timer = setTimeout(() => {
      this._processChange(changeKey);
      this.debounceTimers.delete(changeKey);
    }, this.config.debounceMs);

    this.debounceTimers.set(changeKey, timer);
  }

  _processChange(changeKey) {
    const change = this.changeQueue.get(changeKey);
    if (!change) return;

    this.changeQueue.delete(changeKey);
    this.stats.changesDetected++;

    console.log(`[WatcherDaemon] Change detected: ${change.path} (${change.type})`);

    // Emit event
    this.emit('change', change);

    // Notify via Telegram if enabled
    if (this.config.telegramNotify && this.telegram) {
      this._notifyTelegram(change);
    }
  }

  _isIgnored(filename) {
    const fullPath = filename;
    for (const pattern of this.config.ignoredPatterns) {
      if (pattern.includes('**')) {
        const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
        if (regex.test(fullPath)) return true;
      } else if (fullPath.includes(pattern)) {
        return true;
      }
    }
    return false;
  }

  // ========== File Indexing ==========

  async _buildFileIndex() {
    console.log('[WatcherDaemon] Building initial file index...');
    const startTime = Date.now();

    for (const watchPath of this.config.watchPaths) {
      try {
        const files = await this._scanDirectory(watchPath);

        for (const file of files) {
          try {
            const hash = await this._getFileHash(file);
            this.fileHashes.set(file, hash);
          } catch {
            // Skip files we can't read
          }
        }

        const entry = this.watching.get(path.resolve(watchPath));
        if (entry) {
          entry.fileCount = files.length;
        }

      } catch (err) {
        console.error(`[WatcherDaemon] Error scanning ${watchPath}:`, err.message);
        this.stats.errors++;
      }
    }

    this.stats.filesScanned = this.fileHashes.size;
    console.log(`[WatcherDaemon] Indexed ${this.stats.filesScanned} files in ${Date.now() - startTime}ms`);
  }

  async _scanDirectory(dirPath, files = []) {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (this._isIgnored(fullPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          await this._scanDirectory(fullPath, files);
        } else if (entry.isFile()) {
          const stats = await fs.promises.stat(fullPath);
          if (stats.size <= this.config.maxFileSize) {
            files.push(fullPath);
          }
        }
      }
    } catch (err) {
      // Skip directories we can't read
    }

    return files;
  }

  async _getFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  // ========== Periodic Scan ==========

  _startPeriodicScan() {
    this.scanIntervalId = setInterval(async () => {
      await this._periodicScan();
    }, this.config.scanInterval);
  }

  async _periodicScan() {
    this.stats.lastScan = new Date();
    console.log('[WatcherDaemon] Running periodic scan...');

    const changes = [];

    for (const [filePath, oldHash] of this.fileHashes) {
      try {
        const stats = await fs.promises.stat(filePath);

        // File was deleted
        if (!stats) {
          this.fileHashes.delete(filePath);
          changes.push({ path: filePath, type: 'deleted' });
          continue;
        }

        // File was modified
        const newHash = await this._getFileHash(filePath);
        if (newHash !== oldHash) {
          this.fileHashes.set(filePath, newHash);
          changes.push({ path: filePath, type: 'modified' });
        }

      } catch (err) {
        // File was deleted or can't be read
        if (err.code === 'ENOENT') {
          this.fileHashes.delete(filePath);
          changes.push({ path: filePath, type: 'deleted' });
        }
      }
    }

    // Check for new files
    for (const watchPath of this.config.watchPaths) {
      const files = await this._scanDirectory(watchPath);
      for (const file of files) {
        if (!this.fileHashes.has(file)) {
          try {
            const hash = await this._getFileHash(file);
            this.fileHashes.set(file, hash);
            changes.push({ path: file, type: 'added' });
          } catch {
            // Skip
          }
        }
      }
    }

    if (changes.length > 0) {
      console.log(`[WatcherDaemon] Periodic scan found ${changes.length} changes`);
      this.emit('scan', { changes, timestamp: this.stats.lastScan });
    }

    this.stats.filesScanned = this.fileHashes.size;
  }

  // ========== Auto-Commit ==========

  _startAutoCommitTimer() {
    this.autoCommitIntervalId = setInterval(async () => {
      await this._autoCommitCheck();
    }, this.config.autoCommitInterval);
  }

  async _autoCommitCheck() {
    if (!this.git) {
      await this._initGit();
    }

    try {
      const hasChanges = await this.git.hasChanges();

      if (hasChanges) {
        console.log('[WatcherDaemon] Changes detected, triggering auto-commit...');

        // Generate commit message based on changes
        const analysis = await this.git.analyzeChanges();
        const message = await this.git.generateCommitMessage(analysis);

        // Commit but don't push (push requires explicit action)
        const result = await this.git.autoCommit(message, { all: true });

        if (result.success) {
          this.stats.commitsTriggered++;
          this.stats.lastCommit = new Date();

          console.log(`[WatcherDaemon] Auto-committed: ${message}`);
          this.emit('commit', { message, result });

          // Notify via Telegram
          if (this.config.telegramNotify && this.telegram) {
            await this.telegram.sendMessage(
              this.config.telegramChatId,
              `📦 Auto-commit: ${message}\n\nTriggered by watcher after ${this.config.autoCommitInterval / 1000 / 60} minutes of inactivity.`
            );
          }
        }
      }
    } catch (err) {
      console.error('[WatcherDaemon] Auto-commit failed:', err.message);
      this.stats.errors++;
    }
  }

  // ========== Telegram Integration ==========

  async _notifyTelegram(change) {
    if (!this.telegram) return;

    try {
      const filename = path.basename(change.path);
      const relativePath = path.relative(this.config.projectsPath, change.path);

      await this.telegram.sendMessage(
        this.config.telegramChatId,
        `📝 File ${change.type}: \`${relativePath}\`\n\n_Use /scan to analyze or /push to commit._`
      );
    } catch (err) {
      console.error('[WatcherDaemon] Telegram notification failed:', err.message);
    }
  }

  // ========== Initialization ==========

  async _initDependencies() {
    // Lazy load dependencies
    if (!this.git) {
      await this._initGit();
    }

    if (!this.router) {
      try {
        const { ProviderRouter } = await import('../providers/ProviderRouter.js');
        this.router = new ProviderRouter();
      } catch (err) {
        console.warn('[WatcherDaemon] ProviderRouter not available:', err.message);
      }
    }

    if (this.config.telegramNotify && !this.telegram) {
      await this._initTelegram();
    }
  }

  async _initGit() {
    try {
      const { AutoGit } = await import('../git/AutoGit.js');
      this.git = new AutoGit(this.config.projectsPath);
      console.log('[WatcherDaemon] AutoGit initialized');
    } catch (err) {
      console.warn('[WatcherDaemon] AutoGit not available:', err.message);
    }
  }

  async _initTelegram() {
    try {
      const { TelegramCommandRouter } = await import('../telegram/CommandRouter.js');
      this.telegram = new TelegramCommandRouter();
      console.log('[WatcherDaemon] Telegram initialized');
    } catch (err) {
      console.warn('[WatcherDaemon] Telegram not available:', err.message);
    }
  }

  // ========== Git Commands ==========

  async triggerCommit(message = null) {
    if (!this.git) {
      await this._initGit();
    }

    if (!this.git) {
      return { success: false, error: 'Git not available' };
    }

    try {
      const result = await this.git.executeFullWorkflow({
        commitMessage: message || `Watcher auto-commit ${new Date().toISOString()}`,
        push: false // Don't auto-push
      });

      if (result.success) {
        this.stats.commitsTriggered++;
        this.stats.lastCommit = new Date();
      }

      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async triggerPush(message = null) {
    if (!this.git) {
      await this._initGit();
    }

    if (!this.git) {
      return { success: false, error: 'Git not available' };
    }

    try {
      const result = await this.git.executeFullWorkflow({
        commitMessage: message || `Watcher push ${new Date().toISOString()}`,
        push: true,
        merge: false
      });

      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ========== Status & Stats ==========

  getStatus() {
    return {
      running: this.isRunning,
      watching: Array.from(this.watching.values()),
      stats: { ...this.stats },
      config: {
        debounceMs: this.config.debounceMs,
        scanInterval: this.config.scanInterval,
        autoCommitEnabled: this.config.enableAutoCommit,
        telegramNotify: this.config.telegramNotify
      },
      queueSize: this.changeQueue.size,
      fileIndexSize: this.fileHashes.size
    };
  }

  getWatchedPaths() {
    return Array.from(this.watching.keys());
  }

  getRecentChanges(limit = 50) {
    return Array.from(this.changeQueue.values())
      .slice(-limit);
  }

  getFileStats() {
    return {
      totalFiles: this.fileHashes.size,
      lastScan: this.stats.lastScan,
      pendingChanges: this.changeQueue.size
    };
  }

  // ========== Configuration Updates ==========

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('[WatcherDaemon] Configuration updated');
    return { success: true, config: this.config };
  }

  setDebounce(ms) {
    this.config.debounceMs = ms;
    return { success: true, debounceMs: ms };
  }

  setScanInterval(ms) {
    this.config.scanInterval = ms;
    if (this.scanIntervalId) {
      clearInterval(this.scanIntervalId);
      this._startPeriodicScan();
    }
    return { success: true, scanInterval: ms };
  }

  enableTelegram(chatId) {
    this.config.telegramNotify = true;
    this.config.telegramChatId = chatId || process.env.TELEGRAM_CHAT_ID;
    this._initTelegram();
    return { success: true };
  }

  disableTelegram() {
    this.config.telegramNotify = false;
    this.telegram = null;
    return { success: true };
  }
}

// ========== CLI Entry Point ==========

export async function runWatcherDaemon() {
  const daemon = new WatcherDaemon({
    projectsPath: process.env.HOME + '/Projects',
    enableAutoCommit: true,
    telegramNotify: !!process.env.TELEGRAM_BOT_TOKEN
  });

  // Handle signals
  process.on('SIGINT', async () => {
    console.log('\\n[WatcherDaemon] Received SIGINT, shutting down...');
    await daemon.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\\n[WatcherDaemon] Received SIGTERM, shutting down...');
    await daemon.stop();
    process.exit(0);
  });

  // Start daemon
  await daemon.start();

  // Keep process alive
  console.log('[WatcherDaemon] Running in background. Press Ctrl+C to stop.');

  return daemon;
}

export default WatcherDaemon;