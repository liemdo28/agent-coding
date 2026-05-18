/**
 * Phase 58 - QA Profile Selector
 * Select QA strategy based on project profile
 */
class QAProfileSelector {
  constructor() {
    this.profiles = this.initializeProfiles();
  }

  initializeProfiles() {
    return {
      frontend: {
        name: 'Frontend Project',
        indicators: ['react', 'vue', 'angular', 'svelte', 'css', 'html', 'vite', 'webpack'],
        testFocus: ['component', 'integration', 'e2e'],
        riskAreas: ['rendering', 'state management', 'user interactions']
      },
      backend: {
        name: 'Backend Project',
        indicators: ['express', 'fastify', 'koa', 'nest', 'api', 'server'],
        testFocus: ['unit', 'integration', 'api'],
        riskAreas: ['api endpoints', 'data validation', 'auth']
      },
      monorepo: {
        name: 'Monorepo',
        indicators: ['pnpm', 'workspace', 'lerna', 'turbo', 'packages/'],
        testFocus: ['unit', 'integration', 'e2e', 'cross-package'],
        riskAreas: ['cross-package deps', 'shared code', 'build order']
      },
      api: {
        name: 'API Project',
        indicators: ['rest', 'graphql', 'grpc', 'openapi', 'swagger'],
        testFocus: ['api', 'contract', 'integration'],
        riskAreas: ['endpoints', 'request/response', 'schema']
      },
      fullstack: {
        name: 'Full Stack',
        indicators: ['frontend', 'backend', 'database', 'api'],
        testFocus: ['unit', 'integration', 'e2e', 'api'],
        riskAreas: ['end-to-end flow', 'data consistency', 'auth']
      }
    };
  }

  detectProfile(targetDir, projectMap) {
    const languages = projectMap?.languages || [];
    const frameworks = projectMap?.frameworks || [];
    const files = projectMap?.files || [];
    const projectType = projectMap?.projectTypes?.[0] || '';

    const scores = {};

    for (const [key, profile] of Object.entries(this.profiles)) {
      let score = 0;
      const matched = [];

      for (const indicator of profile.indicators) {
        const lower = indicator.toLowerCase();
        if (frameworks.some(f => f.toLowerCase().includes(lower))) {
          score += 3;
          matched.push(indicator);
        }
        if (projectType.toLowerCase().includes(lower)) {
          score += 2;
          matched.push(indicator);
        }
      }

      if (score > 0) {
        scores[key] = { score, matched };
      }
    }

    const sorted = Object.entries(scores)
      .sort((a, b) => b[1].score - a[1].score);

    if (sorted.length === 0) {
      return { profile: 'default', confidence: 0.3 };
    }

    const [bestProfile, data] = sorted[0];
    const confidence = Math.min(data.score / 10, 1);

    return {
      profile: bestProfile,
      confidence,
      details: this.profiles[bestProfile],
      matchedIndicators: data.matched
    };
  }

  getStrategy(profileKey) {
    const profile = this.profiles[profileKey] || this.profiles.default;
    return {
      profile: profileKey,
      testFocus: profile.testFocus,
      riskAreas: profile.riskAreas,
      recommendedTests: this.getRecommendedTests(profile)
    };
  }
}

module.exports = { QAProfileSelector };