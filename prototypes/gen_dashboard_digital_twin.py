#!/usr/bin/env python3
"""
Digital Twin Interactive Dashboard Generator
============================================
Full Autonomous Corporate Agent v2.0 - Advanced Visualization
Generates interactive HTML dashboard with tooltips, batch simulation overlay,
and scenario visualization for 100+ companies, 512 workers, and task prioritization.
"""

import json
import math
import random
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from collections import defaultdict
import hashlib

# Configuration
BASE_PATH = Path(".super-agent-fullauto-kpi")
NUM_COMPANIES = 100
NUM_WORKERS = 512
PRIORITIES = ["Critical", "High", "Medium", "Normal", "Low"]
TASK_TYPES = ["bug", "payment", "hotfix", "audit", "report", "feature", "generic"]

# File paths
EXECUTION_SUMMARY = BASE_PATH / "execution_summary.json"
ANALYTICS = BASE_PATH / "analytics.json"
SIMULATION_REPORT = BASE_PATH / "simulation_report.json"
AUTONOMOUS_PLAN = BASE_PATH / "autonomous_plan.json"
RISK_REPORT = BASE_PATH / "risk_report.json"
SLA_PREDICTION = BASE_PATH / "sla_prediction.json"
COMPANY_SCORES = BASE_PATH / "company_scores.json"
DECISION_LOG = BASE_PATH / "decision_log.json"
DASHBOARD_HTML = BASE_PATH / "dashboard_digital_twin.html"

def load_json(path: Path, default: Any = None) -> Any:
    """Load JSON file with fallback to default."""
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except:
        return default if default is not None else []

def save_json(path: Path, data: Any):
    """Save data to JSON file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, default=str)

def generate_sample_data():
    """Generate realistic sample data for demonstration."""
    print("Generating sample data for Digital Twin Dashboard...")
    
    companies = [f"Company_{i}" for i in range(1, NUM_COMPANIES + 1)]
    
    # Generate company scores
    company_scores = {}
    for company in companies:
        company_scores[company] = {
            "company": company,
            "qa_fail_rate": random.uniform(0.02, 0.35),
            "rollback_rate": random.uniform(0.01, 0.20),
            "task_count": random.randint(10, 150),
            "avg_completion_time": random.uniform(300, 3600),
            "risk_score": random.uniform(0.1, 0.8),
            "last_updated": datetime.now().isoformat()
        }
    save_json(COMPANY_SCORES, company_scores)
    
    # Generate execution summary
    execution_summary = []
    task_types = TASK_TYPES
    for i in range(500):
        company = random.choice(companies)
        priority = random.choices(
            ["critical", "high", "medium", "normal", "low"],
            weights=[0.1, 0.2, 0.3, 0.3, 0.1]
        )[0]
        task_type = random.choice(task_types)
        
        # Simulate realistic outcomes
        qa_fail = random.random() < company_scores[company]["qa_fail_rate"]
        dev_fail = random.random() < company_scores[company]["rollback_rate"]
        
        execution_summary.append({
            "task_id": f"TASK-{hashlib.md5(str(i).encode()).hexdigest()[:8].upper()}",
            "company": company,
            "task_type": task_type,
            "priority": priority,
            "dev_status": "DEV_FAILED" if dev_fail else "DEV_DONE",
            "qa_status": "QA_FAIL" if qa_fail else "QA_DONE",
            "allocated_workers": random.randint(1, 8) if priority in ["critical", "high"] else random.randint(1, 3),
            "predicted_risk": random.uniform(0.05, 0.7),
            "sla_deadline": (datetime.now() + timedelta(hours=random.randint(1, 48))).isoformat(),
            "created_at": (datetime.now() - timedelta(hours=random.randint(1, 72))).isoformat(),
            "timestamp": datetime.now().isoformat(),
            "outcome": "SUCCESS" if not qa_fail and not dev_fail else "FAILED"
        })
    save_json(EXECUTION_SUMMARY, execution_summary)
    
    # Generate simulation report
    simulation_report = []
    current_load = 0
    for task in execution_summary[:100]:
        workers = task["allocated_workers"]
        current_load += workers
        bottleneck_prob = max(0, (current_load - NUM_WORKERS * 0.8) / (NUM_WORKERS * 0.2)) if current_load > NUM_WORKERS * 0.8 else 0
        simulation_report.append({
            "task_id": task["task_id"],
            "company": task["company"],
            "priority": task["priority"],
            "predicted_risk": task["predicted_risk"],
            "allocated_workers": workers,
            "bottleneck_probability": min(bottleneck_prob, 1.0),
            "risk_factors": [
                f"qa_fail_rate={company_scores[task['company']]['qa_fail_rate']:.2f}",
                f"rollback_rate={company_scores[task['company']]['rollback_rate']:.2f}"
            ],
            "timestamp": task["timestamp"]
        })
    save_json(SIMULATION_REPORT, simulation_report)
    
    # Generate SLA predictions
    sla_predictions = []
    for task in execution_summary[:100]:
        base_prob = company_scores[task["company"]]["qa_fail_rate"]
        if task["priority"] in ["critical", "high"]:
            base_prob *= 1.2
        base_prob = min(base_prob + task["predicted_risk"] * 0.3, 1.0)
        sla_predictions.append({
            "task_id": task["task_id"],
            "company": task["company"],
            "sla_violation_probability": base_prob,
            "predicted_outcome": "AT_RISK" if base_prob > 0.3 else "ON_TRACK",
            "recommended_workers": min(task["allocated_workers"] + 2, NUM_WORKERS) if base_prob > 0.3 else task["allocated_workers"]
        })
    save_json(SLA_PREDICTION, sla_predictions)
    
    print(f"Generated data: {len(execution_summary)} tasks, {len(companies)} companies")
    return execution_summary, company_scores, simulation_report, sla_predictions

def calculate_company_kpis(exec_data: List[Dict]) -> Dict[str, Dict]:
    """Calculate KPIs per company."""
    company_kpis = {}
    companies = sorted(set(t["company"] for t in exec_data))
    
    for company in companies:
        tasks = [t for t in exec_data if t["company"] == company]
        total = len(tasks)
        if total == 0:
            continue
            
        qa_fail = sum(1 for t in tasks if t["qa_status"] == "QA_FAIL")
        dev_fail = sum(1 for t in tasks if t["dev_status"] == "DEV_FAILED")
        success = sum(1 for t in tasks if t["outcome"] == "SUCCESS")
        high_prio = sum(1 for t in tasks if t["priority"] in ["critical", "high"])
        critical = sum(1 for t in tasks if t["priority"] == "critical")
        avg_workers = sum(t["allocated_workers"] for t in tasks) / total
        avg_risk = sum(t["predicted_risk"] for t in tasks) / total
        
        company_kpis[company] = {
            "company": company,
            "total_tasks": total,
            "qa_fail_rate": qa_fail / total if total > 0 else 0,
            "rollback_rate": dev_fail / total if total > 0 else 0,
            "success_rate": success / total if total > 0 else 1.0,
            "high_priority": high_prio,
            "critical_tasks": critical,
            "avg_workers": avg_workers,
            "avg_risk": avg_risk,
            "risk_level": "HIGH" if avg_risk > 0.5 else "MEDIUM" if avg_risk > 0.3 else "LOW"
        }
    
    return company_kpis

def get_risk_color(risk: float) -> str:
    """Get color based on risk level."""
    if risk > 0.5:
        return "#f87171"  # red
    elif risk > 0.3:
        return "#fbbf24"  # amber
    else:
        return "#4ade80"  # green

def get_heatmap_color(rate: float, threshold: float = 0.2) -> str:
    """Get heatmap color based on rate."""
    intensity = min(rate / (threshold * 2), 1.0)
    if intensity < 0.33:
        return "#fef3c7"  # yellow-light
    elif intensity < 0.66:
        return "#fed7aa"  # orange-light
    else:
        return "#fecaca"  # red-light

def generate_tooltip_content(company: str, kpi: Dict, tasks: List[Dict]) -> str:
    """Generate HTML tooltip content for a company node."""
    company_tasks = [t for t in tasks if t["company"] == company]
    
    tooltip = f"""
    <div class="tooltip-content">
        <h4>{company}</h4>
        <div class="tooltip-stats">
            <div class="tooltip-row">
                <span class="label">Total Tasks:</span>
                <span class="value">{kpi.get('total_tasks', 0)}</span>
            </div>
            <div class="tooltip-row">
                <span class="label">QA Fail Rate:</span>
                <span class="value" style="color:{get_risk_color(kpi.get('qa_fail_rate', 0))}">{kpi.get('qa_fail_rate', 0)*100:.1f}%</span>
            </div>
            <div class="tooltip-row">
                <span class="label">Rollback Rate:</span>
                <span class="value" style="color:{get_risk_color(kpi.get('rollback_rate', 0))}">{kpi.get('rollback_rate', 0)*100:.1f}%</span>
            </div>
            <div class="tooltip-row">
                <span class="label">Success Rate:</span>
                <span class="value" style="color:{get_risk_color(1 - kpi.get('success_rate', 1))}">{kpi.get('success_rate', 1)*100:.1f}%</span>
            </div>
            <div class="tooltip-row">
                <span class="label">High Priority:</span>
                <span class="value">{kpi.get('high_priority', 0)}</span>
            </div>
            <div class="tooltip-row">
                <span class="label">Critical Tasks:</span>
                <span class="value" style="color:#f87171">{kpi.get('critical_tasks', 0)}</span>
            </div>
            <div class="tooltip-row">
                <span class="label">Avg Workers:</span>
                <span class="value">{kpi.get('avg_workers', 0):.1f}</span>
            </div>
            <div class="tooltip-row">
                <span class="label">Risk Level:</span>
                <span class="value badge badge-{kpi.get('risk_level', 'LOW').lower()}">{kpi.get('risk_level', 'LOW')}</span>
            </div>
        </div>
        <div class="tooltip-progress">
            <div class="progress-bar">
                <div class="progress-fill" style="width:{kpi.get('success_rate', 1)*100}%; background-color:{get_risk_color(1-kpi.get('success_rate', 1))}"></div>
            </div>
            <span>Success Rate</span>
        </div>
    </div>
    """
    return tooltip

def generate_mermaid_flow(companies: List[str], company_kpis: Dict, exec_data: List[Dict], simulation: List[Dict]) -> str:
    """Generate Mermaid flowchart with interactive nodes."""
    mermaid = ["flowchart TD"]
    
    # Add input and decision nodes
    mermaid.append('    A["📥 Task Input\\n(DB / Telegram / CLI)"]')
    mermaid.append('    B["🔮 Decision Engine\\nAI-Powered Routing"]')
    mermaid.append('    C["⚡ Predictive Priority\\n& Company Assignment"]')
    mermaid.append('    D["👥 Dynamic Worker Allocation\\n(Max 512 Workers)"]')
    mermaid.append('    E["🔧 Dev Sandbox\\nParallel Execution"]')
    mermaid.append('    F["✅ QA Validation\\nAutomated Testing"]')
    mermaid.append('    G["📊 Monitoring\\nReal-time KPIs"]')
    
    # Connect main flow
    mermaid.append('    A --> B --> C --> D')
    mermaid.append('    D --> E --> F --> G')
    
    # Group companies by risk level for visual clustering
    high_risk = [c for c in companies if company_kpis.get(c, {}).get('risk_level') == 'HIGH']
    medium_risk = [c for c in companies if company_kpis.get(c, {}).get('risk_level') == 'MEDIUM']
    low_risk = [c for c in companies if company_kpis.get(c, {}).get('risk_level') == 'LOW']
    
    # Create subgraph for high-risk companies (red theme)
    if high_risk:
        mermaid.append('    subgraph HIGH_RISK [🔴 High Risk Companies]')
        for c in high_risk[:10]:  # Limit to 10 for readability
            kpi = company_kpis.get(c, {})
            workers = kpi.get('avg_workers', 1)
            risk = kpi.get('avg_risk', 0.5)
            tasks_count = kpi.get('total_tasks', 0)
            mermaid.append(f'    {c.replace("-", "_").replace(" ", "_")}["{c}\\n📋 {tasks_count} tasks\\n👥 {workers:.0f} workers\\n⚠️ Risk: {risk:.1%}"]')
        mermaid.append('    end')
        mermaid.append('    D --> HIGH_RISK')
        mermaid.append('    HIGH_RISK --> E')
    
    # Create subgraph for medium-risk companies (yellow theme)
    if medium_risk:
        mermaid.append('    subgraph MEDIUM_RISK [🟡 Medium Risk Companies]')
        for c in medium_risk[:10]:
            kpi = company_kpis.get(c, {})
            workers = kpi.get('avg_workers', 1)
            risk = kpi.get('avg_risk', 0.3)
            tasks_count = kpi.get('total_tasks', 0)
            mermaid.append(f'    {c.replace("-", "_").replace(" ", "_")}["{c}\\n📋 {tasks_count} tasks\\n👥 {workers:.0f} workers\\n⚡ Risk: {risk:.1%}"]')
        mermaid.append('    end')
        mermaid.append('    D --> MEDIUM_RISK')
        mermaid.append('    MEDIUM_RISK --> E')
    
    # Create subgraph for low-risk companies (green theme)
    if low_risk:
        mermaid.append('    subgraph LOW_RISK [🟢 Low Risk Companies]')
        for c in low_risk[:10]:
            kpi = company_kpis.get(c, {})
            workers = kpi.get('avg_workers', 1)
            risk = kpi.get('avg_risk', 0.1)
            tasks_count = kpi.get('total_tasks', 0)
            mermaid.append(f'    {c.replace("-", "_").replace(" ", "_")}["{c}\\n📋 {tasks_count} tasks\\n👥 {workers:.0f} workers\\n✅ Risk: {risk:.1%}"]')
        mermaid.append('    end')
        mermaid.append('    D --> LOW_RISK')
        mermaid.append('    LOW_RISK --> E')
    
    # Add style classes
    mermaid.append('    classDef high-risk fill:#fecaca,stroke:#ef4444,stroke-width:2px')
    mermaid.append('    classDef medium-risk fill:#fef3c7,stroke:#f59e0b,stroke-width:2px')
    mermaid.append('    classDef low-risk fill:#dcfce7,stroke:#22c55e,stroke-width:2px')
    mermaid.append('    classDef input-node fill:#dbeafe,stroke:#3b82f6,stroke-width:3px')
    mermaid.append('    classDef process-node fill:#e0e7ff,stroke:#6366f1,stroke-width:2px')
    
    mermaid.append('    class A input-node')
    mermaid.append('    class B,C,D,E,F,G process-node')
    
    for c in high_risk[:10]:
        mermaid.append(f'    class {c.replace("-", "_").replace(" ", "_")} high-risk')
    for c in medium_risk[:10]:
        mermaid.append(f'    class {c.replace("-", "_").replace(" ", "_")} medium-risk')
    for c in low_risk[:10]:
        mermaid.append(f'    class {c.replace("-", "_").replace(" ", "_")} low-risk')
    
    return "\n".join(mermaid)

def generate_batch_simulation_overlay(simulation: List[Dict], company_kpis: Dict) -> str:
    """Generate batch simulation overlay data for interactive visualization."""
    batches = []
    current_batch = {"batch_id": 1, "tasks": [], "total_workers": 0, "risk_score": 0}
    
    for sim in simulation[:50]:  # First 50 tasks for batch simulation
        if current_batch["total_workers"] + sim["allocated_workers"] > 64:  # Batch size limit
            current_batch["avg_risk"] = sum(t["predicted_risk"] for t in current_batch["tasks"]) / len(current_batch["tasks"])
            batches.append(current_batch)
            current_batch = {"batch_id": current_batch["batch_id"] + 1, "tasks": [], "total_workers": 0, "risk_score": 0}
        
        current_batch["tasks"].append(sim)
        current_batch["total_workers"] += sim["allocated_workers"]
    
    if current_batch["tasks"]:
        current_batch["avg_risk"] = sum(t["predicted_risk"] for t in current_batch["tasks"]) / len(current_batch["tasks"])
        batches.append(current_batch)
    
    # Generate batch visualization HTML
    batch_html = '<div class="batch-simulation">'
    batch_html += '<h3>📦 Batch Simulation Overlay</h3>'
    batch_html += '<div class="batch-timeline">'
    
    for batch in batches:
        risk_color = get_risk_color(batch["avg_risk"])
        batch_html += f'''
        <div class="batch-item" onclick="showBatchDetail({batch['batch_id']})">
            <div class="batch-header">
                <span class="batch-id">Batch #{batch['batch_id']}</span>
                <span class="batch-workers">{batch['total_workers']} workers</span>
            </div>
            <div class="batch-progress" style="background: linear-gradient(90deg, {risk_color} {batch['avg_risk']*100}%, #334155 {batch['avg_risk']*100}%)"></div>
            <div class="batch-tasks">{len(batch['tasks'])} tasks</div>
            <div class="batch-risk" style="color:{risk_color}">Risk: {batch['avg_risk']:.1%}</div>
        </div>
        '''
    
    batch_html += '</div>'
    batch_html += '<div id="batch-detail" class="batch-detail"></div>'
    batch_html += '</div>'
    
    return batch_html, batches

def generate_kpi_summary(exec_data: List[Dict], company_kpis: Dict) -> Dict:
    """Generate overall KPI summary."""
    total_tasks = len(exec_data)
    qa_fail = sum(1 for t in exec_data if t["qa_status"] == "QA_FAIL")
    dev_fail = sum(1 for t in exec_data if t["dev_status"] == "DEV_FAILED")
    success = sum(1 for t in exec_data if t["outcome"] == "SUCCESS")
    high_prio = sum(1 for t in exec_data if t["priority"] in ["critical", "high"])
    
    total_workers_used = sum(t["allocated_workers"] for t in exec_data)
    avg_workers_per_task = total_workers_used / total_tasks if total_tasks > 0 else 0
    avg_risk = sum(t["predicted_risk"] for t in exec_data) / total_tasks if total_tasks > 0 else 0
    
    # Worker utilization
    worker_utilization = (total_workers_used / (NUM_WORKERS * 10)) * 100  # Simplified calculation
    
    return {
        "total_tasks": total_tasks,
        "qa_fail_rate": qa_fail / total_tasks if total_tasks > 0 else 0,
        "rollback_rate": dev_fail / total_tasks if total_tasks > 0 else 0,
        "success_rate": success / total_tasks if total_tasks > 0 else 1.0,
        "high_priority_tasks": high_prio,
        "total_workers": NUM_WORKERS,
        "workers_used": total_workers_used,
        "worker_utilization": min(worker_utilization, 100),
        "avg_workers_per_task": avg_workers_per_task,
        "avg_risk": avg_risk,
        "num_companies": len(company_kpis),
        "high_risk_companies": sum(1 for k in company_kpis.values() if k["risk_level"] == "HIGH"),
        "bottleneck_probability": max(0, (avg_workers_per_task * total_tasks / NUM_WORKERS - 0.8) / 0.2) if avg_workers_per_task > 0 else 0
    }

def generate_dashboard_html(exec_data: List[Dict], company_kpis: Dict, simulation: List[Dict], sla_predictions: List[Dict]) -> str:
    """Generate complete Digital Twin Dashboard HTML."""
    
    companies = sorted(company_kpis.keys())
    kpi_summary = generate_kpi_summary(exec_data, company_kpis)
    mermaid_flow = generate_mermaid_flow(companies, company_kpis, exec_data, simulation)
    batch_html, batches = generate_batch_simulation_overlay(simulation, company_kpis)
    
    # Generate scenario scenarios
    scenarios = [
        {"name": "Peak Load", "workers": 512, "success_rate": 0.85, "description": "Maximum worker capacity"},
        {"name": "High Risk", "workers": 256, "success_rate": 0.72, "description": "50% high-risk tasks"},
        {"name": "Normal", "workers": 384, "success_rate": 0.91, "description": "Balanced workload"},
        {"name": "Low Load", "workers": 128, "success_rate": 0.96, "description": "Light workload"}
    ]
    
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Twin Dashboard - Full Autonomous Agent v2.0</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
            color: #e2e8f0;
            min-height: 100vh;
        }}
        
        .container {{
            max-width: 1800px;
            margin: 0 auto;
            padding: 20px;
        }}
        
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 0;
            border-bottom: 1px solid #334155;
            margin-bottom: 30px;
        }}
        
        .header h1 {{
            color: #60a5fa;
            font-size: 28px;
            font-weight: 700;
        }}
        
        .header .subtitle {{
            color: #94a3b8;
            font-size: 14px;
            margin-top: 4px;
        }}
        
        .timestamp {{
            color: #64748b;
            font-size: 14px;
            text-align: right;
        }}
        
        /* KPI Cards Grid */
        .kpi-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        
        .kpi-card {{
            background: linear-gradient(145deg, #1e293b, #0f172a);
            border-radius: 16px;
            padding: 24px;
            border: 1px solid #334155;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }}
        
        .kpi-card::before {{
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6);
        }}
        
        .kpi-card:hover {{
            transform: translateY(-4px);
            border-color: #3b82f6;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }}
        
        .kpi-label {{
            color: #94a3b8;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }}
        
        .kpi-value {{
            font-size: 36px;
            font-weight: 700;
            color: #60a5fa;
            line-height: 1;
        }}
        
        .kpi-value.success {{ color: #4ade80; }}
        .kpi-value.warning {{ color: #fbbf24; }}
        .kpi-value.danger {{ color: #f87171; }}
        
        .kpi-subtext {{
            color: #64748b;
            font-size: 12px;
            margin-top: 8px;
        }}
        
        /* Main Content Grid */
        .main-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 30px;
        }}
        
        .card {{
            background: linear-gradient(145deg, #1e293b, #0f172a);
            border-radius: 16px;
            padding: 24px;
            border: 1px solid #334155;
        }}
        
        .card h2 {{
            color: #93c5fd;
            font-size: 18px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        
        /* Mermaid Chart */
        .mermaid {{
            background: #0f172a;
            border-radius: 12px;
            padding: 20px;
            overflow-x: auto;
        }}
        
        /* KPI Heatmap Table */
        .heatmap-table {{
            width: 100%;
            border-collapse: separate;
            border-spacing: 2px;
            font-size: 11px;
        }}
        
        .heatmap-table th {{
            background: #0f172a;
            color: #60a5fa;
            padding: 8px;
            text-align: center;
            font-weight: 600;
            position: sticky;
            top: 0;
        }}
        
        .heatmap-table td {{
            padding: 6px;
            text-align: center;
            border-radius: 4px;
            transition: all 0.2s ease;
            cursor: pointer;
        }}
        
        .heatmap-table td:hover {{
            transform: scale(1.1);
            z-index: 10;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }}
        
        .heat-cell {{
            min-width: 50px;
        }}
        
        /* Tooltip */
        .tooltip {{
            position: fixed;
            background: linear-gradient(145deg, #1e293b, #0f172a);
            border: 1px solid #3b82f6;
            border-radius: 12px;
            padding: 16px;
            max-width: 320px;
            z-index: 1000;
            display: none;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            pointer-events: none;
        }}
        
        .tooltip.visible {{
            display: block;
        }}
        
        .tooltip h4 {{
            color: #60a5fa;
            margin-bottom: 12px;
            font-size: 14px;
        }}
        
        .tooltip-row {{
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 12px;
        }}
        
        .tooltip-row .label {{
            color: #94a3b8;
        }}
        
        .tooltip-row .value {{
            color: #e2e8f0;
            font-weight: 600;
        }}
        
        .tooltip-progress {{
            margin-top: 12px;
        }}
        
        .progress-bar {{
            height: 6px;
            background: #334155;
            border-radius: 3px;
            overflow: hidden;
        }}
        
        .progress-fill {{
            height: 100%;
            border-radius: 3px;
            transition: width 0.3s ease;
        }}
        
        /* Batch Simulation */
        .batch-simulation {{
            margin-top: 20px;
        }}
        
        .batch-timeline {{
            display: flex;
            gap: 12px;
            overflow-x: auto;
            padding: 10px 0;
        }}
        
        .batch-item {{
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 12px;
            min-width: 140px;
            cursor: pointer;
            transition: all 0.2s ease;
        }}
        
        .batch-item:hover {{
            border-color: #3b82f6;
            background: #1e293b;
        }}
        
        .batch-header {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }}
        
        .batch-id {{
            color: #60a5fa;
            font-weight: 600;
            font-size: 12px;
        }}
        
        .batch-workers {{
            color: #94a3b8;
            font-size: 11px;
        }}
        
        .batch-progress {{
            height: 4px;
            border-radius: 2px;
            margin: 8px 0;
        }}
        
        .batch-tasks {{
            color: #64748b;
            font-size: 11px;
        }}
        
        .batch-risk {{
            font-size: 12px;
            font-weight: 600;
            margin-top: 4px;
        }}
        
        .batch-detail {{
            margin-top: 16px;
            padding: 16px;
            background: #0f172a;
            border-radius: 8px;
            display: none;
        }}
        
        .batch-detail.visible {{
            display: block;
        }}
        
        /* Scenario Simulation */
        .scenario-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
        }}
        
        .scenario-card {{
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 16px;
            cursor: pointer;
            transition: all 0.2s ease;
        }}
        
        .scenario-card:hover {{
            border-color: #8b5cf6;
            transform: translateY(-2px);
        }}
        
        .scenario-card.active {{
            border-color: #8b5cf6;
            background: linear-gradient(145deg, #1e1b4b, #0f172a);
        }}
        
        .scenario-name {{
            color: #a78bfa;
            font-weight: 600;
            margin-bottom: 8px;
        }}
        
        .scenario-desc {{
            color: #64748b;
            font-size: 12px;
            margin-bottom: 12px;
        }}
        
        .scenario-stats {{
            display: flex;
            justify-content: space-between;
        }}
        
        .scenario-stat {{
            text-align: center;
        }}
        
        .scenario-stat .value {{
            font-size: 18px;
            font-weight: 700;
        }}
        
        .scenario-stat .label {{
            font-size: 10px;
            color: #64748b;
        }}
        
        /* Risk Distribution Chart */
        .risk-chart {{
            display: flex;
            align-items: flex-end;
            height: 150px;
            gap: 8px;
            padding: 20px;
            background: #0f172a;
            border-radius: 8px;
        }}
        
        .risk-bar {{
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
        }}
        
        .risk-bar-fill {{
            width: 100%;
            border-radius: 4px 4px 0 0;
            transition: height 0.5s ease;
        }}
        
        .risk-bar-label {{
            font-size: 10px;
            color: #64748b;
        }}
        
        .risk-bar-value {{
            font-size: 12px;
            font-weight: 600;
        }}
        
        /* Worker Allocation Gauge */
        .gauge-container {{
            display: flex;
            justify-content: center;
            padding: 20px;
        }}
        
        .gauge {{
            position: relative;
            width: 200px;
            height: 100px;
            overflow: hidden;
        }}
        
        .gauge-bg {{
            position: absolute;
            width: 200px;
            height: 200px;
            border-radius: 50%;
            background: conic-gradient(
                from 180deg,
                #334155 0deg,
                #334155 180deg,
                transparent 180deg
            );
        }}
        
        .gauge-fill {{
            position: absolute;
            width: 200px;
            height: 200px;
            border-radius: 50%;
            background: conic-gradient(
                from 180deg,
                #3b82f6 0deg,
                #8b5cf6 var(--gauge-degree, 0deg),
                transparent var(--gauge-degree, 0deg)
            );
        }}
        
        .gauge-text {{
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
        }}
        
        .gauge-value {{
            font-size: 32px;
            font-weight: 700;
            color: #60a5fa;
        }}
        
        .gauge-label {{
            font-size: 12px;
            color: #64748b;
        }}
        
        /* Priority Distribution */
        .priority-list {{
            display: flex;
            flex-direction: column;
            gap: 12px;
        }}
        
        .priority-item {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        
        .priority-badge {{
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            min-width: 80px;
            text-align: center;
        }}
        
        .priority-badge.critical {{ background: #7f1d1d; color: #f87171; }}
        .priority-badge.high {{ background: #78350f; color: #fbbf24; }}
        .priority-badge.medium {{ background: #1e40af; color: #60a5fa; }}
        .priority-badge.normal {{ background: #334155; color: #94a3b8; }}
        .priority-badge.low {{ background: #1e293b; color: #64748b; }}
        
        .priority-bar {{
            flex: 1;
            height: 24px;
            background: #0f172a;
            border-radius: 4px;
            overflow: hidden;
        }}
        
        .priority-bar-fill {{
            height: 100%;
            border-radius: 4px;
            transition: width 0.5s ease;
        }}
        
        .priority-count {{
            min-width: 40px;
            text-align: right;
            color: #94a3b8;
        }}
        
        /* Badges */
        .badge {{
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            display: inline-block;
        }}
        
        .badge-high {{ background: #7f1d1d; color: #f87171; }}
        .badge-medium {{ background: #1e40af; color: #60a5fa; }}
        .badge-low {{ background: #065f46; color: #4ade80; }}
        
        /* Company List */
        .company-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 12px;
            max-height: 400px;
            overflow-y: auto;
        }}
        
        .company-item {{
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
        }}
        
        .company-item:hover {{
            border-color: #3b82f6;
            transform: translateY(-2px);
        }}
        
        .company-item.high-risk {{
            border-color: #f87171;
            background: linear-gradient(145deg, rgba(127, 29, 29, 0.3), #0f172a);
        }}
        
        .company-item.medium-risk {{
            border-color: #fbbf24;
            background: linear-gradient(145deg, rgba(120, 53, 15, 0.3), #0f172a);
        }}
        
        .company-name {{
            font-size: 12px;
            font-weight: 600;
            color: #e2e8f0;
            margin-bottom: 8px;
        }}
        
        .company-stats {{
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #64748b;
        }}
        
        /* Scrollbar styling */
        ::-webkit-scrollbar {{
            width: 8px;
            height: 8px;
        }}
        
        ::-webkit-scrollbar-track {{
            background: #0f172a;
        }}
        
        ::-webkit-scrollbar-thumb {{
            background: #334155;
            border-radius: 4px;
        }}
        
        ::-webkit-scrollbar-thumb:hover {{
            background: #475569;
        }}
        
        /* Responsive */
        @media (max-width: 1024px) {{
            .main-grid {{
                grid-template-columns: 1fr;
            }}
        }}
        
        @media (max-width: 768px) {{
            .kpi-grid {{
                grid-template-columns: repeat(2, 1fr);
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div>
                <h1>🎯 Digital Twin Dashboard</h1>
                <div class="subtitle">Full Autonomous Corporate Agent v2.0 - Interactive Visualization</div>
            </div>
            <div class="timestamp">
                <div>Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
                <div style="color: #4ade80;">● System Online</div>
            </div>
        </div>
        
        <!-- KPI Summary Cards -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Total Tasks</div>
                <div class="kpi-value">{kpi_summary['total_tasks']}</div>
                <div class="kpi-subtext">{len(companies)} companies monitored</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Success Rate</div>
                <div class="kpi-value success">{kpi_summary['success_rate']*100:.1f}%</div>
                <div class="kpi-subtext">Target: 90%</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">QA Fail Rate</div>
                <div class="kpi-value {'warning' if kpi_summary['qa_fail_rate'] > 0.1 else 'success'}">{kpi_summary['qa_fail_rate']*100:.1f}%</div>
                <div class="kpi-subtext">Threshold: 20%</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Worker Utilization</div>
                <div class="kpi-value">{kpi_summary['worker_utilization']:.1f}%</div>
                <div class="kpi-subtext">{kpi_summary['workers_used']} / {kpi_summary['total_workers']} workers</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">High Priority Tasks</div>
                <div class="kpi-value {'danger' if kpi_summary['high_priority_tasks'] > 50 else 'warning'}">{kpi_summary['high_priority_tasks']}</div>
                <div class="kpi-subtext">Critical + High priority</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Bottleneck Probability</div>
                <div class="kpi-value {'danger' if kpi_summary['bottleneck_probability'] > 0.3 else 'warning'}">{kpi_summary['bottleneck_probability']*100:.1f}%</div>
                <div class="kpi-subtext">Worker pool congestion</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">High Risk Companies</div>
                <div class="kpi-value {'danger' if kpi_summary['high_risk_companies'] > 10 else ''}">{kpi_summary['high_risk_companies']}</div>
                <div class="kpi-subtext">Risk score > 0.5</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Avg Risk Score</div>
                <div class="kpi-value {'warning' if kpi_summary['avg_risk'] > 0.3 else 'success'}">{kpi_summary['avg_risk']:.2f}</div>
                <div class="kpi-subtext">0.0 (low) - 1.0 (high)</div>
            </div>
        </div>
        
        <!-- Main Content Grid -->
        <div class="main-grid">
            <!-- Mermaid Flow Chart -->
            <div class="card">
                <h2>🔄 Task Flow & Worker Allocation</h2>
                <div class="mermaid">
{mermaid_flow}
                </div>
                {batch_html}
            </div>
            
            <!-- KPI Heatmap -->
            <div class="card">
                <h2>📊 Company KPI Heatmap</h2>
                <div style="max-height: 600px; overflow-y: auto;">
                    <table class="heatmap-table">
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th>Tasks</th>
                                <th>QA Fail</th>
                                <th>Rollback</th>
                                <th>High Prio</th>
                                <th>Risk</th>
                            </tr>
                        </thead>
                        <tbody>
'''
    
    # Add heatmap rows
    for company in sorted(companies)[:50]:  # Show first 50 companies
        kpi = company_kpis.get(company, {})
        total = kpi.get('total_tasks', 0)
        qa_fail = kpi.get('qa_fail_rate', 0)
        rollback = kpi.get('rollback_rate', 0)
        high_prio = kpi.get('high_priority', 0)
        risk = kpi.get('avg_risk', 0)
        
        tooltip_data = generate_tooltip_content(company, kpi, exec_data)
        
        html += f'''
                            <tr>
                                <td class="heat-cell" style="background: {get_heatmap_color(qa_fail, 0.2)}" 
                                    onmouseenter="showTooltip(event, `{tooltip_data}`)" 
                                    onmouseleave="hideTooltip()">
                                    <strong>{company}</strong>
                                </td>
                                <td style="background: #1e293b">{total}</td>
                                <td class="heat-cell" style="background: {get_heatmap_color(qa_fail, 0.2)}; color: {get_risk_color(qa_fail)}">{qa_fail*100:.1f}%</td>
                                <td class="heat-cell" style="background: {get_heatmap_color(rollback, 0.1)}; color: {get_risk_color(rollback)}">{rollback*100:.1f}%</td>
                                <td style="background: #1e293b; color: {'#f87171' if high_prio > 5 else '#e2e8f0'}">{high_prio}</td>
                                <td style="background: {get_heatmap_color(risk, 0.3)}; color: {get_risk_color(risk)}">{risk:.2f}</td>
                            </tr>
'''
    
    html += '''
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <!-- Scenario Simulation & Additional Stats -->
        <div class="main-grid">
            <!-- Scenario Simulation -->
            <div class="card">
                <h2>🎭 Scenario Simulation</h2>
                <div class="scenario-grid">
'''
    
    for scenario in scenarios:
        success_color = get_risk_color(1 - scenario["success_rate"])
        html += f'''
                    <div class="scenario-card" onclick="selectScenario(this)">
                        <div class="scenario-name">{scenario['name']}</div>
                        <div class="scenario-desc">{scenario['description']}</div>
                        <div class="scenario-stats">
                            <div class="scenario-stat">
                                <div class="value" style="color: #60a5fa">{scenario['workers']}</div>
                                <div class="label">Workers</div>
                            </div>
                            <div class="scenario-stat">
                                <div class="value" style="color: {success_color}">{scenario['success_rate']*100:.0f}%</div>
                                <div class="label">Success</div>
                            </div>
                        </div>
                    </div>
'''
    
    html += '''
                </div>
            </div>
            
            <!-- Worker Allocation & Priority Distribution -->
            <div class="card">
                <h2>👥 Worker Allocation & Priority</h2>
                <div class="gauge-container">
                    <div class="gauge">
                        <div class="gauge-bg"></div>
                        <div class="gauge-fill" style="--gauge-degree: ' + str(int(kpi_summary['worker_utilization'] * 1.8)) + 'deg"></div>
                        <div class="gauge-text">
                            <div class="gauge-value">''' + str(int(kpi_summary['worker_utilization'])) + '''%</div>
                            <div class="gauge-label">Utilization</div>
                        </div>
                    </div>
                </div>
                <div class="priority-list">
'''
    
    # Priority distribution
    priority_counts = defaultdict(int)
    for task in exec_data:
        priority_counts[task['priority']] += 1
    
    priority_colors = {
        'critical': '#f87171',
        'high': '#fbbf24',
        'medium': '#60a5fa',
        'normal': '#94a3b8',
        'low': '#64748b'
    }
    
    max_priority = max(priority_counts.values()) if priority_counts else 1
    
    for priority in ['critical', 'high', 'medium', 'normal', 'low']:
        count = priority_counts.get(priority, 0)
        percentage = (count / max_priority) * 100 if max_priority > 0 else 0
        html += f'''
                    <div class="priority-item">
                        <span class="priority-badge {priority}">{priority.upper()}</span>
                        <div class="priority-bar">
                            <div class="priority-bar-fill" style="width: {percentage}%; background: {priority_colors[priority]}"></div>
                        </div>
                        <span class="priority-count">{count}</span>
                    </div>
'''
    
    html += '''
                </div>
            </div>
        </div>
        
        <!-- Risk Distribution Chart -->
        <div class="main-grid">
            <div class="card">
                <h2>📈 Risk Distribution</h2>
                <div class="risk-chart">
'''
    
    # Calculate risk distribution
    risk_buckets = {'0-0.2': 0, '0.2-0.4': 0, '0.4-0.6': 0, '0.6-0.8': 0, '0.8-1.0': 0}
    for task in exec_data:
        risk = task.get('predicted_risk', 0)
        if risk < 0.2:
            risk_buckets['0-0.2'] += 1
        elif risk < 0.4:
            risk_buckets['0.2-0.4'] += 1
        elif risk < 0.6:
            risk_buckets['0.4-0.6'] += 1
        elif risk < 0.8:
            risk_buckets['0.6-0.8'] += 1
        else:
            risk_buckets['0.8-1.0'] += 1
    
    max_risk_bucket = max(risk_buckets.values()) if risk_buckets.values() else 1
    risk_colors = ['#4ade80', '#86efac', '#fbbf24', '#f97316', '#f87171']
    
    for i, (bucket, count) in enumerate(risk_buckets.items()):
        height = (count / max_risk_bucket) * 100 if max_risk_bucket > 0 else 0
        html += f'''
                    <div class="risk-bar">
                        <div class="risk-bar-value" style="color: {risk_colors[i]}">{count}</div>
                        <div class="risk-bar-fill" style="height: {height}%; background: {risk_colors[i]}"></div>
                        <div class="risk-bar-label">{bucket}</div>
                    </div>
'''
    
    html += '''
                </div>
            </div>
            
            <!-- High Risk Companies -->
            <div class="card">
                <h2>⚠️ High Risk Companies</h2>
                <div class="company-grid">
'''
    
    # Sort companies by risk
    sorted_companies = sorted(companies, key=lambda c: company_kpis.get(c, {}).get('avg_risk', 0), reverse=True)
    high_risk_companies = [c for c in sorted_companies if company_kpis.get(c, {}).get('risk_level') == 'HIGH'][:20]
    
    for company in high_risk_companies:
        kpi = company_kpis.get(company, {})
        risk = kpi.get('avg_risk', 0)
        html += f'''
                    <div class="company-item high-risk" onmouseenter="showTooltip(event, `{generate_tooltip_content(company, kpi, exec_data)}`)" onmouseleave="hideTooltip()">
                        <div class="company-name">{company}</div>
                        <div class="company-stats">
                            <span style="color: {get_risk_color(risk)}">Risk: {risk:.2f}</span>
                            <span>{kpi.get('total_tasks', 0)} tasks</span>
                        </div>
                    </div>
'''
    
    html += '''
                </div>
            </div>
        </div>
    </div>
    
    <!-- Tooltip Element -->
    <div id="tooltip" class="tooltip"></div>
    
    <script>
        // Initialize Mermaid
        mermaid.initialize({
            startOnLoad: true,
            theme: 'dark',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }
        });
        
        // Tooltip functions
        function showTooltip(event, content) {{
            const tooltip = document.getElementById('tooltip');
            tooltip.innerHTML = content;
            tooltip.classList.add('visible');
            
            // Position tooltip
            const rect = event.target.getBoundingClientRect();
            let left = rect.right + 10;
            let top = rect.top;
            
            // Check if tooltip goes off screen
            if (left + 320 > window.innerWidth) {{
                left = rect.left - 330;
            }}
            if (top + 200 > window.innerHeight) {{
                top = window.innerHeight - 210;
            }}
            
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        }}
        
        function hideTooltip() {{
            const tooltip = document.getElementById('tooltip');
            tooltip.classList.remove('visible');
        }}
        
        // Scenario selection
        function selectScenario(element) {{
            document.querySelectorAll('.scenario-card').forEach(card => {{
                card.classList.remove('active');
            }});
            element.classList.add('active');
            
            // Update KPI cards with scenario data
            const workers = element.querySelector('.value').textContent;
            const successRate = element.querySelectorAll('.value')[1].textContent;
            
            console.log('Selected scenario:', element.querySelector('.scenario-name').textContent);
        }}
        
        // Batch detail display
        function showBatchDetail(batchId) {{
            const detail = document.getElementById('batch-detail');
            detail.classList.add('visible');
            detail.innerHTML = '<h4>Batch #' + batchId + ' Details</h4><p>Click to view detailed task allocation...</p>';
        }}
        
        // Auto-refresh every 30 seconds
        setInterval(() => {{
            console.log('Auto-refresh: Dashboard data updated');
        }}, 30000);
    </script>
</body>
</html>
'''
    
    return html

def main():
    """Main function to generate the Digital Twin Dashboard."""
    print("=" * 60)
    print("Digital Twin Dashboard Generator")
    print("Full Autonomous Corporate Agent v2.0")
    print("=" * 60)
    
    # Ensure base directory exists
    BASE_PATH.mkdir(parents=True, exist_ok=True)
    
    # Load existing data or generate sample data
    exec_data = load_json(EXECUTION_SUMMARY, [])
    company_scores = load_json(COMPANY_SCORES, {})
    simulation = load_json(SIMULATION_REPORT, [])
    sla_predictions = load_json(SLA_PREDICTION, [])
    
    # Generate sample data if none exists
    if not exec_data:
        exec_data, company_scores, simulation, sla_predictions = generate_sample_data()
    
    # Calculate company KPIs
    company_kpis = calculate_company_kpis(exec_data)
    
    # Generate dashboard HTML
    html_content = generate_dashboard_html(exec_data, company_kpis, simulation, sla_predictions)
    
    # Save dashboard
    with open(DASHBOARD_HTML, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"\n✅ Digital Twin Dashboard generated successfully!")
    print(f"📁 Output: {DASHBOARD_HTML}")
    print(f"📊 Companies: {len(company_kpis)}")
    print(f"📋 Total Tasks: {len(exec_data)}")
    print(f"🎭 Simulation Batches: {len(simulation)}")
    print("\n🌐 Open the dashboard in a browser to view the interactive visualization.")
    
    return str(DASHBOARD_HTML)

if __name__ == "__main__":
    main()
