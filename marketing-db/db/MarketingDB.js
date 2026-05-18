// db/MarketingDB.js — SQLite WAL database for marketing-db
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

export function openDB(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  initSchema(db);
  return db;
}

function initSchema(db) {
  db.exec(`
    -- Core brand and location tables
    CREATE TABLE IF NOT EXISTS brands (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      type        TEXT DEFAULT 'restaurant',
      description TEXT,
      colors      TEXT,
      tagline     TEXT,
      website     TEXT,
      active      INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS locations (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id        INTEGER NOT NULL REFERENCES brands(id),
      name            TEXT NOT NULL,
      city            TEXT NOT NULL,
      state           TEXT,
      zip             TEXT,
      address         TEXT,
      phone           TEXT,
      google_place_id TEXT,
      google_maps_url TEXT,
      active          INTEGER DEFAULT 1,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_locations_brand ON locations(brand_id);

    -- Campaign management
    CREATE TABLE IF NOT EXISTS campaigns (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id     INTEGER REFERENCES brands(id),
      location_id  INTEGER REFERENCES locations(id),
      type         TEXT NOT NULL,
      title        TEXT NOT NULL,
      goal         TEXT,
      cta          TEXT,
      offer        TEXT,
      discount_pct REAL,
      platform     TEXT,
      status       TEXT DEFAULT 'draft',
      risk_level   TEXT DEFAULT 'LOW',
      scheduled_at TEXT,
      approved_at  TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_campaigns_brand ON campaigns(brand_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

    -- Content posts
    CREATE TABLE IF NOT EXISTS content_posts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id   INTEGER REFERENCES campaigns(id),
      brand_id      INTEGER REFERENCES brands(id),
      location_id   INTEGER REFERENCES locations(id),
      platform      TEXT NOT NULL,
      content_type  TEXT,
      hook          TEXT,
      caption       TEXT,
      hashtags      TEXT,
      cta           TEXT,
      asset_needed  TEXT,
      scheduled_at  TEXT,
      status        TEXT DEFAULT 'draft',
      engagement_score REAL,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    -- SEO keywords
    CREATE TABLE IF NOT EXISTS keywords (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id        INTEGER REFERENCES brands(id),
      location_id     INTEGER REFERENCES locations(id),
      keyword         TEXT NOT NULL,
      type            TEXT,
      geo_target      TEXT,
      search_vol_est  INTEGER,
      difficulty      INTEGER,
      intent          TEXT,
      priority        TEXT DEFAULT 'medium',
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_keywords_brand ON keywords(brand_id);

    -- Local SEO — NAP records
    CREATE TABLE IF NOT EXISTS nap_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER REFERENCES locations(id),
      source      TEXT NOT NULL,
      name        TEXT,
      address     TEXT,
      phone       TEXT,
      consistent  INTEGER DEFAULT 1,
      issues      TEXT,
      checked_at  TEXT DEFAULT (datetime('now'))
    );

    -- Competitors
    CREATE TABLE IF NOT EXISTS competitors (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id    INTEGER REFERENCES brands(id),
      name        TEXT NOT NULL,
      location    TEXT,
      type        TEXT,
      website     TEXT,
      data_json   TEXT,
      analyzed_at TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- Reviews
    CREATE TABLE IF NOT EXISTS reviews (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id            INTEGER REFERENCES brands(id),
      location_id         INTEGER REFERENCES locations(id),
      source              TEXT NOT NULL,
      rating              INTEGER,
      text                TEXT,
      author              TEXT,
      sentiment           TEXT,
      sentiment_score     REAL,
      escalation_required INTEGER DEFAULT 0,
      escalation_reason   TEXT,
      vip_customer        INTEGER DEFAULT 0,
      responded           INTEGER DEFAULT 0,
      response_text       TEXT,
      created_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_brand ON reviews(brand_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

    -- KPI metrics
    CREATE TABLE IF NOT EXISTS kpi_metrics (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaigns(id),
      brand_id    INTEGER REFERENCES brands(id),
      location_id INTEGER REFERENCES locations(id),
      metric      TEXT NOT NULL,
      value       REAL NOT NULL,
      channel     TEXT,
      recorded_at TEXT DEFAULT (datetime('now'))
    );

    -- Marketing memory / learnings
    CREATE TABLE IF NOT EXISTS marketing_memory (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id      INTEGER REFERENCES brands(id),
      type          TEXT NOT NULL,
      key           TEXT NOT NULL,
      value         TEXT NOT NULL,
      confidence    REAL DEFAULT 0.5,
      success_count INTEGER DEFAULT 0,
      fail_count    INTEGER DEFAULT 0,
      updated_at    TEXT DEFAULT (datetime('now')),
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_key ON marketing_memory(brand_id, type, key);

    -- Assets
    CREATE TABLE IF NOT EXISTS assets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id    INTEGER REFERENCES brands(id),
      name        TEXT NOT NULL,
      file_path   TEXT,
      type        TEXT,
      size_bytes  INTEGER,
      hash        TEXT,
      width       INTEGER,
      height      INTEGER,
      status      TEXT DEFAULT 'active',
      issues      TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- Approval queue
    CREATE TABLE IF NOT EXISTS approval_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type   TEXT NOT NULL,
      item_id     INTEGER,
      brand_id    INTEGER REFERENCES brands(id),
      title       TEXT,
      risk_level  TEXT DEFAULT 'LOW',
      status      TEXT DEFAULT 'pending',
      reviewer    TEXT,
      notes       TEXT,
      approved_at TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- Content calendar
    CREATE TABLE IF NOT EXISTS content_calendar (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id     INTEGER REFERENCES brands(id),
      location_id  INTEGER REFERENCES locations(id),
      date         TEXT NOT NULL,
      platform     TEXT NOT NULL,
      campaign_type TEXT,
      goal         TEXT,
      cta          TEXT,
      asset_required TEXT,
      approval_required INTEGER DEFAULT 1,
      status       TEXT DEFAULT 'planned',
      created_at   TEXT DEFAULT (datetime('now'))
    );

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      action    TEXT NOT NULL,
      module    TEXT,
      result    TEXT,
      details   TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Phase completion tracking
    CREATE TABLE IF NOT EXISTS phase_completion (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      phase       INTEGER UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      status      TEXT DEFAULT 'pending',
      verified_at TEXT,
      notes       TEXT
    );

    -- Insert known phases if not exists
    INSERT OR IGNORE INTO phase_completion(phase, name) VALUES
      (1,  'Core Foundation (DB, CLI, Config)'),
      (2,  'Data Importer'),
      (3,  'Search Engine'),
      (4,  'QA Engine'),
      (5,  'Seed Data'),
      (6,  'Offline Policy Enforcement'),
      (7,  'Local SEO Intelligence Engine'),
      (8,  'Content Calendar Engine'),
      (9,  'Social Media Intelligence Engine'),
      (10, 'Review + Reputation Engine'),
      (11, 'Competitor Intelligence System'),
      (12, 'KPI + Revenue Intelligence Engine'),
      (13, 'Multi-Brand Intelligence System'),
      (14, 'Marketing Memory System'),
      (15, 'Local Marketing AI Agent'),
      (16, 'CEO Marketing Command Center'),
      (17, 'Visual Asset Intelligence'),
      (18, 'Approval + Safety Workflow'),
      (19, 'Deployment + Export Engine'),
      (20, 'Full Self-Learning Marketing Ecosystem');
  `);
}

// ── Brand operations ──────────────────────────────────────────────────────────

export function addBrand(db, { name, type = 'restaurant', description = '', colors = '', tagline = '', website = '' }) {
  return db.prepare(`INSERT OR IGNORE INTO brands(name,type,description,colors,tagline,website) VALUES(?,?,?,?,?,?)`).run(name, type, description, colors, tagline, website);
}

export function listBrands(db) {
  return db.prepare('SELECT * FROM brands WHERE active=1 ORDER BY name').all();
}

export function getBrand(db, nameOrId) {
  const byId   = db.prepare('SELECT * FROM brands WHERE id=?').get(nameOrId);
  const byName = db.prepare('SELECT * FROM brands WHERE name=?').get(nameOrId);
  return byId ?? byName;
}

// ── Location operations ───────────────────────────────────────────────────────

export function addLocation(db, { brand_id, name, city, state = '', zip = '', address = '', phone = '', google_place_id = '' }) {
  return db.prepare(`INSERT INTO locations(brand_id,name,city,state,zip,address,phone,google_place_id) VALUES(?,?,?,?,?,?,?,?)`).run(brand_id, name, city, state, zip, address, phone, google_place_id);
}

export function listLocations(db, brand_id) {
  if (brand_id) return db.prepare('SELECT * FROM locations WHERE brand_id=? AND active=1').all(brand_id);
  return db.prepare('SELECT l.*, b.name as brand_name FROM locations l JOIN brands b ON l.brand_id=b.id WHERE l.active=1').all();
}

// ── Campaign operations ───────────────────────────────────────────────────────

export function addCampaign(db, opts) {
  const { brand_id, location_id, type, title, goal, cta, offer, discount_pct, platform, status = 'draft', risk_level = 'LOW', scheduled_at } = opts;
  return db.prepare(`INSERT INTO campaigns(brand_id,location_id,type,title,goal,cta,offer,discount_pct,platform,status,risk_level,scheduled_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(brand_id, location_id ?? null, type, title, goal ?? null, cta ?? null, offer ?? null, discount_pct ?? null, platform ?? null, status, risk_level, scheduled_at ?? null);
}

export function listCampaigns(db, { brand_id, status, limit = 50 } = {}) {
  let q = 'SELECT c.*, b.name as brand_name FROM campaigns c LEFT JOIN brands b ON c.brand_id=b.id WHERE 1=1';
  const params = [];
  if (brand_id) { q += ' AND c.brand_id=?'; params.push(brand_id); }
  if (status)   { q += ' AND c.status=?';   params.push(status); }
  q += ' ORDER BY c.created_at DESC LIMIT ?';
  params.push(limit);
  return db.prepare(q).all(...params);
}

// ── Review operations ─────────────────────────────────────────────────────────

export function addReview(db, opts) {
  const { brand_id, location_id, source, rating, text, author, sentiment, sentiment_score, escalation_required = 0, escalation_reason, vip_customer = 0 } = opts;
  return db.prepare(`INSERT INTO reviews(brand_id,location_id,source,rating,text,author,sentiment,sentiment_score,escalation_required,escalation_reason,vip_customer) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(brand_id, location_id ?? null, source, rating, text ?? '', author ?? '', sentiment ?? 'neutral', sentiment_score ?? 0.5, escalation_required, escalation_reason ?? null, vip_customer);
}

export function listReviews(db, { brand_id, rating, escalation_required, limit = 50 } = {}) {
  let q = 'SELECT * FROM reviews WHERE 1=1';
  const params = [];
  if (brand_id)             { q += ' AND brand_id=?';             params.push(brand_id); }
  if (rating !== undefined) { q += ' AND rating=?';               params.push(rating); }
  if (escalation_required)  { q += ' AND escalation_required=1'; }
  q += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  return db.prepare(q).all(...params);
}

// ── KPI operations ────────────────────────────────────────────────────────────

export function recordKPI(db, { campaign_id, brand_id, location_id, metric, value, channel }) {
  return db.prepare(`INSERT INTO kpi_metrics(campaign_id,brand_id,location_id,metric,value,channel) VALUES(?,?,?,?,?,?)`).run(campaign_id ?? null, brand_id, location_id ?? null, metric, value, channel ?? null);
}

export function getKPISummary(db, brand_id) {
  return db.prepare(`SELECT metric, AVG(value) as avg_value, MAX(value) as max_value, COUNT(*) as count FROM kpi_metrics WHERE brand_id=? GROUP BY metric`).all(brand_id);
}

// ── Memory operations ─────────────────────────────────────────────────────────

export function upsertMemory(db, { brand_id, type, key, value, confidence = 0.5, success = false }) {
  const existing = db.prepare('SELECT * FROM marketing_memory WHERE brand_id=? AND type=? AND key=?').get(brand_id, type, key);
  if (existing) {
    const sc = success ? existing.success_count + 1 : existing.success_count;
    const fc = success ? existing.fail_count : existing.fail_count + 1;
    const conf = (sc / (sc + fc + 1));
    db.prepare('UPDATE marketing_memory SET value=?,confidence=?,success_count=?,fail_count=?,updated_at=datetime("now") WHERE id=?').run(value, conf, sc, fc, existing.id);
  } else {
    db.prepare('INSERT INTO marketing_memory(brand_id,type,key,value,confidence) VALUES(?,?,?,?,?)').run(brand_id, type, key, value, confidence);
  }
}

export function getMemory(db, brand_id, type) {
  if (type) return db.prepare('SELECT * FROM marketing_memory WHERE brand_id=? AND type=? ORDER BY confidence DESC').all(brand_id, type);
  return db.prepare('SELECT * FROM marketing_memory WHERE brand_id=? ORDER BY confidence DESC').all(brand_id);
}

// ── Phase tracking ────────────────────────────────────────────────────────────

export function markPhaseComplete(db, phase) {
  db.prepare(`UPDATE phase_completion SET status='complete', verified_at=datetime('now') WHERE phase=?`).run(phase);
}

export function getPhaseStatus(db) {
  return db.prepare('SELECT * FROM phase_completion ORDER BY phase').all();
}
