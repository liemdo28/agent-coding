/**
 * SkillValidator - Validate skill definitions
 */

class SkillValidator {
  validateSkill(skill) {
    const errors = [];
    if (!skill) {
      errors.push('Skill is null or undefined');
      return { valid: false, errors };
    }
    if (!skill.skillId) errors.push('Missing skillId');
    if (!skill.name && !skill.description) errors.push('Missing name or description');
    if (skill.steps && !Array.isArray(skill.steps)) {
      errors.push('steps must be an array');
    }
    if (skill.riskLevel && !['low', 'medium', 'high'].includes(skill.riskLevel)) {
      errors.push('riskLevel must be low, medium, or high');
    }
    if (skill.verification && !Array.isArray(skill.verification)) {
      errors.push('verification must be an array');
    }
    if (skill.rollback && !Array.isArray(skill.rollback)) {
      errors.push('rollback must be an array');
    }
    if (skill.steps) {
      skill.steps.forEach((step, i) => {
        const stepErrors = this.validateStep(step, i);
        errors.push(...stepErrors.map(e => `Step ${i}: ${e}`));
      });
    }
    if (skill.rollback) {
      skill.rollback.forEach((step, i) => {
        const stepErrors = this.validateStep(step, i);
        errors.push(...stepErrors.map(e => `Rollback ${i}: ${e}`));
      });
    }
    return { valid: errors.length === 0, errors };
  }

  validateStep(step, index = 0) {
    const errors = [];
    if (!step) {
      errors.push('Step is null or undefined');
      return errors;
    }
    if (!step.description && !step.command) {
      errors.push('Step must have description or command');
    }
    if (step.expected && typeof step.expected !== 'string') {
      errors.push('Step.expected must be a string');
    }
    return errors;
  }

  validateRollback(rollback) {
    const errors = [];
    if (!rollback) return { valid: true, errors: [] };
    if (!Array.isArray(rollback)) {
      errors.push('rollback must be an array');
      return { valid: false, errors };
    }
    rollback.forEach((step, i) => {
      const stepErrors = this.validateStep(step, i);
      errors.push(...stepErrors.map(e => `Rollback ${i}: ${e}`));
    });
    return { valid: errors.length === 0, errors };
  }

  validateVerification(verification) {
    const errors = [];
    if (!verification) return { valid: true, errors: [] };
    if (!Array.isArray(verification)) {
      errors.push('verification must be an array');
      return { valid: false, errors };
    }
    verification.forEach((v, i) => {
      if (typeof v !== 'string') {
        errors.push(`Verification ${i} must be a string`);
      }
    });
    return { valid: errors.length === 0, errors };
  }

  getValidationErrors(skill) {
    return this.validateSkill(skill).errors;
  }
}

module.exports = { SkillValidator };