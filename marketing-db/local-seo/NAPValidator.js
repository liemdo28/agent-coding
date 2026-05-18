// local-seo/NAPValidator.js — NAP (Name, Address, Phone) consistency validator
// Offline-only: pure string comparison and normalization. No network calls.

// ── Phone normalization ───────────────────────────────────────────────────────

/**
 * Strip all non-digit characters and normalize to 10-digit US number.
 * Handles formats: (209) 555-1234, 209-555-1234, +12095551234, 2095551234
 *
 * @param {string} phone
 * @returns {string} 10-digit digit string, or '' if invalid
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  let digits = phone.replace(/\D/g, '');
  // Strip leading country code 1
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits.length === 10 ? digits : digits;  // return as-is if not 10 (flag later)
}

/**
 * Format a normalized phone string into a canonical display form.
 * @param {string} digits - 10 digit string
 * @returns {string} e.g. "(209) 555-1234"
 */
function formatPhone(digits) {
  if (digits.length !== 10) return digits;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
}

// ── Name normalization ────────────────────────────────────────────────────────

function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')   // remove punctuation
    .replace(/\b(llc|inc|corp|co|the|&|and)\b/g, '')  // strip legal/common words
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Address normalization ─────────────────────────────────────────────────────

const STREET_ABBREVS = {
  'street':    'st',
  'avenue':    'ave',
  'boulevard': 'blvd',
  'drive':     'dr',
  'road':      'rd',
  'lane':      'ln',
  'court':     'ct',
  'place':     'pl',
  'circle':    'cir',
  'highway':   'hwy',
  'parkway':   'pkwy',
  'suite':     'ste',
  'north':     'n',
  'south':     's',
  'east':      'e',
  'west':      'w',
};

function normalizeAddress(address) {
  if (!address || typeof address !== 'string') return '';
  let addr = address.toLowerCase().replace(/[,#.]/g, ' ').replace(/\s+/g, ' ').trim();

  for (const [long, short] of Object.entries(STREET_ABBREVS)) {
    addr = addr.replace(new RegExp(`\\b${long}\\b`, 'g'), short);
  }

  return addr.trim();
}

// ── String similarity (Jaccard) ───────────────────────────────────────────────

/**
 * Compute Jaccard similarity between two strings (tokenized into word sets).
 * Returns 0-1 (1 = identical sets).
 */
function jaccardSimilarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;

  const setA = new Set(a.split(/\s+/).filter(w => w.length > 0));
  const setB = new Set(b.split(/\s+/).filter(w => w.length > 0));

  if (setA.size === 0 && setB.size === 0) return 1;

  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

// ── Field comparison ──────────────────────────────────────────────────────────

/**
 * Compare two NAP objects. Returns per-field similarity and mismatch details.
 *
 * @param {{ name: string, address: string, phone: string, source?: string }} nap1
 * @param {{ name: string, address: string, phone: string, source?: string }} nap2
 * @returns {object} comparison result
 */
export function compareNAP(nap1, nap2) {
  if (!nap1 || !nap2) throw new Error('Both NAP objects are required');

  // Name comparison
  const name1n  = normalizeName(nap1.name ?? '');
  const name2n  = normalizeName(nap2.name ?? '');
  const nameSim = jaccardSimilarity(name1n, name2n);
  const nameMatch = nameSim >= 0.8;

  // Phone comparison
  const phone1n    = normalizePhone(nap1.phone ?? '');
  const phone2n    = normalizePhone(nap2.phone ?? '');
  const phoneMatch = phone1n.length >= 7 && phone2n.length >= 7 && phone1n === phone2n;
  const phoneMissing = !phone1n || !phone2n;

  // Address comparison
  const addr1n  = normalizeAddress(nap1.address ?? '');
  const addr2n  = normalizeAddress(nap2.address ?? '');
  const addrSim = jaccardSimilarity(addr1n, addr2n);
  const addrMatch = addrSim >= 0.7;

  // Collect mismatches
  const mismatches = [];
  if (!nameMatch && name1n && name2n) {
    mismatches.push({
      field:     'name',
      source1:   nap1.name,
      source2:   nap2.name,
      similarity: parseFloat(nameSim.toFixed(3)),
      issue:     'Name differs between sources — may cause ranking inconsistencies',
    });
  }
  if (!phoneMatch && !phoneMissing) {
    mismatches.push({
      field:     'phone',
      source1:   formatPhone(phone1n),
      source2:   formatPhone(phone2n),
      similarity: phone1n === phone2n ? 1 : 0,
      issue:     'Phone number mismatch between sources',
    });
  }
  if (!addrMatch && addr1n && addr2n) {
    mismatches.push({
      field:     'address',
      source1:   nap1.address,
      source2:   nap2.address,
      similarity: parseFloat(addrSim.toFixed(3)),
      issue:     'Address differs significantly between sources',
    });
  }

  // Format issues (same digits but different format)
  if (phoneMatch && nap1.phone !== nap2.phone) {
    mismatches.push({
      field:     'phone_format',
      source1:   nap1.phone,
      source2:   nap2.phone,
      similarity: 1,
      issue:     `Phone format inconsistency: "${nap1.phone}" vs "${nap2.phone}" — standardize to (XXX) XXX-XXXX`,
    });
  }

  const overallMatch = nameMatch && phoneMatch && addrMatch;
  const score = Math.round(
    (nameSim * 0.35 + (phoneMatch ? 1 : 0) * 0.40 + addrSim * 0.25) * 100
  );

  return {
    source1:      nap1.source ?? 'source1',
    source2:      nap2.source ?? 'source2',
    consistent:   overallMatch,
    score,         // 0-100
    fields: {
      name:    { match: nameMatch,  similarity: parseFloat(nameSim.toFixed(3)) },
      phone:   { match: phoneMatch, missing: phoneMissing },
      address: { match: addrMatch,  similarity: parseFloat(addrSim.toFixed(3)) },
    },
    mismatches,
  };
}

// ── Multi-source validation ───────────────────────────────────────────────────

/**
 * Validate NAP consistency across multiple sources.
 *
 * @param {object} locationData - Canonical location record (from DB)
 * @param {Array<{ source: string, name: string, address: string, phone: string }>} napRecords
 * @returns {object} Full validation report
 */
export function validateNAP(locationData, napRecords) {
  if (!locationData || typeof locationData !== 'object') throw new Error('locationData required');
  if (!Array.isArray(napRecords)) throw new Error('napRecords must be an array');

  const canonical = {
    source:  'canonical',
    name:    locationData.name    ?? '',
    address: locationData.address ?? '',
    phone:   locationData.phone   ?? '',
  };

  const results    = [];
  const issues     = [];

  // Check for missing canonical fields
  const missingCanonical = [];
  if (!canonical.name)    missingCanonical.push('name');
  if (!canonical.address) missingCanonical.push('address');
  if (!canonical.phone)   missingCanonical.push('phone');

  if (missingCanonical.length > 0) {
    issues.push({
      severity: 'critical',
      type:     'missing_canonical',
      message:  `Canonical record missing: ${missingCanonical.join(', ')}`,
    });
  }

  // Compare each NAP record against canonical
  for (const record of napRecords) {
    if (!record || typeof record !== 'object') continue;

    const napRecord = {
      source:  record.source ?? 'unknown',
      name:    record.name    ?? '',
      address: record.address ?? '',
      phone:   record.phone   ?? '',
    };

    // Check for missing fields in the record
    if (!napRecord.name)    issues.push({ severity: 'high', type: 'missing_field', message: `${napRecord.source}: missing name` });
    if (!napRecord.address) issues.push({ severity: 'high', type: 'missing_field', message: `${napRecord.source}: missing address` });
    if (!napRecord.phone)   issues.push({ severity: 'high', type: 'missing_field', message: `${napRecord.source}: missing phone` });

    const comparison = compareNAP(canonical, napRecord);
    results.push(comparison);

    // Collect mismatches as issues
    for (const mismatch of comparison.mismatches) {
      if (mismatch.field !== 'phone_format') {
        issues.push({
          severity:  mismatch.field === 'phone' ? 'critical' : 'high',
          type:      'nap_mismatch',
          source:    napRecord.source,
          field:     mismatch.field,
          message:   mismatch.issue,
          canonical: mismatch.source1,
          found:     mismatch.source2,
        });
      } else {
        issues.push({
          severity: 'low',
          type:     'format_inconsistency',
          source:   napRecord.source,
          field:    'phone',
          message:  mismatch.issue,
        });
      }
    }
  }

  const consistentCount = results.filter(r => r.consistent).length;
  const score           = getNAPScore(locationData, napRecords);

  return {
    location:   locationData.name ?? 'Unknown',
    canonical,
    recordCount: napRecords.length,
    consistentCount,
    inconsistentCount: napRecords.length - consistentCount,
    comparisons: results,
    issues,
    score,
    status: score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor',
    validated_at: new Date().toISOString(),
  };
}

/**
 * Returns an overall NAP consistency score (0-100).
 *
 * @param {object} locationData - Canonical location record
 * @param {Array}  napRecords   - Array of NAP records from different sources
 * @returns {number} 0-100
 */
export function getNAPScore(locationData, napRecords) {
  if (!locationData || !Array.isArray(napRecords) || napRecords.length === 0) return 0;

  const canonical = {
    source:  'canonical',
    name:    locationData.name    ?? '',
    address: locationData.address ?? '',
    phone:   locationData.phone   ?? '',
  };

  // Penalty for missing canonical fields
  let baseScore = 100;
  if (!canonical.name)    baseScore -= 15;
  if (!canonical.address) baseScore -= 15;
  if (!canonical.phone)   baseScore -= 15;

  if (napRecords.length === 0) return Math.max(0, baseScore);

  // Average comparison scores
  let totalScore = 0;
  let validCount = 0;

  for (const record of napRecords) {
    if (!record || typeof record !== 'object') continue;
    try {
      const comparison = compareNAP(canonical, {
        source:  record.source ?? 'unknown',
        name:    record.name    ?? '',
        address: record.address ?? '',
        phone:   record.phone   ?? '',
      });
      totalScore += comparison.score;
      validCount++;
    } catch {
      // skip malformed records
    }
  }

  if (validCount === 0) return Math.max(0, baseScore - 10);

  const avgComparison = totalScore / validCount;
  return Math.max(0, Math.min(100, Math.round((baseScore / 100) * avgComparison)));
}
