/**
 * SkillRegistry - Manage reusable skills
 */
const fs = require('fs');
const path = require('path');

class SkillRegistry {
  constructor(skillsDir = null) {
    this.skillsDir = skillsDir || path.join(__dirname, 'SkillTemplates');
    this.skills = new Map();
    this.loadSkills();
  }

  loadSkills() {
    try {
      if (fs.existsSync(this.skillsDir)) {
        const files = fs.readdirSync(this.skillsDir);
        files.forEach(file => {
          if (file.endsWith('.json')) {
            const skillData = JSON.parse(fs.readFileSync(path.join(this.skillsDir, file), 'utf8'));
            if (Array.isArray(skillData)) {
              skillData.forEach(skill => this.registerSkill(skill));
            } else {
              this.registerSkill(skillData);
            }
          }
        });
      }
    } catch (error) {
      console.error('Failed to load skills:', error.message);
    }
  }

  registerSkill(skill) {
    if (!skill.skillId) {
      throw new Error('Skill must have a skillId');
    }
    this.skills.set(skill.skillId, {
      ...skill,
      registeredAt: new Date().toISOString()
    });
    return this;
  }

  getSkill(skillId) {
    return this.skills.get(skillId) || null;
  }

  listSkills(category = null) {
    const all = Array.from(this.skills.values());
    if (category) {
      return all.filter(s => s.category === category);
    }
    return all;
  }

  searchSkills(query) {
    const q = query.toLowerCase();
    return Array.from(this.skills.values()).filter(skill =>
      skill.skillId.toLowerCase().includes(q) ||
      skill.name?.toLowerCase().includes(q) ||
      skill.description?.toLowerCase().includes(q) ||
      skill.tags?.some(t => t.toLowerCase().includes(q))
    );
  }

  exportSkills() {
    return Array.from(this.skills.values());
  }

  getCategories() {
    const categories = new Set();
    this.skills.forEach(skill => {
      if (skill.category) categories.add(skill.category);
    });
    return Array.from(categories);
  }

  getFrameworks() {
    const frameworks = new Set();
    this.skills.forEach(skill => {
      if (skill.framework) frameworks.add(skill.framework);
    });
    return Array.from(frameworks);
  }
}

module.exports = { SkillRegistry };