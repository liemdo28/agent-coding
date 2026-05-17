// local-agent/team/TeamPackExporter.js
// Phase 28: Team pack exporter — export knowledge packs for team sharing

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { MemorySanitizer } from '../memory/MemorySanitizer.js';

export class TeamPackExporter {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.sanitizer = new MemorySanitizer();
    this.packDir = join(workspaceRoot, '.local-agent', 'team-packs');
    this.ensurePackDir();
  }

  ensurePackDir() {
    mkdirSync(this.packDir, { recursive: true });
  }

  async exportMemoryPack(options = {}) {
    const packId = `memory-pack-${Date.now()}`;
    const pack = {
      id: packId,
      type: 'MEMORY_PACK',
      exportedAt: new Date().toISOString(),
      exportedBy: options.exportedBy || 'local-agent',
      version: '1.0',
      contents: {},
    };

    // Export project profile
    if (options.includeProfile !== false) {
      pack.contents.profile = this.loadProjectProfile();
    }

    // Export fix recipes
    if (options.includeRecipes !== false) {
      pack.contents.recipes = this.loadFixHistory();
    }

    // Export QA reports summary
    if (options.includeQA) {
      pack.contents.qaSummary = this.loadQASummary();
    }

    // Export coding standards
    if (options.includeStandards) {
      pack.contents.standards = this.loadStandards();
    }

    // Sanitize secrets
    const sanitizedPack = this.sanitizer.sanitizePack(pack);

    const packPath = join(this.packDir, `${packId}.json`);
    writeFileSync(packPath, JSON.stringify(sanitizedPack, null, 2));

    return {
      success: true,
      packId,
      packPath,
      contents: Object.keys(sanitizedPack.contents),
      sanitized: sanitizedPack !== pack,
    };
  }

  async exportRecipes(options = {}) {
    const packId = `recipes-pack-${Date.now()}`;
    const pack = {
      id: packId,
      type: 'RECIPES_PACK',
      exportedAt: new Date().toISOString(),
      exportedBy: options.exportedBy || 'local-agent',
      version: '1.0',
      contents: {
        recipes: this.loadFixHistory(),
      },
    };

    const sanitizedPack = this.sanitizer.sanitizePack(pack);
    const packPath = join(this.packDir, `${packId}.json`);
    writeFileSync(packPath, JSON.stringify(sanitizedPack, null, 2));

    return {
      success: true,
      packId,
      packPath,
      recipeCount: sanitizedPack.contents.recipes?.length || 0,
    };
  }

  importPack(packPath) {
    if (!existsSync(packPath)) {
      throw new Error(`Pack file not found: ${packPath}`);
    }

    const content = readFileSync(packPath, 'utf8');
    const pack = JSON.parse(content);

    const validation = this.validatePack(pack);
    if (!validation.valid) {
      throw new Error(`Invalid pack: ${validation.errors.join(', ')}`);
    }

    const imported = { success: true, packId: pack.id, type: pack.type };

    // Import based on type
    if (pack.type === 'MEMORY_PACK' && pack.contents.profile) {
      this.importProfile(pack.contents.profile);
      imported.profile = true;
    }
    if (pack.contents.recipes) {
      imported.recipes = this.importRecipes(pack.contents.recipes);
    }

    return imported;
  }

  validatePack(pack) {
    const errors = [];
    if (!pack.id) errors.push('Missing pack id');
    if (!pack.type) errors.push('Missing pack type');
    if (!pack.exportedAt) errors.push('Missing export timestamp');
    if (!pack.version) errors.push('Missing version');
    if (!pack.contents) errors.push('Missing contents');
    return { valid: errors.length === 0, errors };
  }

  loadProjectProfile() {
    const profileFile = join(this.workspaceRoot, '.local-agent', 'project-profile.json');
    if (existsSync(profileFile)) {
      try { return JSON.parse(readFileSync(profileFile, 'utf8')); } catch { /* ignore */ }
    }
    return null;
  }

  loadFixHistory() {
    const historyFile = join(this.workspaceRoot, '.local-agent', 'fix-history.json');
    if (existsSync(historyFile)) {
      try { return JSON.parse(readFileSync(historyFile, 'utf8')); } catch { /* ignore */ }
    }
    return [];
  }

  loadQASummary() {
    const reportsDir = join(this.workspaceRoot, '.local-agent', 'reports');
    if (!existsSync(reportsDir)) return null;
    try {
      const files = readdirSync(reportsDir).filter(f => f.startsWith('qa-report-') && f.endsWith('.json'));
      if (files.length === 0) return null;
      const latest = JSON.parse(readFileSync(join(reportsDir, files.sort().reverse()[0]), 'utf8'));
      return {
        lastReport: latest.generatedAt,
        score: latest.qaScore,
        buildSuccess: latest.buildSuccess,
        testSuccess: latest.testSuccess,
      };
    } catch { return null; }
  }

  loadStandards() {
    const standardsFile = join(this.workspaceRoot, '.local-agent', 'standards.json');
    if (existsSync(standardsFile)) {
      try { return JSON.parse(readFileSync(standardsFile, 'utf8')); } catch { /* ignore */ }
    }
    return null;
  }

  importProfile(profile) {
    const profileFile = join(this.workspaceRoot, '.local-agent', 'project-profile.json');
    try {
      writeFileSync(profileFile, JSON.stringify(profile, null, 2));
      return true;
    } catch { return false; }
  }

  importRecipes(recipes) {
    const historyFile = join(this.workspaceRoot, '.local-agent', 'fix-history.json');
    let existing = [];
    if (existsSync(historyFile)) {
      try { existing = JSON.parse(readFileSync(historyFile, 'utf8')); } catch { /* ignore */ }
    }
    const merged = [...existing, ...recipes];
    writeFileSync(historyFile, JSON.stringify(merged, null, 2));
    return recipes.length;
  }

  listPacks() {
    if (!existsSync(this.packDir)) return [];
    try {
      const files = readdirSync(this.packDir).filter(f => f.endsWith('.json'));
      return files.map(f => {
        const content = readFileSync(join(this.packDir, f), 'utf8');
        const pack = JSON.parse(content);
        return {
          id: pack.id,
          type: pack.type,
          exportedAt: pack.exportedAt,
          exportedBy: pack.exportedBy,
          contents: Object.keys(pack.contents || {}),
          size: statSync(join(this.packDir, f)).size,
        };
      });
    } catch { return []; }
  }
}

export default TeamPackExporter;