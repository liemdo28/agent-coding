/**
 * Auto-Context Pipeline
 * Resolves project name, extracts features, drafts template, and refines with Local LLM.
 */

import { ProjectContextEngine } from './ProjectContextEngine.js';
import { ContentGenerator } from '../content-pipeline/ContentGenerator.js';
import { reasoningEngine } from '../ai-reasoning/ReasoningEngine.js';
import { agentMonitor } from '../live-agents/LiveAgentMonitor.js';

const CONTENT_REGEX = /(?:create|generate|make|write)\s+(linkedin\s+post|facebook\s+post|seo\s+article|changelog|product\s+summary|release\s+notes|post|article|summary)\s+for\s+([a-zA-Z0-9_\-]+)/i;

export function parseContentRequest(question) {
  const match = question.match(CONTENT_REGEX);
  if (!match) return null;

  const rawType = match[1].toLowerCase().trim();
  const alias = match[2].trim();

  let type = 'linkedin';
  if (rawType.includes('facebook')) type = 'facebook';
  else if (rawType.includes('seo') || rawType.includes('article')) type = 'seo';
  else if (rawType.includes('changelog')) type = 'changelog';
  else if (rawType.includes('summary')) type = 'summary';
  else if (rawType.includes('release')) type = 'release';

  return { type, alias };
}

export async function runAutoContentPipeline(type, alias, adapter, streamCallback, config = {}) {
  // Update Live Agent Status (Marketing_AI)
  agentMonitor.setStatus('marketing', 'working', `Generating ${type} for ${alias}`);
  agentMonitor.updateProgress('marketing', 10);
  agentMonitor.log('marketing', `Pipeline initiated: target project "${alias}"`);

  // 1. Locate and build context
  const phase1 = reasoningEngine.startPhase('Locate & Analyze Project', { alias, type });
  reasoningEngine.addSubStep('Searching repository index...');
  
  const contextEngine = new ProjectContextEngine();
  const context = await contextEngine.buildContext(alias);
  
  if (!context.found) {
    const errorMsg = `Project "${alias}" not found. Please verify it is indexed or scan first.`;
    reasoningEngine.failPhase(errorMsg);
    agentMonitor.completeTask('marketing', false);
    agentMonitor.log('marketing', `Error: Project "${alias}" not found`, 'error');
    throw new Error(errorMsg);
  }

  reasoningEngine.addSubStep('Extracting features and tech stack...');
  agentMonitor.updateProgress('marketing', 35);
  agentMonitor.log('marketing', `Project found at: ${context.resolvedPath}`);

  reasoningEngine.addSubStep('Detecting target audience...');
  reasoningEngine.completePhase({ path: context.resolvedPath });

  // 2. Content template generation
  const phase2 = reasoningEngine.startPhase('Generate Template Draft');
  reasoningEngine.addSubStep('Applying strategy template...');
  
  const generator = new ContentGenerator();
  const draft = generator.generate(context, type, {
    tone: 'professional',
    hashtags: ['AI', 'DevTools', 'LocalAI'],
    version: context.packageJson?.version || '1.0.0',
    cta: 'Run local-agent in your sandbox today!',
  });

  agentMonitor.updateProgress('marketing', 60);
  agentMonitor.log('marketing', 'Template draft generated successfully');
  reasoningEngine.completePhase({ draft });

  // 3. Local LLM refinement
  const phase3 = reasoningEngine.startPhase('LLM Polish & Refine');
  reasoningEngine.addSubStep('Feeding draft to Local LLM adapter...');
  agentMonitor.log('marketing', 'Refining copy using Local LLM...');

  const systemPrompt = `You are an expert marketing writer, technology advocate, and copywriter.
Your task is to write a highly compelling, polished, and ready-to-publish ${type} post/document based on the project details, template draft, and target audience.
Guidelines:
1. Hook the reader immediately.
2. Focus on clear benefits, not just feature lists.
3. Use an exciting and professional tone.
4. Format with clean spacing, line breaks, and Markdown.
5. Return ONLY the final polished text. Do NOT include any introductory or concluding comments (like "Here is the post:").`;

  const userPrompt = `Project: ${context.alias}
Path: ${context.resolvedPath}
Tagline: ${context.packageJson?.description || ''}
Dominant Language: ${context.language}
Tech Stack: ${(context.techStack || []).join(', ')}
Template Draft:
${typeof draft === 'string' ? draft : JSON.stringify(draft, null, 2)}

Please write a highly polished, ready-to-share version.`;

  let fullResponse = '';
  try {
    for await (const token of adapter.streamChat(systemPrompt, userPrompt)) {
      if (streamCallback) streamCallback(token);
      fullResponse += token;
    }
    reasoningEngine.completePhase({ length: fullResponse.length });
    agentMonitor.updateProgress('marketing', 100);
    agentMonitor.completeTask('marketing', true);
    agentMonitor.log('marketing', 'Polished marketing copy generated');
  } catch (err) {
    reasoningEngine.failPhase(err.message);
    agentMonitor.completeTask('marketing', false);
    agentMonitor.log('marketing', `LLM polish failed: ${err.message}`, 'error');
    throw err;
  }

  return fullResponse;
}
