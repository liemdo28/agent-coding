#!/usr/bin/env python3
"""
Full Autonomous Corporate Agent v2.0
Digital Twin Final - Advanced Dashboard Generator
================================================
- 100+ company profiles
- 512 worker pool visualization
- Task priority color gradient (Critical → Low)
- SLA / QA fail / Rollback risk with color gradient
- Multi-batch simulation overlay
- Interactive Mermaid nodes + tooltip
- Offline, near real-time from execution_summary.json + simulation_report.json + analytics.json
"""

import json
import random
from pathlib import Path
from datetime import datetime

# --- Configuration ---
EXEC_SUM      = Path(".super-agent-fullauto-kpi/execution_summary.json")
ANALYTICS     = Path(".super-agent-fullauto-kpi/analytics.json")
SIM_REPORT    = Path(".super-agent-fullauto-kpi/simulation_report.json")
DASHBOARD_HTML = Path(".super-agent-fullauto-kpi/dashboard_digital_twin_final.html")

NUM_COMPANIES = 100
WORKER_POOL   = 512

# Priority color palette (Critical → Low)
PRIORITY_COLORS = {
    "critical": "#ff1744",
    "high":     "#ff6d00",
    "medium":   "#fdd835",
    "normal":   "#76ff03",
    "low":      "#00e676",
}

# Risk gradient for SLA / QA / Rollback
RISK_GRADIENT = {
    "safe":   "#c8e6c9",
    "warn":   "#fff9c4",
    "alert":  "#ffccbc",
    "danger": "#ffcdd2",
}

def load_data():
    """Load all JSON data sources."""
    exec_data   = []
    analytics   = {}
    sim_report  = []
    try:
        exec_data = json.load(open(EXEC_SUM))
    except FileNotFoundError:
        print(f"[WARN] {EXEC_SUM} not found — generating sample data")
        exec_data = _generate_sample_exec_data()

    try:
        analytics = json.load(open(ANALYTICS))
    except FileNotFoundError:
        print(f"[WARN] {ANALYTICS} not found")
        analytics = {}

    try:
        sim_report = json.load(open(SIM_REPORT))
    except FileNotFoundError:
        print(f"[WARN] {SIM_REPORT} not found — generating sample simulation")
        sim_report = _generate_sample_sim_report(exec_data)

    return exec_data, analytics, sim_report


def _generate_sample_exec_data():
    """Generate realistic sample execution data for 100 companies."""
    companies = [f"Company_{i:03d}" for i in range(1, NUM_COMPANIES + 1)]
    priorities = list(PRIORITY_COLORS.keys())
    qa_statuses = ["QA_PASS", "QA_FAIL", "QA_PENDING"]
    dev_statuses = ["DEV_SUCCESS", "DEV_FAILED", "DEV_PENDING"]

    tasks = []
    for c in companies:
        num_tasks = random.randint(5, 40)
        for _ in range(num_tasks):
            priority = random.choices(
                priorities,
                weights=[0.05, 0.15, 0.30, 0.35, 0.15]
            )[0]
            tasks.append({
                "task_id":      f"T{random.randint(10000, 99999)}",
                "company":      c,
                "priority":     priority,
                "qa_status":    random.choices(qa_statuses, weights=[0.70, 0.20, 0.10])[0],
                "dev_status":   random.choices(dev_statuses, weights=[0.75, 0.15, 0.10])[0],
                "worker_id":    f"W{random.randint(1, WORKER_POOL):04d}",
                "batch_id":     random.randint(1, 8),
                "sla_remaining": round(random.uniform(0, 100), 1),
            })
    return tasks


def _generate_sample_sim_report(exec_data):
    """Generate a simulation report with batch overlays."""
    companies = sorted(set(t["company"] for t in exec_data))
    batches = []
    for batch_id in range(1, 9):
        batch_tasks = [t for t in exec_data if t.get("batch_id") == batch_id]
        batches.append({
            "batch_id":      batch_id,
            "total_tasks":   len(batch_tasks),
            "active_workers": random.randint(40, WORKER_POOL),
            "predicted_qa_fail_rate": round(random.uniform(0.05, 0.30), 3),
            "predicted_rollback_rate": round(random.uniform(0.02, 0.20), 3),
            "predicted_sla_breach": round(random.uniform(0, 15), 1),
            "risk_score":    round(random.uniform(0, 100), 1),
        })
    return batches


def _risk_class(value, thresholds=(0.1, 0.2, 0.3)):
    """Return CSS class based on risk thresholds."""
    if value >= thresholds[2]:
        return "risk-danger"
    elif value >= thresholds[1]:
        return "risk-alert"
    elif value >= thresholds[0]:
        return "risk-warn"
    return "risk-safe"


def _priority_class(ratio):
    """Return CSS class based on high-priority ratio."""
    if ratio >= 0.5:
        return "prio-critical"
    elif ratio >= 0.3:
        return "prio-high"
    elif ratio >= 0.15:
        return "prio-medium"
    return "prio-normal"


def _build_kpi_table(exec_data):
    """Build the KPI summary table HTML."""
    companies = sorted(set(t["company"] for t in exec_data))

    html = """
    <table id="kpi-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Company</th>
          <th>Total Tasks</th>
          <th>Workers</th>
          <th>High Priority</th>
          <th>QA Fail %</th>
          <th>Rollback %</th>
          <th>SLA Breach %</th>
          <th>Risk Score</th>
          <th>Batch</th>
        </tr>
      </thead>
      <tbody>
    """

    for idx, c in enumerate(companies, 1):
        tasks_c = [t for t in exec_data if t["company"] == c]
        total   = len(tasks_c)
        if total == 0:
            continue

        high_prio = sum(1 for t in tasks_c if t["priority"].lower() in ("critical", "high"))
        qa_fail   = sum(1 for t in tasks_c if t["qa_status"] == "QA_FAIL")
        rollback  = sum(1 for t in tasks_c if t["dev_status"] == "DEV_FAILED")
        sla_breach= sum(1 for t in tasks_c if t.get("sla_remaining", 100) < 10)

        qa_ratio    = qa_fail / total
        rb_ratio    = rollback / total
        sla_ratio   = sla_breach / total
        prio_ratio  = high_prio / total

        workers = max(1, min(WORKER_POOL, total))
        batch   = tasks_c[0].get("batch_id", "-")

        risk_score = int(
            prio_ratio * 40 +
            qa_ratio   * 30 +
            rb_ratio   * 20 +
            sla_ratio  * 10
        )

        qa_cls    = _risk_class(qa_ratio,    (0.10, 0.20, 0.30))
        rb_cls    = _risk_class(rb_ratio,    (0.05, 0.10, 0.20))
        sla_cls   = _risk_class(sla_ratio,   (0.05, 0.10, 0.20))
        prio_cls  = _priority_class(prio_ratio)

        tooltip = (
            f"Company: {c}\\n"
            f"Total Tasks: {total}\\n"
            f"Workers: {workers}\\n"
            f"High Priority: {high_prio}\\n"
            f"QA Fail: {qa_fail} ({qa_ratio:.1%})\\n"
            f"Rollback: {rollback} ({rb_ratio:.1%})\\n"
            f"SLA Breach: {sla_breach} ({sla_ratio:.1%})\\n"
            f"Risk Score: {risk_score}"
        ).replace("\n", "&#10;")

        html += f"""
        <tr class="{prio_cls}" title="{tooltip}">
          <td>{idx}</td>
          <td><strong>{c}</strong></td>
          <td>{total}</td>
          <td>{workers}</td>
          <td class="{prio_cls}">{high_prio}</td>
          <td class="{qa_cls}">{qa_ratio:.1%}</td>
          <td class="{rb_cls}">{rb_ratio:.1%}</td>
          <td class="{sla_cls}">{sla_ratio:.1%}</td>
          <td>
            <div class="risk-bar-container">
              <div class="risk-bar {('bar-danger' if risk_score>=60 else 'bar-warn' if risk_score>=30 else 'bar-safe')}"
                   style="width:{risk_score}%;"></div>
              <span class="risk-label">{risk_score}</span>
            </div>
          </td>
          <td>Batch {batch}</td>
        </tr>
        """
    html += "</tbody></table>"
    return html


def _build_mermaid_flow(exec_data, sim_report):
    """Build interactive Mermaid flowchart with multi-batch overlay."""
    companies = sorted(set(t["company"] for t in exec_data))

    # Build batch simulation stats
    batch_stats = {}
    for b in sim_report:
        batch_stats[b["batch_id"]] = b

    mermaid = ["flowchart TB"]
    mermaid.append("    subgraph INPUT[📥 Task Input]")
    mermaid.append("        I1[(DB)]")
    mermaid.append("        I2[(Telegram)]")
    mermaid.append("        I3[(CLI)]")
    mermaid.append("    end")
    mermaid.append("    INPUT --> DECISION")
    mermaid.append("    DECISION{{Decision Engine}}")
    mermaid.append("    DECISION --> PRIORITY")
    mermaid.append("    PRIORITY[\"📊 Predictive Priority & Company Assignment\"]")
    mermaid.append("    PRIORITY --> ALLOC[\"👷 Dynamic Worker Allocation\"]")
    mermaid.append(f"    ALLOC[\"👷 Dynamic Worker Allocation — Pool: {WORKER_POOL} workers\"]")

    # Per-company nodes (grouped by priority)
    critical = []
    high     = []
    medium   = []
    normal   = []
    low      = []

    for c in companies:
        tasks_c    = [t for t in exec_data if t["company"] == c]
        total      = len(tasks_c)
        if total == 0:
            continue
        high_prio  = sum(1 for t in tasks_c if t["priority"].lower() in ("critical", "high"))
        prio_ratio = high_prio / total
        workers    = max(1, min(WORKER_POOL, total))
        batch_id   = tasks_c[0].get("batch_id", 1)
        bstat      = batch_stats.get(batch_id, {})
        qa_fail    = sum(1 for t in tasks_c if t["qa_status"] == "QA_FAIL")
        rollback   = sum(1 for t in tasks_c if t["dev_status"] == "DEV_FAILED")

        # Color by priority ratio
        if prio_ratio >= 0.5:
            color = PRIORITY_COLORS["critical"]
            critical.append(c)
        elif prio_ratio >= 0.3:
            color = PRIORITY_COLORS["high"]
            high.append(c)
        elif prio_ratio >= 0.15:
            color = PRIORITY_COLORS["medium"]
            medium.append(c)
        elif prio_ratio >= 0.05:
            color = PRIORITY_COLORS["normal"]
            normal.append(c)
        else:
            color = PRIORITY_COLORS["low"]
            low.append(c)

        tooltip = (
            f"Tasks: {total}\\n"
            f"Workers: {workers}\\n"
            f"High Priority: {high_prio}\\n"
            f"QA Fail: {qa_fail}\\n"
            f"Rollback: {rollback}\\n"
            f"Batch: {batch_id}\\n"
            f"Predicted SLA Breach: {bstat.get('predicted_sla_breach', 'N/A')}%\\n"
            f"Risk Score: {bstat.get('risk_score', 'N/A')}"
        )

        # Escape double quotes for HTML title attribute
        safe_tooltip = tooltip.replace('"', "'").replace("\n", "&#10;")
        node_id = c.replace("-", "_").replace(" ", "_")
        mermaid.append(
            f'    {node_id}["<b>{c}</b><br/>'
            f'Tasks:{total} | Workers:{workers}<br/>'
            f'HP:{high_prio} | QAF:{qa_fail} | RB:{rollback}<br/>'
            f'Batch:{batch_id} | Risk:{bstat.get("risk_score","?")}'
            f'"]:::prio'
        )
        mermaid.append(f"    ALLOC --> {node_id}")
        mermaid.append(f"    {node_id} --> QA")
        mermaid.append(f"    style {node_id} fill:{color},stroke:#333,stroke-width:2px")
        mermaid.append(f"    click {node_id} \"#{node_id}\" \"{safe_tooltip}\"")

    # QA / Sandbox subgraph
    mermaid.append("    subgraph QA_LAYER[\"🧪 QA / Sandbox Layer\"]")
    mermaid.append(f'      QA["Dev/QA Sandbox — {len(companies)} companies"]')
    mermaid.append("    end")
    mermaid.append("    QA --> DEPLOY")
    mermaid.append('    DEPLOY["🚀 Deploy / Monitor"]')

    # Batch simulation overlay legend
    mermaid.append("    classDef prio fill:#fff,stroke:#333,stroke-width:1px")
    mermaid.append(f"    classDef critical fill:{PRIORITY_COLORS['critical']},stroke:#b71c1c,stroke-width:2px")
    mermaid.append(f"    classDef high fill:{PRIORITY_COLORS['high']},stroke:#e65100,stroke-width:2px")
    mermaid.append(f"    classDef medium fill:{PRIORITY_COLORS['medium']},stroke:#f9a825,stroke-width:2px")
    mermaid.append(f"    classDef normal fill:{PRIORITY_COLORS['normal']},stroke:#33691e,stroke-width:2px")
    mermaid.append(f"    classDef low fill:{PRIORITY_COLORS['low']},stroke:#1b5e20,stroke-width:2px")

    return "\n".join(mermaid)


def _build_batch_overview(sim_report):
    """Build multi-batch simulation overlay summary cards."""
    html = '<div class="batch-grid">'
    for b in sorted(sim_report, key=lambda x: x["batch_id"]):
        risk  = b.get("risk_score", 0)
        rcls  = "batch-danger" if risk >= 70 else "batch-warn" if risk >= 40 else "batch-safe"
        html += f"""
        <div class="batch-card {rcls}">
          <h4>Batch {b['batch_id']}</h4>
          <div class="batch-stat">
            <label>Tasks</label><span>{b['total_tasks']}</span>
          </div>
          <div class="batch-stat">
            <label>Workers</label><span>{b['active_workers']}</span>
          </div>
          <div class="batch-stat">
            <label>QA Fail%</label>
            <span>{b['predicted_qa_fail_rate']:.1%}</span>
          </div>
          <div class="batch-stat">
            <label>Rollback%</label>
            <span>{b['predicted_rollback_rate']:.1%}</span>
          </div>
          <div class="batch-stat">
            <label>SLA Breach%</label>
            <span>{b['predicted_sla_breach']:.1f}%</span>
          </div>
          <div class="batch-risk-bar">
            <div class="batch-risk-fill" style="width:{risk}%;"></div>
          </div>
          <span class="batch-risk-label">Risk: {risk:.1f}</span>
        </div>
        """
    html += "</div>"
    return html


def _build_analytics_panel(analytics):
    """Build an analytics summary panel."""
    html = '<div class="analytics-grid">'

    def stat_card(title, value, subtitle="", color="#1976d2"):
        return f"""
        <div class="stat-card" style="border-left:4px solid {color};">
          <div class="stat-title">{title}</div>
          <div class="stat-value">{value}</div>
          <div class="stat-sub">{subtitle}</div>
        </div>
        """

    if isinstance(analytics, dict):
        html += stat_card(
            "Total Executions",
            analytics.get("total_executions", "N/A"),
            analytics.get("period", ""),
            "#1565c0"
        )
        html += stat_card(
            "Success Rate",
            analytics.get("success_rate", "N/A"),
            "",
            "#2e7d32"
        )
        html += stat_card(
            "Avg Duration (s)",
            analytics.get("avg_duration_sec", "N/A"),
            "",
            "#6a1b9a"
        )
        html += stat_card(
            "Companies",
            analytics.get("num_companies", "N/A"),
            "",
            "#e65100"
        )
    else:
        html += stat_card("Analytics", "No data", "analytics.json empty", "#9e9e9e")

    html += "</div>"
    return html


def generate_dashboard(exec_data, analytics, sim_report):
    """Generate the complete HTML dashboard."""

    # Collect companies & batch info
    companies = sorted(set(t["company"] for t in exec_data))
    num_companies = len(companies)
    total_tasks = len(exec_data)

    # Compute global stats
    high_prio_total = sum(1 for t in exec_data if t["priority"].lower() in ("critical", "high"))
    qa_fail_total   = sum(1 for t in exec_data if t["qa_status"] == "QA_FAIL")
    rollback_total  = sum(1 for t in exec_data if t["dev_status"] == "DEV_FAILED")
    sla_breach_total= sum(1 for t in exec_data if t.get("sla_remaining", 100) < 10)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Digital Twin Final — Full Autonomous Corporate Agent v2.0</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
<style>
:root {{
  --bg:        #0d1117;
  --surface:   #161b22;
  --border:    #30363d;
  --text:      #c9d1d9;
  --text-dim:  #8b949e;
  --accent:    #58a6ff;
  --danger:    #ff1744;
  --warn:      #ff6d00;
  --safe:      #00e676;
}}

* {{ box-sizing: border-box; margin: 0; padding: 0; }}

body {{
  font-family: 'Segoe UI', 'SF Pro Display', -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
}}

h1, h2, h3, h4 {{ color: #f0f6fc; margin-bottom: 0.5em; }}
h1 {{ font-size: 1.6em; border-bottom: 2px solid var(--accent); padding-bottom: 0.3em; }}
h2 {{ font-size: 1.2em; margin-top: 1.5em; color: var(--accent); }}

.header-bar {{
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 12px 24px;
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}}
.header-badge {{
  background: {PRIORITY_COLORS['critical']}22;
  border: 1px solid {PRIORITY_COLORS['critical']};
  color: {PRIORITY_COLORS['critical']};
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
}}
.header-stat {{
  display: flex;
  flex-direction: column;
  align-items: center;
}}
.header-stat .val {{ font-size: 18px; font-weight: 700; color: var(--accent); }}
.header-stat .lbl {{ font-size: 11px; color: var(--text-dim); text-transform: uppercase; }}

.container {{ max-width: 1600px; margin: 0 auto; padding: 16px 24px; }}

/* ── KPI Table ── */
#kpi-table {{
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-top: 0.5em;
}}
#kpi-table thead th {{
  background: var(--surface);
  color: var(--text-dim);
  font-weight: 600;
  padding: 8px 6px;
  border-bottom: 2px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.05em;
}}
#kpi-table tbody tr {{
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}}
#kpi-table tbody tr:hover {{
  background: #1f2937;
  cursor: pointer;
}}
#kpi-table td {{
  padding: 6px 6px;
  text-align: center;
}}

/* Risk classes */
.risk-safe   {{ background: {RISK_GRADIENT['safe']};   color: #1b5e20; font-weight: 600; }}
.risk-warn   {{ background: {RISK_GRADIENT['warn']};   color: #5d4037; font-weight: 600; }}
.risk-alert  {{ background: {RISK_GRADIENT['alert']};  color: #bf360c; font-weight: 600; }}
.risk-danger {{ background: {RISK_GRADIENT['danger']}; color: #b71c1c; font-weight: 700; }}

/* Priority row highlight */
.prio-critical td {{ background: {PRIORITY_COLORS['critical']}18 !important; }}
.prio-high     td {{ background: {PRIORITY_COLORS['high']}12 !important; }}
.prio-medium   td {{ background: {PRIORITY_COLORS['medium']}10 !important; }}

.prio-critical {{
  color: {PRIORITY_COLORS['critical']};
  font-weight: 700;
}}
.prio-high     {{ color: {PRIORITY_COLORS['high']};     font-weight: 600; }}

/* Risk bar */
.risk-bar-container {{
  background: #21262d;
  border-radius: 4px;
  height: 16px;
  position: relative;
  overflow: hidden;
  width: 80px;
  margin: 0 auto;
}}
.risk-bar {{
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s;
}}
.bar-safe   {{ background: linear-gradient(90deg, #00e676, #69f0ae); }}
.bar-warn   {{ background: linear-gradient(90deg, #ff6d00, #ff9e80); }}
.bar-danger {{ background: linear-gradient(90deg, #ff1744, #ff8a80); }}
.risk-label {{
  position: absolute;
  right: 4px;
  top: 0;
  line-height: 16px;
  font-size: 10px;
  color: #fff;
  font-weight: 700;
  text-shadow: 0 0 2px #000;
}}

/* ── Batch cards ── */
.batch-grid {{
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-top: 0.5em;
}}
.batch-card {{
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  transition: transform 0.2s;
}}
.batch-card:hover {{ transform: translateY(-2px); }}
.batch-card h4 {{ color: var(--accent); margin-bottom: 8px; font-size: 13px; }}
.batch-stat {{
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 2px 0;
  border-bottom: 1px solid var(--border);
}}
.batch-stat label {{ color: var(--text-dim); }}
.batch-stat span  {{ font-weight: 600; }}
.batch-safe   .batch-stat span {{ color: var(--safe); }}
.batch-warn   .batch-stat span {{ color: var(--warn); }}
.batch-danger .batch-stat span {{ color: var(--danger); }}

.batch-risk-bar {{
  background: #21262d;
  border-radius: 4px;
  height: 8px;
  margin-top: 8px;
  overflow: hidden;
}}
.batch-risk-fill {{
  height: 100%;
  border-radius: 4px;
  background: var(--safe);
  transition: width 0.5s;
}}
.batch-safe   .batch-risk-fill {{ background: var(--safe); }}
.batch-warn   .batch-risk-fill {{ background: var(--warn); }}
.batch-danger .batch-risk-fill {{ background: var(--danger); }}
.batch-risk-label {{
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 4px;
  display: block;
}}

/* ── Analytics grid ── */
.analytics-grid {{
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 0.5em;
}}
.stat-card {{
  background: var(--surface);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}}
.stat-title  {{ font-size: 11px; text-transform: uppercase; color: var(--text-dim); letter-spacing: 0.05em; }}
.stat-value  {{ font-size: 28px; font-weight: 800; color: var(--accent); margin: 4px 0; }}
.stat-sub    {{ font-size: 11px; color: var(--text-dim); }}

/* ── Mermaid chart ── */
.mermaid {{
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
  margin-top: 0.5em;
}}

/* ── Legend ── */
.legend {{
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 0.5em;
  font-size: 12px;
  align-items: center;
}}
.legend-item {{
  display: flex;
  align-items: center;
  gap: 6px;
}}
.legend-swatch {{
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid #333;
}}

/* ── Footer ── */
.footer {{
  text-align: center;
  color: var(--text-dim);
  font-size: 12px;
  padding: 24px;
  border-top: 1px solid var(--border);
  margin-top: 32px;
}}

/* ── Scrollable table wrapper ── */
.table-scroll {{
  max-height: 480px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
}}
.table-scroll::-webkit-scrollbar {{ width: 6px; }}
.table-scroll::-webkit-scrollbar-thumb {{ background: var(--border); border-radius: 3px; }}
</style>
</head>
<body>

<!-- Header Bar -->
<div class="header-bar">
  <h1 style="margin:0; border:none; padding:0;">🏢 Digital Twin Final — Corporate Agent v2.0</h1>
  <span class="header-badge">⚡ {NUM_COMPANIES}+ Companies</span>
  <span class="header-badge">👷 {WORKER_POOL} Workers</span>
  <div class="header-stat">
    <span class="val">{num_companies}</span>
    <span class="lbl">Companies</span>
  </div>
  <div class="header-stat">
    <span class="val">{total_tasks}</span>
    <span class="lbl">Total Tasks</span>
  </div>
  <div class="header-stat">
    <span class="val" style="color:{PRIORITY_COLORS['critical']};">{high_prio_total}</span>
    <span class="lbl">High Priority</span>
  </div>
  <div class="header-stat">
    <span class="val" style="color:{PRIORITY_COLORS['critical']};">{qa_fail_total}</span>
    <span class="lbl">QA Fail</span>
  </div>
  <div class="header-stat">
    <span class="val" style="color:{PRIORITY_COLORS['high']};">{rollback_total}</span>
    <span class="lbl">Rollback</span>
  </div>
  <div class="header-stat">
    <span class="val">{datetime.now().strftime('%Y-%m-%d %H:%M')}</span>
    <span class="lbl">Generated</span>
  </div>
</div>

<div class="container">

  <!-- Analytics Panel -->
  <h2>📈 Analytics Overview</h2>
  {_build_analytics_panel(analytics)}

  <!-- Multi-Batch Simulation Overlay -->
  <h2>🔄 Multi-Batch Simulation Overlay ({len(sim_report)} Batches)</h2>
  {_build_batch_overview(sim_report)}

  <!-- Priority + Risk Color Legend -->
  <div class="legend">
    <span style="color:var(--text-dim); font-weight:600;">Priority:</span>
    <div class="legend-item">
      <div class="legend-swatch" style="background:{PRIORITY_COLORS['critical']};"></div>
      <span>Critical</span>
    </div>
    <div class="legend-item">
      <div class="legend-swatch" style="background:{PRIORITY_COLORS['high']};"></div>
      <span>High</span>
    </div>
    <div class="legend-item">
      <div class="legend-swatch" style="background:{PRIORITY_COLORS['medium']};"></div>
      <span>Medium</span>
    </div>
    <div class="legend-item">
      <div class="legend-swatch" style="background:{PRIORITY_COLORS['normal']};"></div>
      <span>Normal</span>
    </div>
    <div class="legend-item">
      <div class="legend-swatch" style="background:{PRIORITY_COLORS['low']};"></div>
      <span>Low</span>
    </div>
    <span style="color:var(--text-dim); font-weight:600; margin-left:8px;">Risk:</span>
    <div class="legend-item">
      <div class="legend-swatch" style="background:{RISK_GRADIENT['safe']};"></div>
      <span>Safe</span>
    </div>
    <div class="legend-item">
      <div class="legend-swatch" style="background:{RISK_GRADIENT['warn']};"></div>
      <span>Warning</span>
    </div>
    <div class="legend-item">
      <div class="legend-swatch" style="background:{RISK_GRADIENT['alert']};"></div>
      <span>Alert</span>
    </div>
    <div class="legend-item">
      <div class="legend-swatch" style="background:{RISK_GRADIENT['danger']};"></div>
      <span>Danger</span>
    </div>
  </div>

  <!-- KPI Summary Table -->
  <h2>📋 KPI Summary Table — {num_companies} Companies</h2>
  <div class="table-scroll">
    {_build_kpi_table(exec_data)}
  </div>

  <!-- Interactive Mermaid Flow -->
  <h2>🔀 Task Flow & Worker Allocation (Mermaid + Tooltip)</h2>
  <div style="color:var(--text-dim); font-size:12px; margin-bottom:8px;">
    Hover over company nodes for task details. Color reflects high-priority ratio.
  </div>
  <div class="mermaid">
{_build_mermaid_flow(exec_data, sim_report)}
  </div>

</div>

<footer class="footer">
  Full Autonomous Corporate Agent v2.0 — Digital Twin Final<br>
  Powered by execution_summary.json · simulation_report.json · analytics.json<br>
  Worker Pool: {WORKER_POOL} | Companies: {num_companies} | Tasks: {total_tasks} | {datetime.now().isoformat()}
</footer>

<script>
mermaid.initialize({{
  startOnLoad: true,
  theme: 'dark',
  flowchart: {{ curve: 'basis', padding: 20 }},
  securityLevel: 'loose'
}});
</script>

</body>
</html>"""

    return html


def main():
    print("=" * 60)
    print("  Digital Twin Final — Dashboard Generator v2.0")
    print("=" * 60)

    exec_data, analytics, sim_report = load_data()
    html_content = generate_dashboard(exec_data, analytics, sim_report)

    DASHBOARD_HTML.parent.mkdir(parents=True, exist_ok=True)
    with open(DASHBOARD_HTML, "w", encoding="utf-8") as f:
        f.write(html_content)

    size_kb = len(html_content) / 1024
    companies = sorted(set(t["company"] for t in exec_data))

    print(f"\n✅ Dashboard generated: {DASHBOARD_HTML}")
    print(f"   Size: {size_kb:.1f} KB")
    print(f"   Companies: {len(companies)}")
    print(f"   Total Tasks: {len(exec_data)}")
    print(f"   Batches: {len(sim_report)}")
    print(f"   Worker Pool: {WORKER_POOL}")
    print("\nOpen in browser: ")
    print(f"   file://{DASHBOARD_HTML.resolve()}")


if __name__ == "__main__":
    main()
