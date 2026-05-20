// local-agent/dna/MutationSandbox.js
// Phase 106 — Engineering DNA
// Sandboxed mutation proposals. A mutation is a proposed variation of an
// existing gene that has NOT been applied to live code yet. Mutations live
// in .local-agent/mutations/ as JSON files until evaluated.

import { existsSync, mkdirSync,
         readFileSync, writeFileSync,
         readdirSync }              from 'fs';
import { resolve, join }           from 'path';
import { randomUUID }              from 'crypto';

export class MutationSandbox {
  /**
   * @param {object} options
   * @param {string}        [options.mutationDir]  path to mutations/ directory
   * @param {PatternLibrary} options.library        PatternLibrary instance
   */
  constructor(options = {}) {
    if (!options.library) throw new Error('MutationSandbox requires options.library');
    this.mutationDir = options.mutationDir ?? resolve(options.library.mutationDir ?? './mutations');
    this.library     = options.library;
    mkdirSync(this.mutationDir, { recursive: true });
  }

  /**
   * Propose a mutation for an existing gene.
   * Writes a JSON file to the mutations directory — does NOT modify the live gene.
   *
   * @param {string} geneId
   * @param {{ description: string, changes: object }} mutationSpec
   * @returns {{ mutationId: string, path: string }}
   */
  proposeMutation(geneId, mutationSpec) {
    const mutationId = randomUUID();
    const ts         = new Date().toISOString();
    const filename   = `${geneId.slice(0, 8)}-${mutationId.slice(0, 8)}.json`;
    const path       = join(this.mutationDir, filename);

    const proposal = {
      mutation_id:  mutationId,
      gene_id:      geneId,
      created_at:   ts,
      status:       'pending',
      description:  mutationSpec.description ?? '',
      changes:      mutationSpec.changes ?? {},
      outcomes:     [],
    };

    writeFileSync(path, JSON.stringify(proposal, null, 2), 'utf8');
    return { mutationId, path };
  }

  /**
   * Evaluate a mutation by recording an outcome.
   * If the mutation's success rate surpasses the original gene's, promote it to the library.
   *
   * @param {string} mutationId
   * @param {{ success: boolean, metrics?: object }} outcomeData
   * @returns {{ promoted: boolean, geneId?: string }}
   */
  evaluateMutation(mutationId, outcomeData) {
    const file = this._findMutationFile(mutationId);
    if (!file) throw new Error(`Mutation not found: ${mutationId}`);

    const proposal = JSON.parse(readFileSync(file, 'utf8'));
    proposal.outcomes.push({ ts: new Date().toISOString(), ...outcomeData });

    const wins   = proposal.outcomes.filter((o) => o.success).length;
    const total  = proposal.outcomes.length;
    const mutWinRate = wins / total;

    // Check original gene win rate.
    const origGenes = this.library.query({});
    const orig      = origGenes.find((g) => g.id === proposal.gene_id);
    const origTotal = orig ? orig.success_count + orig.failure_count : 0;
    const origWinRate = (origTotal > 0 && orig)
      ? orig.success_count / origTotal : 0;

    let promoted = false;
    let newGeneId;

    if (total >= 3 && mutWinRate > Math.max(origWinRate, 0.6)) {
      // Promote: create new gene from mutation
      const newPattern = {
        ...(orig?.pattern ?? {}),
        ...proposal.changes,
        category:    orig?.category ?? 'fix_recipe',
        description: `[Mutation of ${proposal.gene_id.slice(0, 8)}] ${proposal.description}`,
      };
      const result = this.library.ingest('experiment', newPattern, {
        sourceRef: proposal.gene_id,
        applicability: orig ? JSON.parse(orig.applicability ?? '{}') : {},
      });
      newGeneId  = result.id;
      promoted   = true;
      proposal.status = 'promoted';
      proposal.promoted_gene_id = newGeneId;
    } else {
      proposal.status = total >= 5 ? 'evaluated' : 'pending';
    }

    writeFileSync(file, JSON.stringify(proposal, null, 2), 'utf8');
    return { promoted, geneId: newGeneId };
  }

  /**
   * List mutation proposals, optionally filtered by status.
   *
   * @param {'pending'|'promoted'|'evaluated'|null} status
   * @returns {object[]} MutationProposal[]
   */
  listMutations(status = null) {
    const files = readdirSync(this.mutationDir)
      .filter((f) => f.endsWith('.json'));

    return files
      .map((f) => {
        try { return JSON.parse(readFileSync(join(this.mutationDir, f), 'utf8')); }
        catch { return null; }
      })
      .filter((p) => p && (status == null || p.status === status))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _findMutationFile(mutationId) {
    if (!existsSync(this.mutationDir)) return null;
    const files = readdirSync(this.mutationDir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      try {
        const p = JSON.parse(readFileSync(join(this.mutationDir, f), 'utf8'));
        if (p.mutation_id === mutationId) return join(this.mutationDir, f);
      } catch { /* skip */ }
    }
    return null;
  }
}
