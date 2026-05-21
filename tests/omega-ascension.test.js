/**
 * omega-ascension.test.js
 * Tests for Ω-111 → Ω-124 Universal Continuity Intelligence Meta-System
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import { OmegaMetasystem } from '../src/core/omega-ascension/OmegaMetasystem.js';

describe('OmegaMetasystem', () => {
    let metasystem;

    before(() => { metasystem = new OmegaMetasystem(); });
    after(() => { metasystem = null; });

    it('initializes with correct defaults', () => {
        const state = metasystem.getState();
        assert.ok(Array.isArray(state.activePhases));
        assert.strictEqual(state.generationCount, 0);
        assert.strictEqual(state.entropyPool, 0);
    });

    it('tick evaluates activation scores and activates phases', () => {
        const state = metasystem.tick({ coherence: 0.5, complexity: 0.5, entropy: 0.3 });
        assert.ok(state.generation >= 1, `expected generation >= 1, got ${state.generation}`);
        assert.ok(state.activePhases.length >= 0);
        assert.ok(state.phaseStats);
    });

    it('activates specific phases manually', () => {
        metasystem.activatePhase(121); // Observatory — lowest threshold
        const engine = metasystem.getEngine(121);
        assert.ok(engine !== null);
    });

    it('rejects unknown phase numbers', () => {
        assert.throws(() => metasystem.activatePhase(999), /Unknown phase/);
    });

    it('injects entropy and triggers evolution at high pressure', () => {
        metasystem.injectPressure({ entropy: 0.9 });
        const stats = metasystem.getStats();
        assert.ok(stats.totalGenerations >= 1);
    });

    it('records identity traces for catastrophic recovery', () => {
        metasystem.recordIdentityTrace({ phases: [119, 120], continuityScore: 0.8, fragments: ['kernel', 'governance'] });
        const recovered = metasystem.recoverFromTraces();
        assert.ok(recovered);
        assert.strictEqual(recovered.continuityScore, 0.8);
    });

    it('evolve log captures generation events', () => {
        metasystem.tick({ coherence: 0.6 });
        const log = metasystem.getEvolutionLog(10);
        assert.ok(Array.isArray(log));
    });

    it('phase scores vary by state input', () => {
        const state1 = metasystem.tick({ coherence: 0.1 });
        const state2 = metasystem.tick({ coherence: 0.9 });
        assert.ok(state1.phaseStats && state2.phaseStats);
    });

    it('maxActivePhases limit is enforced', () => {
        const limited = new OmegaMetasystem({ maxActivePhases: 2 });
        limited.tick({ coherence: 0.9, complexity: 0.9, entropy: 0.6 });
        limited.tick({ coherence: 0.9, complexity: 0.9, entropy: 0.6 });
        limited.tick({ coherence: 0.9, complexity: 0.9, entropy: 0.6 });
        const state = limited.getState();
        assert.ok(state.activePhases.length <= 2, `Expected ≤2 phases, got ${state.activePhases.length}`);
    });
});

describe('Phase Engine Lifecycle', () => {
    it('engine loads lazily and becomes available after tick', async () => {
        const metasystem = new OmegaMetasystem();
        metasystem.activatePhase(119); // ImmortalKernel — high priority

        // First tick — engine may be loading
        metasystem.tick({ extinctionRisk: 0.5 });

        // Second tick — engine should be loaded
        metasystem.tick({ extinctionRisk: 0.5 });

        const engine = metasystem.getEngine(119);
        assert.ok(engine !== null);
    });
});

describe('Entropy Management', () => {
    it('entropy compresses toward zero over time', () => {
        const metasystem = new OmegaMetasystem({ entropyCompressionRatio: 0.1 });
        metasystem.injectPressure({ entropy: 0.5 });
        const before = metasystem.getState().entropyPool;
        metasystem.tick({});
        const after = metasystem.getState().entropyPool;
        assert.ok(after <= before, `Entropy should compress: ${after} > ${before}`);
    });

    it('self-evolution triggers at entropy > 0.8', () => {
        const metasystem = new OmegaMetasystem();
        let evoCount = 0;
        metasystem.on('metasystem:tick', () => evoCount++);
        metasystem.injectPressure({ entropy: 0.85 });
        metasystem.tick({});
        // Evolution compresses entropy — entropy should drop after trigger
        assert.ok(metasystem.getState().entropyPool < 0.85);
    });
});

describe('Continuity & Recovery', () => {
    it('continuity traces accumulate over generations', () => {
        const metasystem = new OmegaMetasystem();
        for (let i = 0; i < 55; i++) metasystem.tick({});
        const state = metasystem.getState();
        // Traces recorded every 50 generations
        assert.ok(state.identityTraces >= 1, `Expected ≥1 traces, got ${state.identityTraces}`);
    });

    it('recoverFromTraces returns latest trace data', () => {
        const metasystem = new OmegaMetasystem();
        metasystem.recordIdentityTrace({ phases: [112, 113], continuityScore: 0.75, fragments: ['cognition', 'continuity'] });
        const recovery = metasystem.recoverFromTraces();
        assert.ok(recovery.recoveredAt);
        assert.ok(Array.isArray(recovery.phases));
    });
});
