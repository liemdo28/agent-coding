/**
 * CognitionBridge.js — L3: Organizational Reasoning
 *
 * Transforms isolated agent execution into coordinated organizational cognition.
 * Agents share discoveries, risks, confidence, and strategic implications
 * through a shared cognitive field — behaving as a single distributed mind.
 */

export class CognitionBridge {
    #runtime;
    #events;
    #contextUnifier;
    #compression;
    #sharedField = { discoveries: [], risks: [], confidence: 1.0, implications: [] };
    #stats = { decisions: 0, bridgedTasks: 0, sharedInsights: 0 };

    constructor(runtime, events, contextUnifier, compression) {
        this.#runtime = runtime;
        this.#events = events;
        this.#contextUnifier = contextUnifier;
        this.#compression = compression;
    }

    start() {
        // Listen for task completions to extract insights
        this.#events?.subscribe('task.completed', (data) => this.#extractInsight(data));
        this.#events?.subscribe('swarm.consensus.completed', (data) => this.#recordDecision(data));
        this.#events?.subscribe('runtime.intelligence.alert', (data) => this.#recordRisk(data));
    }

    /**
     * Execute a task with full organizational cognition.
     * This is the primary entry point — replaces raw task submission.
     */
    async think(intent) {
        this.#stats.bridgedTasks++;

        // 1. Assemble unified context
        const context = await this.#contextUnifier.assemble(intent);

        // 2. Compress context for token efficiency
        const compressed = this.#contextUnifier.compress(context);

        // 3. Add shared cognitive field
        const cognitivePrompt = this.#buildCognitivePrompt(intent, compressed);

        // 4. Route to swarm with full context
        const result = await this.#runtime?.swarm?.assignTask({
            id: `bridge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: intent.type || 'reasoning',
            prompt: cognitivePrompt,
            context: compressed,
            priority: intent.priority || 'normal',
            agentType: intent.agentType || 'reasoning',
        });

        // 5. Extract and share insights from result
        if (result?.result) {
            this.#shareInsight(intent, result);
        }

        return {
            ...result,
            context: context._meta,
            orgState: context.orgState,
        };
    }

    #buildCognitivePrompt(intent, compressedContext) {
        const parts = [];

        // System awareness
        if (this.#sharedField.risks.length > 0) {
            parts.push('Active risks: ' + this.#sharedField.risks.slice(-3).map(r => r.message).join('; '));
        }

        // Shared discoveries
        if (this.#sharedField.discoveries.length > 0) {
            parts.push('Recent discoveries: ' + this.#sharedField.discoveries.slice(-3).join('; '));
        }

        // Context
        if (compressedContext) {
            parts.push('---\nSystem Context:\n' + compressedContext);
        }

        // Intent
        parts.push('---\nTask: ' + (intent.prompt || intent.description || 'No prompt'));

        return parts.join('\n');
    }

    #extractInsight(data) {
        // Extract learnings from completed tasks
        if (data.status === 'completed' && data.duration > 5000) {
            this.#sharedField.discoveries.push(`Task ${data.taskId} took ${data.duration}ms — may need optimization`);
            if (this.#sharedField.discoveries.length > 20) this.#sharedField.discoveries.shift();
        }
    }

    #shareInsight(intent, result) {
        this.#stats.sharedInsights++;
        this.#events?.publish('cognition.insight', {
            type: intent.type,
            confidence: result.status === 'completed' ? 0.8 : 0.3,
            summary: String(result.result).slice(0, 200),
        });
    }

    #recordDecision(data) {
        this.#stats.decisions++;
        this.#sharedField.implications.push({
            decision: data.decision,
            at: Date.now(),
        });
        if (this.#sharedField.implications.length > 20) this.#sharedField.implications.shift();
    }

    #recordRisk(data) {
        this.#sharedField.risks.push(data);
        if (this.#sharedField.risks.length > 10) this.#sharedField.risks.shift();

        // Adjust confidence
        this.#sharedField.confidence = Math.max(0.1,
            this.#sharedField.confidence - (data.severity === 'high' ? 0.2 : 0.05)
        );
    }

    getSharedField() { return { ...this.#sharedField }; }
    getStats() { return { ...this.#stats }; }
}
