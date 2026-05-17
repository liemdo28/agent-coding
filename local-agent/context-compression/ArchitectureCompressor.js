/**
 * Phase 54 - Architecture Compressor
 * Summarize project architecture into compressed form
 */
const fs = require('fs');
const path = require('path');

class ArchitectureCompressor {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Compress architecture to summary
   */
  compress(architecture, options = {}) {
    const { maxModules = 30, includeDeps = true } = options;

    const compressed = {
      overview: this.extractOverview(architecture),
      modules: this.compressModules(architecture.modules || [], maxModules),
      dependencies: includeDeps ? this.compressDependencies(architecture) : [],
      entryPoints: architecture.entryPoints || [],
      compressedAt: new Date().toISOString()
    };

    return compressed;
  }

  /**
   * Extract architecture overview
   */
  extractOverview(architecture) {
    return {
      projectType: architecture.projectType || architecture.type || 'unknown',
      framework: architecture.framework || architecture.frameworks?.[0] || 'none',
      language: architecture.language || architecture.languages?.[0] || 'unknown',
      moduleCount: architecture.modules?.length || 0,
      fileCount: architecture.fileCount || architecture.stats?.totalFiles || 0,
      layers: this.extractLayers(architecture)
    };
  }

  /**
   * Extract architectural layers
   */
  extractLayers(architecture) {
    const layers = [];
    
    if (architecture.routes?.length) layers.push('API');
    if (architecture.components?.length) layers.push('UI');
    if (architecture.endpoints?.length) layers.push('Backend');
    if (architecture.models?.length || architecture.schemas?.length) layers.push('Data');
    
    return layers;
  }

  /**
   * Compress modules list
   */
  compressModules(modules, maxModules) {
    const compressed = modules.slice(0, maxModules).map(m => ({
      name: m.name || m.path,
      type: m.type || 'module',
      complexity: m.complexity || this.estimateComplexity(m),
      imports: m.imports?.length || 0,
      exports: m.exports?.length || m.exportsCount || 0
    }));

    return {
      modules: compressed,
      total: modules.length,
      truncated: modules.length > maxModules
    };
  }

  /**
   * Estimate module complexity
   */
  estimateComplexity(module) {
    const lines = module.lines || module.size || 0;
    const deps = module.imports?.length || 0;
    const exports = module.exports?.length || 0;
    
    const score = (lines / 100) + deps + (exports * 0.5);
    
    if (score > 20) return 'HIGH';
    if (score > 10) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Compress dependency information
   */
  compressDependencies(architecture) {
    const deps = architecture.dependencies || architecture.deps || [];
    const internal = deps.filter(d => d.startsWith('./') || d.startsWith('../'));
    const external = deps.filter(d => !d.startsWith('./') && !d.startsWith('../'));

    return {
      internal: {
        count: internal.length,
        samples: internal.slice(0, 10)
      },
      external: {
        count: external.length,
        samples: external.slice(0, 10),
        critical: external.filter(d => 
          ['react', 'express', 'vite', 'webpack', 'typescript'].some(c => d.includes(c))
        )
      }
    };
  }

  /**
   * Generate architecture summary text
   */
  generateSummary(architecture) {
    const overview = this.extractOverview(architecture);
    
    return [
      `Architecture: ${overview.projectType} (${overview.framework})`,
      `Language: ${overview.language}`,
      `Modules: ${overview.moduleCount}, Files: ${overview.fileCount}`,
      `Layers: ${overview.layers.join(' → ')}`
    ].join('\n');
  }
}

module.exports = { ArchitectureCompressor };