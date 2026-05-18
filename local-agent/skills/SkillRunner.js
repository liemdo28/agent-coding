/**
 * SkillRunner - Execute skills safely
 */
const { SkillRegistry } = require('./SkillRegistry');

class SkillRunner {
  constructor(registry = null, approvalCallback = null) {
    this.registry = registry || new SkillRegistry();
    this.approvalCallback = approvalCallback;
    this.executionLog = [];
    this.currentExecution = null;
  }

  async runSkill(skillId, context = {}) {
    const skill = this.registry.getSkill(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    if (this.requiresApproval(skill)) {
      if (this.approvalCallback) {
        const approved = await this.approvalCallback(skill);
        if (!approved) {
          return { success: false, reason: 'Approval denied' };
        }
      } else {
        return { success: false, reason: 'Approval required but no callback provided' };
      }
    }

    const execution = {
      skillId,
      context,
      steps: [],
      startTime: Date.now(),
      status: 'running'
    };
    this.currentExecution = execution;

    try {
      for (let i = 0; i < skill.steps.length; i++) {
        const step = skill.steps[i];
        const result = await this.runStep(step, context);
        execution.steps.push({ step: i, description: step.description, result });
        if (result.error) {
          execution.status = 'failed';
          execution.error = result.error;
          break;
        }
      }

      if (execution.status === 'running') {
        execution.status = 'completed';
      }

      // Run verification steps
      if (skill.verification && execution.status === 'completed') {
        execution.verification = await this.runVerification(skill.verification, context);
      }

      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      this.executionLog.push(execution);
      this.currentExecution = null;

      return execution;
    } catch (error) {
      execution.status = 'error';
      execution.error = error.message;
      execution.endTime = Date.now();
      this.executionLog.push(execution);
      this.currentExecution = null;
      return execution;
    }
  }

  async runStep(step, context) {
    const result = { output: null, error: null };
    try {
      // Simulate step execution - in real implementation, this would execute actual commands
      if (step.command) {
        result.output = `[Would execute] ${step.command}`;
        if (step.expected) {
          result.passed = true; // In real implementation, check against expected
        }
      } else {
        result.output = `[Would run] ${step.description}`;
        result.passed = true;
      }
    } catch (error) {
      result.error = error.message;
    }
    return result;
  }

  async runVerification(verificationSteps, context) {
    const results = [];
    for (const verification of verificationSteps) {
      try {
        const passed = true; // In real implementation, actually verify
        results.push({ description: verification, passed });
      } catch (error) {
        results.push({ description: verification, passed: false, error: error.message });
      }
    }
    return results;
  }

  validateSkill(skillId) {
    const skill = this.registry.getSkill(skillId);
    if (!skill) return { valid: false, errors: ['Skill not found'] };

    const errors = [];
    if (!skill.steps || !Array.isArray(skill.steps)) {
      errors.push('Missing or invalid steps array');
    }
    if (!skill.riskLevel || !['low', 'medium', 'high'].includes(skill.riskLevel)) {
      errors.push('Invalid or missing riskLevel');
    }
    if (skill.steps) {
      skill.steps.forEach((step, i) => {
        if (!step.description) {
          errors.push(`Step ${i} missing description`);
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }

  requiresApproval(skill) {
    return skill.riskLevel === 'high';
  }

  getExecutionLog() {
    return this.executionLog;
  }

  getStatus() {
    return {
      current: this.currentExecution ? {
        skillId: this.currentExecution.skillId,
        status: this.currentExecution.status,
        elapsed: Date.now() - this.currentExecution.startTime
      } : null,
      totalExecutions: this.executionLog.length,
      completed: this.executionLog.filter(e => e.status === 'completed').length,
      failed: this.executionLog.filter(e => e.status === 'failed').length
    };
  }
}

module.exports = { SkillRunner };