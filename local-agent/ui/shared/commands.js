// local-agent/ui/shared/commands.js
// Single source of truth for all runnable commands.
// Backend imports this for the whitelist; frontend imports it to render buttons.

export const COMMAND_GROUPS = [
  {
    id: 'kb',
    labelKey: 'commandCenter.groups.kb',
    commands: [
      { script: 'kb:ingest',         labelKey: 'scripts.kb:ingest.label',         descKey: 'scripts.kb:ingest.desc',         warn: true,  estTime: '4-5 phút' },
      { script: 'kb:ingest:mdn',     labelKey: 'scripts.kb:ingest:mdn.label',     descKey: 'scripts.kb:ingest:mdn.desc',     warn: true,  estTime: '2-3 phút' },
      { script: 'kb:stats',          labelKey: 'scripts.kb:stats.label',          descKey: 'scripts.kb:stats.desc',          warn: false },
      { script: 'kb:generate-stats', labelKey: 'scripts.kb:generate-stats.label', descKey: 'scripts.kb:generate-stats.desc', warn: false },
      { script: 'kb:package',        labelKey: 'scripts.kb:package.label',        descKey: 'scripts.kb:package.desc',        warn: true,  estTime: '1-2 phút' },
      { script: 'kb:install',        labelKey: 'scripts.kb:install.label',        descKey: 'scripts.kb:install.desc',        warn: false },
      { script: 'kb:query',          labelKey: 'scripts.kb:query.label',          descKey: 'scripts.kb:query.desc',          warn: false },
    ],
  },
  {
    id: 'eval',
    labelKey: 'commandCenter.groups.eval',
    commands: [
      { script: 'eval:quick',      labelKey: 'scripts.eval:quick.label',      descKey: 'scripts.eval:quick.desc',      warn: false },
      { script: 'eval:all',        labelKey: 'scripts.eval:all.label',        descKey: 'scripts.eval:all.desc',        warn: true,  estTime: '10-15 phút' },
      { script: 'eval:humaneval',  labelKey: 'scripts.eval:humaneval.label',  descKey: 'scripts.eval:humaneval.desc',  warn: false },
      { script: 'eval:mbpp',       labelKey: 'scripts.eval:mbpp.label',       descKey: 'scripts.eval:mbpp.desc',       warn: false },
      { script: 'eval:scoreboard', labelKey: 'scripts.eval:scoreboard.label', descKey: 'scripts.eval:scoreboard.desc', warn: false },
    ],
  },
  {
    id: 'accounting',
    labelKey: 'commandCenter.groups.accounting',
    commands: [
      { script: 'accounting:api',    labelKey: 'scripts.accounting:api.label',    descKey: 'scripts.accounting:api.desc',    warn: false },
      { script: 'accounting:verify', labelKey: 'scripts.accounting:verify.label', descKey: 'scripts.accounting:verify.desc', warn: false },
      { script: 'accounting:cert',   labelKey: 'scripts.accounting:cert.label',   descKey: 'scripts.accounting:cert.desc',   warn: true,  estTime: '1 phút' },
    ],
  },
  {
    id: 'build',
    labelKey: 'commandCenter.groups.build',
    commands: [
      { script: 'build',            labelKey: 'scripts.build.label',            descKey: 'scripts.build.desc',            warn: false },
      { script: 'test',             labelKey: 'scripts.test.label',             descKey: 'scripts.test.desc',             warn: false },
      { script: 'test:integration', labelKey: 'scripts.test:integration.label', descKey: 'scripts.test:integration.desc', warn: false },
      { script: 'lint',             labelKey: 'scripts.lint.label',             descKey: 'scripts.lint.desc',             warn: false },
    ],
  },
  {
    id: 'agent',
    labelKey: 'commandCenter.groups.agent',
    commands: [
      { script: 'start',         labelKey: 'scripts.start.label',         descKey: 'scripts.start.desc',         warn: false },
      { script: 'corp:simulate', labelKey: 'scripts.corp:simulate.label', descKey: 'scripts.corp:simulate.desc', warn: false, estTime: '5-10 phút', requiresInput: true, inputPrompt: 'Nhập task cần điều phối', inputPlaceholder: 'Ví dụ: Fix bug module payment, Audit bảo mật, Lên kế hoạch marketing Q3' },
    ],
  },
];

// Flat whitelist derived from the groups above — backend uses this
export const ALLOWED_SCRIPTS = COMMAND_GROUPS.flatMap(g => g.commands.map(c => c.script));
