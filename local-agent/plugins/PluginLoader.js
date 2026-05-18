// plugins/PluginLoader.js — load, validate, and initialize a plugin
import { existsSync, readFileSync } from 'fs';
import { join, resolve }            from 'path';
import { validateManifest }         from './PluginValidator.js';
import { buildSandboxContext }      from './PluginSandbox.js';
import { registerPlugin, listPlugins, setEnabled } from './PluginRegistry.js';

const PLUGINS_DIR = 'plugins';

/**
 * Install a plugin from a local directory (no internet, no npm install).
 * @param {string} workspaceRoot
 * @param {string} pluginPath — absolute path to plugin directory
 * @returns {{ success: boolean, name?: string, errors?: string[], warnings?: string[] }}
 */
export async function installPlugin(workspaceRoot, pluginPath) {
  const manifestPath = join(pluginPath, 'manifest.json');
  if (!existsSync(manifestPath)) {
    return { success: false, errors: ['manifest.json not found in plugin directory'] };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    return { success: false, errors: [`Cannot parse manifest.json: ${err.message}`] };
  }

  const { valid, errors, warnings } = validateManifest(manifest);
  if (!valid) return { success: false, errors, warnings };

  const entry = registerPlugin(workspaceRoot, manifest, pluginPath);
  return { success: true, name: manifest.name, entry, warnings };
}

/**
 * Load and run an enabled plugin's init() function.
 * @param {string} workspaceRoot
 * @param {string} pluginName
 * @returns {Promise<{ success: boolean, api?: object, error?: string }>}
 */
export async function loadPlugin(workspaceRoot, pluginName) {
  const plugins = listPlugins(workspaceRoot);
  const entry   = plugins.find((p) => p.name === pluginName);

  if (!entry)         return { success: false, error: `Plugin not found: ${pluginName}` };
  if (!entry.enabled) return { success: false, error: `Plugin disabled: ${pluginName}` };

  const mainPath = join(entry.pluginDir, entry.main);
  if (!existsSync(mainPath)) {
    return { success: false, error: `Plugin entry point not found: ${mainPath}` };
  }

  // Validate main is inside plugin dir (no traversal)
  const resolved = resolve(mainPath);
  if (!resolved.startsWith(resolve(entry.pluginDir))) {
    return { success: false, error: 'Plugin entry point must be inside plugin directory' };
  }

  const ctx = buildSandboxContext(workspaceRoot, entry.permissions);

  try {
    const mod = await import(resolved);
    const api = typeof mod.init === 'function' ? await mod.init(ctx) : {};
    return { success: true, api: api ?? {} };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
