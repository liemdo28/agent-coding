// local-agent/experiments/StatsTester.js
// Phase 105 — Autonomous Scientist
// Pure statistical functions — no external dependencies.

/**
 * Abramowitz & Stegun 7.1.26 erf approximation.
 * Works for x >= 0; handles negative x by symmetry.
 * @param {number} x
 * @returns {number}
 */
function erf(x) {
  if (x < 0) return -erf(-x);
  const t  = 1 / (1 + 0.47047 * x);
  const a1 =  0.3480242;
  const a2 = -0.0958798;
  const a3 =  0.7478556;
  return 1 - (a1 * t + a2 * t * t + a3 * t * t * t) * Math.exp(-x * x);
}

/**
 * Standard normal CDF.
 * @param {number} x
 * @returns {number}
 */
function normalCDF(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/**
 * Sample mean.
 * @param {number[]} arr
 * @returns {number}
 */
function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * Sample variance (Bessel's correction, denominator n-1).
 * @param {number[]} arr
 * @returns {number}
 */
function variance(arr) {
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}

/**
 * Welch's t-test (unequal variances).
 *
 * @param {number[]} controlValues
 * @param {number[]} treatmentValues
 * @param {number}   [alpha=0.05]
 * @returns {{ t_stat: number, p_value: number, significant: boolean,
 *             effect_size: number, control_n: number, treatment_n: number,
 *             control_mean: number, treatment_mean: number }}
 */
export function tTest(controlValues, treatmentValues, alpha = 0.05) {
  const n1 = controlValues.length;
  const n2 = treatmentValues.length;

  const nullResult = {
    t_stat:        0,
    p_value:       1,
    significant:   false,
    effect_size:   0,
    control_n:     n1,
    treatment_n:   n2,
    control_mean:  n1 > 0 ? mean(controlValues)   : 0,
    treatment_mean: n2 > 0 ? mean(treatmentValues) : 0,
  };

  if (n1 < 2 || n2 < 2) return nullResult;

  const m1 = mean(controlValues);
  const m2 = mean(treatmentValues);
  const s1 = variance(controlValues);
  const s2 = variance(treatmentValues);

  const se1 = s1 / n1;
  const se2 = s2 / n2;
  const se  = Math.sqrt(se1 + se2);

  if (se === 0) return { ...nullResult, control_mean: m1, treatment_mean: m2 };

  const t_stat = (m1 - m2) / se;

  // Welch-Satterthwaite degrees of freedom (not used for p_value approx but computed)
  // df = (se1 + se2)² / (se1²/(n1-1) + se2²/(n2-1))
  // We use the normal approximation for p_value as specified.
  const p_value = 2 * (1 - normalCDF(Math.abs(t_stat)));

  // Cohen's d with pooled standard deviation
  const pooledStdDev = Math.sqrt((s1 + s2) / 2);
  const effect_size  = pooledStdDev === 0 ? 0 : (m1 - m2) / pooledStdDev;

  return {
    t_stat,
    p_value,
    significant:    p_value < alpha,
    effect_size,
    control_n:      n1,
    treatment_n:    n2,
    control_mean:   m1,
    treatment_mean: m2,
  };
}

/**
 * Split tasks by filter criteria and extract a metric value from each match.
 *
 * @param {object[]} tasks          — array of task objects
 * @param {object}   filter         — { worker_skill?, priority?, sla_breach?, company?, dev_status? }
 * @param {string}   metric         — field name to extract; 'sla_breach' coerced bool→number
 * @returns {number[]}
 */
export function splitByFilter(tasks, filter, metric) {
  const keys = Object.keys(filter);

  return tasks
    .filter((task) =>
      keys.every((key) => {
        const fv = filter[key];
        const tv = task[key];
        // Allow coercion comparison for booleans stored as strings
        // eslint-disable-next-line eqeqeq
        return tv == fv;
      })
    )
    .map((task) => {
      const raw = task[metric];
      if (metric === 'sla_breach') return raw ? 1 : 0;
      return Number(raw);
    })
    .filter((v) => !Number.isNaN(v));
}
