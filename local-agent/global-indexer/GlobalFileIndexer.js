/**
 * Global File Indexer
 * Recursively scans /Users/liemdo/ for git repos, package.json, README, language detection
 * and duplicate repo detection. Stores index in .super-agent-ai/index/
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, basename, extname } from 'path';
import { execSync } from 'child_process';

const INDEX_DIR = '/Users/liemdo/.super-agent-ai/index';
const SCAN_ROOT = '/Users/liemdo';

// Language detection by file extension
const LANGUAGE_MAP = {
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript',
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.py': 'Python', '.pyw': 'Python',
  '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin',
  '.go': 'Go', '.rs': 'Rust', '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.c': 'C', '.h': 'C',
  '.rb': 'Ruby', '.php': 'PHP',
  '.cs': 'C#', '.fs': 'F#', '.vb': 'Visual Basic',
  '.swift': 'Swift', '.m': 'Objective-C',
  '.html': 'HTML', '.css': 'CSS', '.scss': 'CSS', '.sass': 'CSS',
  '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.xml': 'XML',
  '.md': 'Markdown', '.txt': 'Text',
  '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell',
  '.sql': 'SQL', '.graphql': 'GraphQL',
  '.vue': 'Vue', '.svelte': 'Svelte',
  '.dockerfile': 'Docker', '.dockerignore': 'Docker',
  '.tf': 'Terraform', '.tfvars': 'Terraform',
};

// System and library directories to skip entirely during recursive scanning
const IGNORE_SYSTEM_DIRS = new Set([
  'Library', 'Applications', 'Pictures', 'Music', 'Movies', '.Trash',
  'Public', 'System', 'Network', 'Volumes', 'bin', 'sbin', 'usr', 'etc', 'var', 'opt', 'tmp',
  'node_modules', 'dist', 'build', 'out', 'target', '.gradle', 'node',
  '.npm', '.cocoapods', '.cache', '.docker', '.cargo', '.rustup', '.local', '.local-agent',
  '.git', '.svn', '.hg', '.idea', '.vscode', '.vs', 'coverage', '.nyc_output',
  '__pycache__', '.venv', 'venv', 'env', '.env', 'vendor', 'dist-server',
]);

export class GlobalFileIndexer {
  constructor() {
    this.index = {
      version: '1.0.0',
      lastScanned: null,
      projects: [],
      totalRepos: 0,
      languages: {},
    };
    this.seenDirs = new Set();
    this.registeredNames = new Map(); // name -> firstPath
    this.registeredRemotes = new Map(); // remoteUrl -> firstPath
  }

  async scan() {
    console.log('[GlobalFileIndexer] Starting scan of', SCAN_ROOT);
    const start = Date.now();
    
    this.index.projects = [];
    this.index.totalRepos = 0;
    this.index.languages = {};
    this.seenDirs.clear();
    this.registeredNames.clear();
    this.registeredRemotes.clear();

    await this._scanDir(SCAN_ROOT);
    
    // Process duplicate markings
    this._detectDuplicates();

    this.index.lastScanned = new Date().toISOString();
    this._saveIndex();
    
    console.log(`[GlobalFileIndexer] Scan complete in ${Date.now() - start}ms`);
    console.log(`  Found ${this.index.projects.length} projects, ${this.index.totalRepos} repos`);
    return this.index;
  }

  async _scanDir(dir, depth = 0) {
    if (depth > 8) return; // Limit depth to keep scans fast and shallow under user root

    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    // First check if this directory itself is a project
    const isGit = entries.includes('.git');
    const isNode = entries.includes('package.json');

    if (isGit || isNode) {
      if (!this.seenDirs.has(dir)) {
        this.seenDirs.add(dir);
        const proj = await this._processProject(dir, isGit, isNode);
        if (proj) {
          this.index.projects.push(proj);
          if (isGit) this.index.totalRepos++;
        }
      }
    }

    // Now traverse subdirectories
    for (const entry of entries) {
      if (entry.startsWith('.') && entry !== '.super-agent-ai') continue;
      if (IGNORE_SYSTEM_DIRS.has(entry)) continue;

      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          await this._scanDir(fullPath, depth + 1);
        }
      } catch {}
    }
  }

  async _processProject(projPath, isGit, isNode) {
    const proj = {
      type: isGit ? 'git-repo' : 'node-project',
      path: projPath,
      name: basename(projPath),
      version: '0.0.0',
      description: '',
      remoteUrl: '',
      defaultBranch: '',
      lastCommit: '',
      lastCommitAuthor: '',
      lastCommitEmail: '',
      lastCommitMsg: '',
      commitCount: 0,
      readmeHeaders: [],
      readmePreview: '',
      language: 'Unknown',
      dependencies: [],
      devDependencies: [],
      scripts: [],
      hasLockFile: false,
      isDuplicate: false,
      duplicateOf: null,
      scannedAt: new Date().toISOString(),
    };

    // Git Info
    if (isGit) {
      try {
        proj.remoteUrl = execSync('git remote get-url origin 2>/dev/null', { cwd: projPath, encoding: 'utf8' }).trim();
      } catch {}
      try {
        proj.defaultBranch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { cwd: projPath, encoding: 'utf8' }).trim();
      } catch {}
      try {
        const commitInfo = execSync('git log -1 --format="%H|%an|%ae|%s" 2>/dev/null', { cwd: projPath, encoding: 'utf8' }).trim();
        if (commitInfo) {
          const parts = commitInfo.split('|');
          proj.lastCommit = parts[0] || '';
          proj.lastCommitAuthor = parts[1] || '';
          proj.lastCommitEmail = parts[2] || '';
          proj.lastCommitMsg = parts[3] || '';
        }
      } catch {}
      try {
        proj.commitCount = parseInt(execSync('git rev-list --count HEAD 2>/dev/null', { cwd: projPath, encoding: 'utf8' }).trim()) || 0;
      } catch {}
    }

    // Package.json Info
    if (isNode) {
      try {
        const pkgContent = readFileSync(join(projPath, 'package.json'), 'utf8');
        const pkg = JSON.parse(pkgContent);
        proj.name = pkg.name || proj.name;
        proj.version = pkg.version || proj.version;
        proj.description = pkg.description || proj.description;
        proj.dependencies = Object.keys(pkg.dependencies || {});
        proj.devDependencies = Object.keys(pkg.devDependencies || {});
        proj.scripts = Object.keys(pkg.scripts || {});
        proj.hasLockFile = existsSync(join(projPath, 'package-lock.json')) ||
                           existsSync(join(projPath, 'yarn.lock')) ||
                           existsSync(join(projPath, 'pnpm-lock.yaml'));
      } catch {}
    }

    // README info
    const readmeFile = readdirSync(projPath).find(f => f.toLowerCase() === 'readme.md' || f.toLowerCase() === 'readme.txt');
    if (readmeFile) {
      try {
        const readmePath = join(projPath, readmeFile);
        const content = readFileSync(readmePath, 'utf8');
        proj.readmePreview = content.replace(/[#*`]/g, '').substring(0, 300).trim();
        
        // Extract headers
        const headers = [];
        const lines = content.split('\n');
        for (const line of lines) {
          const match = line.match(/^#+\s+(.+)$/);
          if (match) {
            headers.push(match[1].trim());
            if (headers.length >= 3) break;
          }
        }
        proj.readmeHeaders = headers;
      } catch {}
    }

    // Language detection based on source files in the project
    proj.language = this._detectDominantLanguage(projPath);
    this._updateLanguageCount(proj.language);

    return proj;
  }

  _detectDominantLanguage(projPath) {
    const extCounts = {};
    const maxFilesToCheck = 100;
    let checkedCount = 0;

    const scanDirFiles = (dir, depth = 0) => {
      if (depth > 4 || checkedCount >= maxFilesToCheck) return;
      let files;
      try {
        files = readdirSync(dir);
      } catch {
        return;
      }

      for (const f of files) {
        if (f.startsWith('.') || IGNORE_SYSTEM_DIRS.has(f)) continue;
        const full = join(dir, f);
        try {
          const st = statSync(full);
          if (st.isDirectory()) {
            scanDirFiles(full, depth + 1);
          } else {
            const ext = extname(f).toLowerCase();
            if (LANGUAGE_MAP[ext]) {
              extCounts[LANGUAGE_MAP[ext]] = (extCounts[LANGUAGE_MAP[ext]] || 0) + 1;
              checkedCount++;
            }
          }
        } catch {}
        if (checkedCount >= maxFilesToCheck) break;
      }
    };

    scanDirFiles(projPath);

    let dominant = 'Unknown';
    let max = 0;
    for (const [lang, count] of Object.entries(extCounts)) {
      if (count > max) {
        max = count;
        dominant = lang;
      }
    }
    return dominant;
  }

  _updateLanguageCount(lang) {
    this.index.languages[lang] = (this.index.languages[lang] || 0) + 1;
  }

  _detectDuplicates() {
    for (const proj of this.index.projects) {
      // 1. Duplicate by package name
      if (proj.name && proj.name !== 'Unknown') {
        const key = proj.name.toLowerCase();
        if (this.registeredNames.has(key)) {
          proj.isDuplicate = true;
          proj.duplicateOf = this.registeredNames.get(key);
        } else {
          this.registeredNames.set(key, proj.path);
        }
      }
      // 2. Duplicate by git remote url
      if (proj.remoteUrl) {
        const key = proj.remoteUrl.toLowerCase();
        if (this.registeredRemotes.has(key)) {
          proj.isDuplicate = true;
          proj.duplicateOf = this.registeredRemotes.get(key);
        } else {
          this.registeredRemotes.set(key, proj.path);
        }
      }
    }
  }

  _saveIndex() {
    try {
      if (!existsSync(INDEX_DIR)) {
        mkdirSync(INDEX_DIR, { recursive: true });
      }
      const indexPath = join(INDEX_DIR, 'global-index.json');
      writeFileSync(indexPath, JSON.stringify(this.index, null, 2));
    } catch (e) {
      console.error('[GlobalFileIndexer] Failed to save index:', e.message);
    }
  }

  loadIndex() {
    const indexPath = join(INDEX_DIR, 'global-index.json');
    if (existsSync(indexPath)) {
      try {
        const data = JSON.parse(readFileSync(indexPath, 'utf8'));
        this.index = data;
        return data;
      } catch {
        return null;
      }
    }
    return null;
  }

  searchProjects(query) {
    const q = query.toLowerCase();
    return this.index.projects.filter(p => 
      p.name?.toLowerCase().includes(q) ||
      p.path?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.remoteUrl?.toLowerCase().includes(q)
    );
  }

  getStats() {
    return {
      totalProjects: this.index.projects.length,
      totalRepos: this.index.totalRepos,
      languages: this.index.languages,
      lastScanned: this.index.lastScanned,
    };
  }
}

export default GlobalFileIndexer;