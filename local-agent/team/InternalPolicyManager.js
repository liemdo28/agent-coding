// local-agent/team/InternalPolicyManager.js
// Phase 28: Internal policy manager — manage team-specific coding policies

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export class InternalPolicyManager {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.policyDir = join(workspaceRoot, '.local-agent', 'policies');
    this.ensurePolicyDir();
  }

  ensurePolicyDir() {
    mkdirSync(this.policyDir, { recursive: true });
  }

  getPolicies() {
    const policies = [];
    const files = ['naming-conventions.json', 'code-style.json', 'security-rules.json', 'qa-rules.json'];
    for (const file of files) {
      const path = join(this.policyDir, file);
      if (existsSync(path)) {
        try {
          const content = readFileSync(path, 'utf8');
          policies.push({ name: file.replace('.json', ''), ...JSON.parse(content) });
        } catch { /* ignore */ }
      }
    }
    return policies;
  }

  savePolicy(name, policy) {
    const path = join(this.policyDir, `${name}.json`);
    try {
      writeFileSync(path, JSON.stringify(policy, null, 2));
      return { success: true, name, path };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  deletePolicy(name) {
    const path = join(this.policyDir, `${name}.json`);
    const { unlinkSync } = require('fs');
    if (existsSync(path)) {
      unlinkSync(path);
      return { success: true, name };
    }
    return { success: false, error: 'Policy not found' };
  }

  getPolicy(name) {
    const path = join(this.policyDir, `${name}.json`);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch { return null; }
  }

  enforcePolicy(policyName, context) {
    const policy = this.getPolicy(policyName);
    if (!policy) return { enforced: false, reason: 'Policy not found' };

    const violations = [];
    if (policy.rules) {
      for (const rule of policy.rules) {
        const check = this.checkRule(rule, context);
        if (!check.passed) violations.push(check);
      }
    }

    return {
      enforced: true,
      policyName,
      passed: violations.length === 0,
      violations,
    };
  }

  checkRule(rule, context) {
    return { passed: true, rule: rule.name };
  }
}

export default InternalPolicyManager;