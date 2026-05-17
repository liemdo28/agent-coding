// local-agent/plugins/PluginValidator.js
// Phase 27: Plugin validator — validates plugins before loading

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export class PluginValidator {
  constructor() {
    this.requiredManifestFields = ['name', 'version', 'description'];
    this.allowedPermissions = ['file:read', 'file:write', 'log', 'config:get', 'config:set'];
  }

  validate(manifest, pluginPath) {
    const errors = [];
    const warnings = [];

    // Check required manifest fields
    for (const field of this.requiredManifestFields) {
      if (!manifest[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate name format
    if (manifest.name && !/^[a-z0-9-_]+$/.test(manifest.name)) {
      errors.push('Plugin name must be lowercase alphanumeric with hyphens/underscores');
    }

    // Validate version format
    if (manifest.version && !/^\d+\.\d+(\.\d+)?$/.test(manifest.version)) {
      errors.push('Version must be in semver format (e.g., 1.0.0)');
    }

    // Check permissions
    if (manifest.permissions) {
      for (const perm of manifest.permissions) {
        if (!this.allowedPermissions.includes(perm)) {
          warnings.push(`Unknown permission: ${perm}`);
        }
      }
    }

    // Check for dangerous patterns in code
    if (existsSync(pluginPath)) {
      const dangerousChecks = this.scanForDangerousCode(pluginPath);
      if (dangerousChecks.length > 0) {
        errors.push(...dangerousChecks);
      }
    }

    // Check manifest size
    if (manifest.description && manifest.description.length > 500) {
      warnings.push('Description is very long — consider shortening');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  scanForDangerousCode(pluginPath) {
    const errors = [];
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, message: 'eval() usage detected' },
      { pattern: /process\.exit/, message: 'process.exit() usage detected' },
      { pattern: /require\s*\(\s*['"]child_process['"]/, message: 'child_process require detected' },
      { pattern: /require\s*\(\s*['"]net['"]/, message: 'net module require detected' },
      { pattern: /require\s*\(\s*['"]http['"]/, message: 'HTTP module require detected' },
      { pattern: /require\s*\(\s*['"]dns['"]/, message: 'DNS module require detected' },
    ];

    try {
      const jsFiles = this.findJSFiles(pluginPath);
      for (const file of jsFiles) {
        try {
          const content = readFileSync(file, 'utf8');
          for (const check of dangerousPatterns) {
            if (check.pattern.test(content)) {
              errors.push(`${check.message} in ${file.replace(pluginPath, '')}`);
            }
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    return errors;
  }

  findJSFiles(dir) {
    const files = [];
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          files.push(...this.findJSFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          files.push(fullPath);
        }
      }
    } catch { /* ignore */ }
    return files;
  }

  validateManifestStructure(manifest) {
    return {
      name: typeof manifest.name === 'string',
      version: typeof manifest.version === 'string',
      description: typeof manifest.description === 'string',
      permissions: Array.isArray(manifest.permissions),
      rules: Array.isArray(manifest.rules),
      recipes: Array.isArray(manifest.recipes),
    };
  }
}

export default PluginValidator;