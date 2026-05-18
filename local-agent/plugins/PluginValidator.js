// plugins/PluginValidator.js — validate plugin manifests for safety and structure
const REQUIRED_FIELDS = ['name', 'version', 'description', 'author', 'permissions'];

const ALLOWED_PERMISSIONS = new Set([
  'read:workspace',
  'write:workspace',
  'read:index',
  'read:patches',
  'write:patches',
  'read:qa',
  'read:memory',
]);

const FORBIDDEN_PERMISSIONS = new Set([
  'network',
  'internet',
  'cloud',
  'telemetry',
  'exec:system',
  'read:secrets',
]);

/**
 * Validate a plugin manifest.
 * @param {object} manifest — parsed manifest.json
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateManifest(manifest) {
  const errors   = [];
  const warnings = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['manifest.json is not a valid object'], warnings };
  }

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!manifest[field]) errors.push(`Missing required field: ${field}`);
  }

  // Name pattern: lowercase, alphanumeric + dash
  if (manifest.name && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(manifest.name)) {
    errors.push('name must be lowercase alphanumeric with dashes (max 63 chars)');
  }

  // Version: semver-ish
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push('version must follow semver (e.g. 1.0.0)');
  }

  // Permissions
  const perms = manifest.permissions ?? [];
  if (!Array.isArray(perms)) {
    errors.push('permissions must be an array');
  } else {
    for (const p of perms) {
      if (FORBIDDEN_PERMISSIONS.has(p)) {
        errors.push(`Forbidden permission: "${p}" — offline-only policy`);
      } else if (!ALLOWED_PERMISSIONS.has(p)) {
        warnings.push(`Unknown permission: "${p}" — will be denied at runtime`);
      }
    }
  }

  // Entry point
  if (manifest.main && !/\.js$/.test(manifest.main)) {
    warnings.push('main entry point should be a .js file');
  }

  return { valid: errors.length === 0, errors, warnings };
}
