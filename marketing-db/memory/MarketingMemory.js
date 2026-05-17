// memory/MarketingMemory.js — AI marketing memory system
// Offline-only, rule-based, ES module, Node.js 22

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Bayesian-like confidence update.
 *   conf = (successes + 1) / (successes + failures + 2)
 * Clamped to [0.05, 0.95].
 */
function bayesianConfidence(successes, failures) {
  const raw = (successes + 1) / (successes + failures + 2);
  return Math.min(0.95, Math.max(0.05, raw));
}

/**
 * Persist (insert or update) a single memory entry.
 * success=true → increment success_count; false → increment fail_count.
 */
function upsertEntry(db, { brand_id, type, key, value, success = null }) {
  const existing = db
    .prepare('SELECT * FROM marketing_memory WHERE brand_id=? AND type=? AND key=?')
    .get(brand_id, type, key);

  if (existing) {
    const sc = (success === true)  ? existing.success_count + 1 : existing.success_count;
    const fc = (success === false) ? existing.fail_count + 1    : existing.fail_count;
    const conf = bayesianConfidence(sc, fc);
    db.prepare(
      `UPDATE marketing_memory
          SET value=?, confidence=?, success_count=?, fail_count=?,
              updated_at=datetime('now')
        WHERE id=?`
    ).run(JSON.stringify(value), conf, sc, fc, existing.id);
  } else {
    const sc   = success === true  ? 1 : 0;
    const fc   = success === false ? 1 : 0;
    const conf = bayesianConfidence(sc, fc);
    db.prepare(
      `INSERT INTO marketing_memory(brand_id, type, key, value, confidence, success_count, fail_count)
       VALUES(?,?,?,?,?,?,?)`
    ).run(brand_id, type, key, JSON.stringify(value), conf, sc, fc);
  }
}

/**
 * Retrieve a single memory entry and parse its JSON value.
 * Returns null if not found.
 */
function getEntry(db, brand_id, type, key) {
  const row = db
    .prepare('SELECT * FROM marketing_memory WHERE brand_id=? AND type=? AND key=?')
    .get(brand_id, type, key);
  if (!row) return null;
  try { row.value = JSON.parse(row.value); } catch { /* leave as string */ }
  return row;
}

/**
 * Get all entries of a given type, highest confidence first.
 */
function getAllOfType(db, brand_id, type) {
  const rows = db
    .prepare(
      'SELECT * FROM marketing_memory WHERE brand_id=? AND type=? ORDER BY confidence DESC'
    )
    .all(brand_id, type);
  return rows.map((r) => {
    try { r.value = JSON.parse(r.value); } catch { /* leave as string */ }
    return r;
  });
}

// ── KPI thresholds for learning classification ─────────────────────────────────

const KPI_THRESHOLDS = {
  ctr:         { success: 0.03, failure: 0.01 },   // 3% = success, <1% = failure
  conversions: { success: 20,   failure: 5    },
  engagement:  { success: 0.05, failure: 0.01 },
  roas:        { success: 3,    failure: 1    },
  reach:       { success: 500,  failure: 100  },
};

function classifyKPIResult(kpiData) {
  let successSignals = 0;
  let failureSignals = 0;
  let checked = 0;

  for (const [metric, thresholds] of Object.entries(KPI_THRESHOLDS)) {
    const val = kpiData[metric];
    if (val === undefined || val === null) continue;
    checked++;
    if (val >= thresholds.success) successSignals++;
    else if (val < thresholds.failure) failureSignals++;
  }

  if (checked === 0) return 'neutral';
  if (successSignals > failureSignals) return 'success';
  if (failureSignals > successSignals) return 'failure';
  return 'neutral';
}

// ── Exported API ───────────────────────────────────────────────────────────────

/**
 * Record a campaign result (success or failure) in memory.
 * campaignData: { type, platform, offer_type, cta_type, posting_time }
 * result: 'success' | 'failure'
 */
export function recordCampaignResult(db, brand_id, campaignData, result) {
  const success = result === 'success';
  const { type, platform, offer_type, cta_type, posting_time } = campaignData;

  // Store successful_campaign or failed_campaign record
  const memType = success ? 'successful_campaign' : 'failed_campaign';
  const key     = [type, platform, offer_type, cta_type].filter(Boolean).join('|');
  const payload = success
    ? { type, platform, offer_type, cta_type, posting_time, result: 'success' }
    : { type, reason: campaignData.reason ?? 'poor performance', platform };

  upsertEntry(db, { brand_id, type: memType, key, value: payload, success });

  // Update platform-specific CTA learning
  if (cta_type && platform) {
    const ctaKey = `${platform}:${cta_type}`;
    upsertEntry(db, {
      brand_id,
      type:  'best_cta',
      key:   ctaKey,
      value: { cta_text: campaignData.cta_text ?? cta_type, platform, ctr: campaignData.ctr ?? 0, conversions: campaignData.conversions ?? 0 },
      success,
    });
  }

  // Update best posting time
  if (posting_time && platform) {
    const { day_of_week, hour } = typeof posting_time === 'object'
      ? posting_time
      : { day_of_week: null, hour: null };
    if (day_of_week !== null && hour !== null) {
      const ptKey = `${platform}:${day_of_week}:${hour}`;
      upsertEntry(db, {
        brand_id,
        type:  'best_posting_time',
        key:   ptKey,
        value: { platform, day_of_week, hour, engagement: campaignData.engagement ?? 0 },
        success,
      });
    }
  }

  // Update discount range learning
  if (campaignData.discount_pct) {
    const pct   = Number(campaignData.discount_pct);
    const range = pct < 15 ? 'low' : pct < 30 ? 'mid' : 'high';
    upsertEntry(db, {
      brand_id,
      type:  'best_discount_range',
      key:   range,
      value: { min_pct: pct - 5, max_pct: pct + 5, conversion_rate: campaignData.conversions ?? 0 },
      success,
    });
  }

  // Update content type learning
  if (type && platform) {
    upsertEntry(db, {
      brand_id,
      type:  'best_content',
      key:   `${platform}:${type}`,
      value: { content_type: type, platform, engagement_score: campaignData.engagement ?? 0 },
      success,
    });
  }
}

/**
 * Learn from a campaign + its KPI data.
 * Automatically classifies success/failure from KPIs and updates all relevant
 * memory types.
 */
export function learnFromCampaign(db, brand_id, campaign, kpiData) {
  const result = classifyKPIResult(kpiData);
  if (result === 'neutral') return { learned: false, reason: 'insufficient KPI signal' };

  const enriched = {
    ...campaign,
    ctr:         kpiData.ctr,
    conversions: kpiData.conversions,
    engagement:  kpiData.engagement,
    roas:        kpiData.roas,
    reach:       kpiData.reach,
  };

  recordCampaignResult(db, brand_id, enriched, result);

  // Store keyword performance if provided
  if (kpiData.keywords && Array.isArray(kpiData.keywords)) {
    for (const kw of kpiData.keywords) {
      if (!kw.keyword) continue;
      upsertEntry(db, {
        brand_id,
        type:    'best_local_keywords',
        key:     kw.keyword,
        value:   { keyword: kw.keyword, position: kw.position ?? 0, traffic: kw.traffic ?? 0 },
        success: result === 'success',
      });
    }
  }

  return { learned: true, result, kpiSignals: Object.keys(kpiData).length };
}

/**
 * Generic recommendation retrieval.
 * type: one of the memory type strings.
 * Returns the highest-confidence entry's value, or null.
 */
export function getRecommendation(db, brand_id, { type }) {
  const entries = getAllOfType(db, brand_id, type);
  if (!entries.length) return null;
  return {
    value:      entries[0].value,
    confidence: entries[0].confidence,
    key:        entries[0].key,
  };
}

/**
 * Returns the best known posting time for a platform.
 * { day, hour } — day is 0-6 (0=Sunday), hour is 0-23.
 * Returns null if no data available.
 */
export function getBestPostingTime(db, brand_id, platform) {
  const entries = getAllOfType(db, brand_id, 'best_posting_time')
    .filter((e) => e.value?.platform === platform || e.key?.startsWith(`${platform}:`));

  if (!entries.length) {
    // Sensible defaults by platform when no data learned yet
    const defaults = {
      instagram: { day: 3, hour: 12, confidence: 0.0 },
      facebook:  { day: 3, hour: 13, confidence: 0.0 },
      tiktok:    { day: 5, hour: 19, confidence: 0.0 },
      linkedin:  { day: 2, hour: 8,  confidence: 0.0 },
    };
    return defaults[platform] ?? { day: 3, hour: 12, confidence: 0.0 };
  }

  const best = entries[0];
  return {
    day:        best.value?.day_of_week ?? best.value?.day,
    hour:       best.value?.hour,
    platform,
    confidence: best.confidence,
    engagement: best.value?.engagement,
  };
}

/**
 * Returns the highest-confidence CTA for a given platform.
 */
export function getBestCTA(db, brand_id, platform) {
  const entries = getAllOfType(db, brand_id, 'best_cta')
    .filter((e) => e.value?.platform === platform || e.key?.startsWith(`${platform}:`));

  if (!entries.length) {
    // Generic defaults
    const defaults = {
      instagram: 'Tap the link in bio to order now!',
      facebook:  'Click below to claim your offer.',
      tiktok:    'Follow for more deals!',
      linkedin:  'Connect with us to learn more.',
    };
    return { cta_text: defaults[platform] ?? 'Visit us today!', confidence: 0.0, platform };
  }

  const best = entries[0];
  return {
    cta_text:    best.value?.cta_text,
    platform,
    ctr:         best.value?.ctr,
    conversions: best.value?.conversions,
    confidence:  best.confidence,
  };
}

/**
 * Returns the discount range with the best conversion rate.
 */
export function getBestDiscount(db, brand_id) {
  const entries = getAllOfType(db, brand_id, 'best_discount_range');

  if (!entries.length) {
    return { min_pct: 10, max_pct: 20, conversion_rate: 0, confidence: 0.0, note: 'no data — using default range' };
  }

  const best = entries[0];
  return {
    min_pct:         best.value?.min_pct,
    max_pct:         best.value?.max_pct,
    conversion_rate: best.value?.conversion_rate,
    confidence:      best.confidence,
  };
}

/**
 * Returns a full summary of all learnings for a brand.
 */
export function getMemorySummary(db, brand_id) {
  const allEntries = db
    .prepare('SELECT * FROM marketing_memory WHERE brand_id=? ORDER BY type, confidence DESC')
    .all(brand_id);

  const byType = {};
  for (const row of allEntries) {
    try { row.value = JSON.parse(row.value); } catch { /* leave as string */ }
    if (!byType[row.type]) byType[row.type] = [];
    byType[row.type].push(row);
  }

  const topEntries = allEntries
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);

  const totalEntries      = allEntries.length;
  const avgConfidence     = totalEntries
    ? allEntries.reduce((s, r) => s + r.confidence, 0) / totalEntries
    : 0;
  const successfulCampaigns = (byType['successful_campaign'] ?? []).length;
  const failedCampaigns     = (byType['failed_campaign']     ?? []).length;

  return {
    brand_id,
    totalEntries,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    successfulCampaigns,
    failedCampaigns,
    winRate: (successfulCampaigns + failedCampaigns) > 0
      ? Math.round((successfulCampaigns / (successfulCampaigns + failedCampaigns)) * 100)
      : null,
    byType: Object.fromEntries(
      Object.entries(byType).map(([type, rows]) => [
        type,
        {
          count:     rows.length,
          topEntry:  rows[0] ?? null,
          avgConf:   rows.length
            ? Math.round((rows.reduce((s, r) => s + r.confidence, 0) / rows.length) * 100) / 100
            : 0,
        },
      ])
    ),
    topLearnings: topEntries.map((r) => ({
      type:       r.type,
      key:        r.key,
      value:      r.value,
      confidence: r.confidence,
    })),
    bestPostingTimes: {
      instagram: getBestPostingTime(db, brand_id, 'instagram'),
      facebook:  getBestPostingTime(db, brand_id, 'facebook'),
      tiktok:    getBestPostingTime(db, brand_id, 'tiktok'),
    },
    bestCTAs: {
      instagram: getBestCTA(db, brand_id, 'instagram'),
      facebook:  getBestCTA(db, brand_id, 'facebook'),
    },
    bestDiscount: getBestDiscount(db, brand_id),
  };
}

/**
 * Clear all memory entries of a given type for a brand.
 * If type is omitted, clears ALL memory for the brand.
 */
export function resetMemory(db, brand_id, type) {
  if (type) {
    return db
      .prepare('DELETE FROM marketing_memory WHERE brand_id=? AND type=?')
      .run(brand_id, type);
  }
  return db
    .prepare('DELETE FROM marketing_memory WHERE brand_id=?')
    .run(brand_id);
}
