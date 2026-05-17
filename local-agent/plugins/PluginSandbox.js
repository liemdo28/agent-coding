// local-agent/plugins/PluginSandbox.js
// Phase 27: Plugin sandbox — isolated execution environment for plugins

export class PluginSandbox {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.loadedPlugins = new Map();
    this.allowedAPIs = ['file:read', 'file:write', 'log', 'config:get', 'config:set'];
  }

  loadPlugin(manifest, pluginPath) {
    const plugin = {
      name: manifest.name,
      version: manifest.version,
      path: pluginPath,
      rules: this.loadRules(pluginPath),
      recipes: this.loadRecipes(pluginPath),
      scanners: this.loadScanners(pluginPath),
      loadedAt: new Date().toISOString(),
    };
    this.loadedPlugins.set(manifest.name, plugin);
    return plugin;
  }

  unloadPlugin(name) {
    this.loadedPlugins.delete(name);
  }

  loadRules(pluginPath) {
    const rulesDir = `${pluginPath}/rules`;
    const { existsSync, readdirSync, readFileSync } = require('fs');
    if (!existsSync(rulesDir)) return [];
    try {
      const files = readdirSync(rulesDir).filter(f => f.endsWith('.json'));
      return files.map(f => {
        try { return JSON.parse(readFileSync(`${rulesDir}/${f}`, 'utf8')); } catch { return null; }
      }).filter(Boolean);
    } catch { return []; }
  }

  loadRecipes(pluginPath) {
    const recipesDir = `${pluginPath}/recipes`;
    const { existsSync, readdirSync, readFileSync } = require('fs');
    if (!existsSync(recipesDir)) return [];
    try {
      const files = readdirSync(recipesDir).filter(f => f.endsWith('.json'));
      return files.map(f => {
        try { return JSON.parse(readFileSync(`${recipesDir}/${f}`, 'utf8')); } catch { return null; }
      }).filter(Boolean);
    } catch { return []; }
  }

  loadScanners(pluginPath) {
    const scannersDir = `${pluginPath}/scanners`;
    const { existsSync, readdirSync } = require('fs');
    if (!existsSync(scannersDir)) return [];
    try {
      return readdirSync(scannersDir).filter(f => f.endsWith('.js'));
    } catch { return []; }
  }

  canAccessAPI(api) {
    return this.allowedAPIs.includes(api);
  }

  getLoadedPlugins() {
    return Array.from(this.loadedPlugins.values());
  }

  getPlugin(name) {
    return this.loadedPlugins.get(name);
  }
}

export default PluginSandbox;