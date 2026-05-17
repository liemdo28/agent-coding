// plugins/PluginRegistry.js — persistent registry of installed plugins
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const REGISTRY_FILE = '.local-agent/plugins-registry.json';

/**
 * Load the plugin registry.
 * @param {string} workspaceRoot
 * @returns {Registry}
 */
export function loadRegistry(workspaceRoot) {
  const p = join(workspaceRoot, REGISTRY_FILE);
  if (!existsSync(p)) return { plugins: {}, updatedAt: null };
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch { return { plugins: {}, updatedAt: null }; }
}

/**
 * Save the plugin registry.
 * @param {string} workspaceRoot
 * @param {Registry} registry
 */
export function saveRegistry(workspaceRoot, registry) {
  mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
  registry.updatedAt = new Date().toISOString();
  writeFileSync(join(workspaceRoot, REGISTRY_FILE), JSON.stringify(registry, null, 2));
}

/**
 * Register a plugin in the registry.
 * @param {string} workspaceRoot
 * @param {object} manifest
 * @param {string} pluginDir — absolute path to plugin directory
 */
export function registerPlugin(workspaceRoot, manifest, pluginDir) {
  const reg = loadRegistry(workspaceRoot);
  reg.plugins[manifest.name] = {
    name:        manifest.name,
    version:     manifest.version,
    description: manifest.description,
    author:      manifest.author,
    permissions: manifest.permissions ?? [],
    main:        manifest.main ?? 'index.js',
    pluginDir,
    enabled:     false,  // disabled by default until user enables
    installedAt: new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };
  saveRegistry(workspaceRoot, reg);
  return reg.plugins[manifest.name];
}

/**
 * Enable or disable a plugin.
 * @param {string} workspaceRoot
 * @param {string} name
 * @param {boolean} enabled
 */
export function setEnabled(workspaceRoot, name, enabled) {
  const reg = loadRegistry(workspaceRoot);
  if (!reg.plugins[name]) throw new Error(`Plugin not found: ${name}`);
  reg.plugins[name].enabled = enabled;
  reg.plugins[name].updatedAt = new Date().toISOString();
  saveRegistry(workspaceRoot, reg);
}

/**
 * Remove a plugin from the registry.
 * @param {string} workspaceRoot
 * @param {string} name
 */
export function unregisterPlugin(workspaceRoot, name) {
  const reg = loadRegistry(workspaceRoot);
  if (!reg.plugins[name]) throw new Error(`Plugin not found: ${name}`);
  delete reg.plugins[name];
  saveRegistry(workspaceRoot, reg);
}

/**
 * List all registered plugins.
 * @param {string} workspaceRoot
 * @returns {PluginEntry[]}
 */
export function listPlugins(workspaceRoot) {
  const reg = loadRegistry(workspaceRoot);
  return Object.values(reg.plugins);
}
