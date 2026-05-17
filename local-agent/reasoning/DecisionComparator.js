// reasoning/DecisionComparator.js — compare strategies and select best option
/**
 * Compare multiple strategies and rank them by weighted score.
 * @param {Strategy[]} strategies
 * @param {{ priorities?: { risk?: number, effort?: number, coverage?: number } }} opts
 * @returns {{ ranked: RankedStrategy[], winner: string }}
 */
export function compareStrategies(strategies, opts = {}) {
  const weights = {
    risk:     opts.priorities?.risk     ?? 0.5,
    effort:   opts.priorities?.effort   ?? 0.3,
    coverage: opts.priorities?.coverage ?? 0.2,
  };

  const riskMap   = { low: 1.0, medium: 0.6, high: 0.3 };
  const effortMap = { low: 1.0, medium: 0.7, high: 0.4 };

  const ranked = strategies.map((s) => {
    const riskScore    = riskMap[s.risk]   ?? 0.5;
    const effortScore  = effortMap[s.effort] ?? 0.5;
    const coverageScore = s.id === 'comprehensive' ? 1.0 : s.id === 'balanced' ? 0.75 : 0.5;

    const total = (
      riskScore    * weights.risk +
      effortScore  * weights.effort +
      coverageScore * weights.coverage
    );

    return { ...s, score: +total.toFixed(3), riskScore, effortScore, coverageScore };
  });

  ranked.sort((a, b) => b.score - a.score);
  const winner = ranked[0]?.id ?? 'balanced';

  return { ranked, winner };
}
