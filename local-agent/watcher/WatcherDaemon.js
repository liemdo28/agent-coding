// local-agent/watcher/WatcherDaemon.js
import { AutoGit } from '../git/AutoGit.js';
// Normally would import chokidar: import chokidar from 'chokidar';

export class WatcherDaemon {
  constructor(watchPath = process.cwd()) {
    this.watchPath = watchPath;
    this.git = new AutoGit(this.watchPath);
    this.debounceTimer = null;
    this.changesQueue = [];
  }

  start() {
    console.log(`[WatcherDaemon] Starting daemon to monitor: ${this.watchPath}`);
    
    // In a real application we would use chokidar
    // this.watcher = chokidar.watch(this.watchPath, {
    //   ignored: /(^|[\/\\])\..|node_modules|dist/,
    //   persistent: true
    // });
    // this.watcher.on('all', (event, path) => this.onChange(event, path));
    
    // Mocking watcher activity for now
    console.log('[WatcherDaemon] (Mock) Listening for filesystem events...');
  }

  onChange(event, path) {
    console.log(`[WatcherDaemon] Event ${event} at ${path}`);
    this.changesQueue.push(path);
    
    // Debounce the autonomous trigger
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    
    this.debounceTimer = setTimeout(() => {
      this.triggerAutonomousWorkflow();
    }, 5000); // 5 seconds of inactivity triggers a workflow
  }

  async triggerAutonomousWorkflow() {
    if (this.changesQueue.length === 0) return;
    
    console.log(`[WatcherDaemon] File changes settled. Triggering auto-commit for ${this.changesQueue.length} files...`);
    this.changesQueue = []; // Clear queue

    try {
      await this.git.executeFullWorkflow('Auto-commit by WatcherDaemon');
    } catch (err) {
      console.error(`[WatcherDaemon] Autonomous workflow failed:`, err.message);
    }
  }

  stop() {
    console.log('[WatcherDaemon] Stopping daemon...');
    if (this.watcher) {
      this.watcher.close();
    }
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }
}
