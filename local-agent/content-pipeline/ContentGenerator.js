/**
 * Content Generation Pipeline
 * Pipeline: Project → Feature Extraction → Marketing Angle → Content
 * Supports: linkedin post, facebook post, SEO article, changelog, product summary, release notes
 */

export class ContentGenerator {
  constructor() {
    this.templates = {
      linkedin: this._linkedinTemplate.bind(this),
      facebook: this._facebookTemplate.bind(this),
      seo: this._seoTemplate.bind(this),
      changelog: this._changelogTemplate.bind(this),
      summary: this._summaryTemplate.bind(this),
      release: this._releaseTemplate.bind(this),
    };
  }

  generate(projectContext, contentType, options = {}) {
    const template = this.templates[contentType];
    if (!template) {
      return { error: `Unknown content type: ${contentType}. Supported: ${Object.keys(this.templates).join(', ')}` };
    }
    return template(projectContext, options);
  }

  _extractKeyFeatures(context) {
    const features = context.features || [];
    const techStack = context.techStack || [];
    return {
      headline: context.description || features[0] || 'A powerful project',
      features: features.slice(0, 5),
      techStack,
      audience: this._detectAudience(context),
    };
  }

  _detectAudience(context) {
    const techStack = (context.techStack || []).join(' ').toLowerCase();
    const desc = (context.description || '').toLowerCase();
    
    if (techStack.includes('react') || techStack.includes('vue') || techStack.includes('next')) {
      return 'Web developers, frontend engineers, UI/UX teams';
    }
    if (techStack.includes('python') || techStack.includes('django') || techStack.includes('flask')) {
      return 'Backend engineers, data scientists, Python developers';
    }
    if (desc.includes('ai') || desc.includes('ml') || desc.includes('machine learning')) {
      return 'AI/ML engineers, data scientists, tech leads';
    }
    if (desc.includes('api') || desc.includes('service')) {
      return 'API developers, backend engineers, DevOps teams';
    }
    return 'Software engineers, developers, tech professionals';
  }

  _linkedinTemplate(ctx, opts) {
    const { headline, features, audience } = this._extractKeyFeatures(ctx);
    const tone = opts.tone || 'professional';
    const hashtag = opts.hashtags || ['#AI', '#DevTools', '#OpenSource'];

    const hooks = [
      `🚀 Built ${ctx.project || 'something'} — and it's changing how we work.`,
      `💡 What if your tools actually understood your code?`,
      `🔥 Just shipped a major update. Here's what changed:`,
      `⚡ After months of development, I'm excited to share what we've built.`,
    ];

    const body = tone === 'casual' ? [
      `This is ${headline}`,
      ``,
      `What makes it special:`,
      ...features.map((f, i) => `• ${f}`),
      ``,
      `Built with: ${(ctx.techStack || []).slice(0, 4).join(', ')}`,
      ``,
      `Who it's for: ${audience}`,
    ] : [
      `We're thrilled to announce ${ctx.project || 'our latest project'} — a ${headline}`,
      ``,
      `Key capabilities:`,
      ...features.map((f, i) => `${i + 1}. ${f}`),
      ``,
      `Technology: ${(ctx.techStack || []).slice(0, 4).join(' • ')}`,
      ``,
      `Target audience: ${audience}`,
    ];

    const cta = opts.cta || 'Learn more → [link]';
    const tags = hashtag.map(t => typeof t === 'string' ? t : `#${t}`).join(' ');

    return {
      type: 'linkedin',
      hook: hooks[Math.floor(Math.random() * hooks.length)],
      body: body.join('\n'),
      cta,
      hashtags: tags,
      full: [hooks[0], '', body.join('\n'), '', cta, '', tags].join('\n'),
    };
  }

  _facebookTemplate(ctx, opts) {
    const { headline, features, audience } = this._extractKeyFeatures(ctx);
    const tone = opts.tone || 'casual';

    const templates = tone === 'viral' ? [
      `🎉 We're LIVE! ${headline}`,
      ``,
      `Check out what we built:`,
      ...features.map(f => `✦ ${f}`),
      ``,
      `👉 [Try it now]`,
      ``,
      `#Tech #Innovation #BuildInPublic`,
    ] : [
      `Hey friends! 👋`,
      ``,
      `Excited to share ${ctx.project || 'our latest project'} — ${headline}`,
      ``,
      `What it does:`,
      ...features.map((f, i) => `${i + 1}. ${f}`),
      ``,
      `Give it a try and let us know what you think! 🎯`,
    ];

    return {
      type: 'facebook',
      body: templates.join('\n'),
      full: templates.join('\n'),
    };
  }

  _seoTemplate(ctx, opts) {
    const { headline, features, audience } = this._extractKeyFeatures(ctx);
    const primaryKeyword = opts.keyword || ctx.project || 'project';
    const secondaryKeywords = opts.secondaryKeywords || features.slice(0, 3);

    return {
      type: 'seo',
      meta: {
        title: `${ctx.project || headline} — Complete Guide [2024]`,
        description: `Discover how ${ctx.project || 'this project'} can help ${audience}. ${features[0] || headline}. Built with ${(ctx.techStack || [])[0] || 'modern technology'}.`,
        keywords: [primaryKeyword, ...secondaryKeywords, ...(ctx.techStack || [])].join(', '),
      },
      sections: [
        { heading: 'What is ' + (ctx.project || primaryKeyword) + '?', content: headline },
        { heading: 'Key Features', content: features.join('\n\n') },
        { heading: 'Who Should Use This', content: audience },
        { heading: 'Getting Started', content: `Built with ${(ctx.techStack || []).join(', ')}. Installation and setup guide coming soon.` },
        { heading: 'Conclusion', content: `${ctx.project || primaryKeyword} represents a modern approach to ${secondaryKeywords[0] || 'development'}. ${features[0] || headline}.` },
      ],
    };
  }

  _changelogTemplate(ctx, opts) {
    const version = opts.version || '1.0.0';
    const date = opts.date || new Date().toISOString().split('T')[0];
    const changes = opts.changes || ctx.features || ['Initial release'];

    return {
      type: 'changelog',
      version,
      date,
      sections: {
        added: changes.filter((_, i) => i % 3 === 0),
        improved: changes.filter((_, i) => i % 3 === 1),
        fixed: changes.filter((_, i) => i % 3 === 2).concat(['Minor UI refinements']),
      },
      markdown: [
        `# Changelog — ${version} (${date})`,
        ``,
        `## ✨ Added`,
        ...changes.filter((_, i) => i % 3 === 0).map(c => `- ${c}`),
        ``,
        `## 🚀 Improved`,
        ...changes.filter((_, i) => i % 3 === 1).map(c => `- ${c}`),
        ``,
        `## 🐛 Fixed`,
        ...changes.filter((_, i) => i % 3 === 2).map(c => `- ${c}`),
        `- Minor UI refinements`,
      ].filter(l => !l.startsWith('- undefined')).join('\n'),
    };
  }

  _summaryTemplate(ctx, opts) {
    const { headline, features, audience } = this._extractKeyFeatures(ctx);

    return {
      type: 'summary',
      project: ctx.project || 'Unknown Project',
      tagline: headline,
      techStack: ctx.techStack || [],
      features: features,
      audience,
      sections: {
        overview: `${ctx.project || 'This project'} is ${headline}. Built for ${audience} using ${(ctx.techStack || []).join(', ')}.`,
        highlights: features.map((f, i) => ({ id: i + 1, text: f })),
        tech: (ctx.techStack || []).map(t => ({ name: t, category: this._techCategory(t) })),
      },
    };
  }

  _techCategory(tech) {
    const categories = {
      'React': 'Frontend', 'Vue': 'Frontend', 'Angular': 'Frontend',
      'Next.js': 'Framework', 'Nuxt.js': 'Framework',
      'Express': 'Backend', 'Fastify': 'Backend', 'Koa': 'Backend',
      'Django': 'Backend', 'Flask': 'Backend', 'FastAPI': 'Backend',
      'Node.js': 'Runtime', 'Deno': 'Runtime',
      'PostgreSQL': 'Database', 'MongoDB': 'Database', 'SQLite': 'Database',
      'Docker': 'DevOps', 'Kubernetes': 'DevOps', 'Terraform': 'DevOps',
      'Vite': 'Build Tool', 'Webpack': 'Build Tool',
      'Tailwind CSS': 'Styling', 'Sass': 'Styling',
      'Prisma': 'ORM', 'TypeORM': 'ORM',
    };
    return categories[tech] || 'Library';
  }

  _releaseTemplate(ctx, opts) {
    const version = opts.version || '1.0.0';
    const date = opts.date || new Date().toISOString().split('T')[0];
    const releaseType = opts.releaseType || 'minor';

    const releaseTypes = {
      major: { emoji: '🎉', label: 'Major Release' },
      minor: { emoji: '🚀', label: 'Feature Update' },
      patch: { emoji: '🔧', label: 'Patch Release' },
    };
    const { emoji, label } = releaseTypes[releaseType] || releaseTypes.minor;

    return {
      type: 'release',
      version,
      date,
      releaseType: label,
      sections: {
        header: `${emoji} ${label} — v${version}`,
        summary: ctx.description || ctx.features?.[0] || 'New release available.',
        highlights: (ctx.features || []).slice(0, 5),
        installation: ctx.language === 'JavaScript' || ctx.language === 'TypeScript'
          ? `npm install ${ctx.project}`
          : `pip install ${ctx.project}`,
        techStack: ctx.techStack || [],
      },
      markdown: [
        `# ${emoji} ${label} — v${version}`,
        ``,
        `**Release Date:** ${date}`,
        ``,
        `## What's New`,
        ...(ctx.features || []).map(f => `- ${f}`),
        ``,
        `## Installation`,
        ``,
        '```',
        ctx.language === 'JavaScript' || ctx.language === 'TypeScript'
          ? `npm install ${ctx.project}`
          : `pip install ${ctx.project}`,
        '```',
        ``,
        `## Technology`,
        `${(ctx.techStack || []).join(' • ')}`,
        ``,
        `---
Built with ❤️ by the team`,
      ].filter(l => l !== 'undefined').join('\n'),
    };
  }

  generateAll(projectContext) {
    const types = ['linkedin', 'facebook', 'seo', 'changelog', 'summary', 'release'];
    const results = {};
    for (const type of types) {
      results[type] = this.generate(projectContext, type);
    }
    return results;
  }
}

export default ContentGenerator;