// local-agent/release/release-manager.js
// Phase 28: Release manager — manage releases and versioning

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

export class ReleaseManager {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.versionFile = join(workspaceRoot, 'VERSION');
    this.changelogFile = join(workspaceRoot, 'CHANGELOG.md');
    this.releaseDir = join(workspaceRoot, '.local-agent', 'releases');
    this.currentVersion = this.loadVersion();
  }

  loadVersion() {
    if (existsSync(this.versionFile)) {
      try {
        return readFileSync(this.versionFile, 'utf8').trim();
      } catch {
        return '0.0.0';
      }
    }
    return '0.0.0';
  }

  getVersion() {
    return {
      current: this.currentVersion,
      major: parseInt(this.currentVersion.split('.')[0]) || 0,
      minor: parseInt(this.currentVersion.split('.')[1]) || 0,
      patch: parseInt(this.currentVersion.split('.')[2]) || 0,
    };
  }

  bumpVersion(type = 'patch') {
    const version = this.getVersion();
    let newVersion;

    switch (type) {
      case 'major':
        newVersion = `${version.major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${version.major}.${version.minor + 1}.0`;
        break;
      case 'patch':
      default:
        newVersion = `${version.major}.${version.minor}.${version.patch + 1}`;
        break;
    }

    try {
      writeFileSync(this.versionFile, newVersion);
      this.currentVersion = newVersion;
      return { success: true, previous: this.currentVersion, current: newVersion };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  setVersion(version) {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    if (!semverRegex.test(version)) {
      return { success: false, error: 'Invalid semver format. Use X.Y.Z' };
    }

    try {
      writeFileSync(this.versionFile, version);
      this.currentVersion = version;
      return { success: true, current: version };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  generateChangelog(options = {}) {
    const entries = [];
    const type = options.type || 'patch';
    const newVersion = options.version || this.currentVersion;

    entries.push(`## [${newVersion}] - ${this.formatDate()}`);
    entries.push('');

    if (options.added?.length > 0) {
      entries.push('### Added');
      for (const item of options.added) {
        entries.push(`- ${item}`);
      }
      entries.push('');
    }

    if (options.changed?.length > 0) {
      entries.push('### Changed');
      for (const item of options.changed) {
        entries.push(`- ${item}`);
      }
      entries.push('');
    }

    if (options.fixed?.length > 0) {
      entries.push('### Fixed');
      for (const item of options.fixed) {
        entries.push(`- ${item}`);
      }
      entries.push('');
    }

    if (options.deprecated?.length > 0) {
      entries.push('### Deprecated');
      for (const item of options.deprecated) {
        entries.push(`- ${item}`);
      }
      entries.push('');
    }

    if (options.removed?.length > 0) {
      entries.push('### Removed');
      for (const item of options.removed) {
        entries.push(`- ${item}`);
      }
      entries.push('');
    }

    if (options.breaking?.length > 0) {
      entries.push('### Breaking Changes');
      for (const item of options.breaking) {
        entries.push(`- **BREAKING**: ${item}`);
      }
      entries.push('');
    }

    return entries.join('\n');
  }

  formatDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  updateChangelog(options = {}) {
    const changelog = this.generateChangelog(options);
    let existingContent = '';

    if (existsSync(this.changelogFile)) {
      existingContent = readFileSync(this.changelogFile, 'utf8');
    }

    const header = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
    const newContent = header + changelog + '\n\n---\n\n' + existingContent;

    try {
      writeFileSync(this.changelogFile, newContent);
      return { success: true, changelog };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  createRelease(options = {}) {
    const releaseVersion = options.version || this.currentVersion;
    const releaseNotes = options.releaseNotes || this.generateReleaseNotes(releaseVersion);
    const release = {
      id: `release-${Date.now()}`,
      version: releaseVersion,
      createdAt: new Date().toISOString(),
      notes: releaseNotes,
      artifacts: options.artifacts || [],
      checksums: options.checksums || {},
    };

    const releaseFile = join(this.releaseDir, `${releaseVersion}.json`);
    try {
      writeFileSync(releaseFile, JSON.stringify(release, null, 2));
      return { success: true, release };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  generateReleaseNotes(version) {
    return `# Release ${version}\n\n## Highlights\n- Version ${version} release\n- Bug fixes and improvements\n\n## Installation\n\`\`\`bash\nnpm install @local-agent/core@${version}\n\`\`\`\n\n## Migration Guide\nSee the CHANGELOG.md for detailed changes.\n`;
  }

  getReleaseHistory(limit = 10) {
    if (!existsSync(this.releaseDir)) {
      return [];
    }

    try {
      const files = readdirSync(this.releaseDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);

      return files.map(file => {
        const content = readFileSync(join(this.releaseDir, file), 'utf8');
        return JSON.parse(content);
      });
    } catch (err) {
      return [];
    }
  }

  validateRelease(version) {
    const checks = [];

    // Check version format
    const semverRegex = /^\d+\.\d+\.\d+$/;
    checks.push({
      name: 'version_format',
      passed: semverRegex.test(version),
      message: 'Version must be in semver format (X.Y.Z)',
    });

    // Check version is higher than current
    const current = this.getVersion();
    const [major, minor, patch] = version.split('.').map(Number);
    checks.push({
      name: 'version_increment',
      passed: (major > current.major) ||
        (major === current.major && minor > current.minor) ||
        (major === current.major && minor === current.minor && patch > current.patch),
      message: 'Version must be higher than current version',
    });

    return {
      valid: checks.every(c => c.passed),
      checks,
    };
  }

  async prepareRelease(options = {}) {
    const version = options.version || this.currentVersion;
    const validation = this.validateRelease(version);

    if (!validation.valid) {
      return {
        success: false,
        error: 'Release validation failed',
        validation,
      };
    }

    // Update changelog
    const changelogResult = this.updateChangelog({
      version,
      ...options,
    });

    // Create release
    const releaseResult = this.createRelease({
      version,
      releaseNotes: options.releaseNotes,
    });

    return {
      success: true,
      version,
      changelog: changelogResult.changelog,
      release: releaseResult.release,
    };
  }
}

export default ReleaseManager;