#!/usr/bin/env python3
"""
SUPER AGENT OFFLINE FULL AUTONOMOUS + KPI-DRIVEN OPTIMIZATION
=============================================================
Full Autonomous Corporate Agent v2.0
"""

import threading, queue, json, random, time, hashlib
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict
import logging

# CONFIGURATION
TELEGRAM_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN"
BASE_PATH = Path(".super-agent-fullauto-kpi")
KB_PATH = Path("kb")
TASK_DB = BASE_PATH / "task_db.json"
WORKSPACE_PATH = BASE_PATH / "workspace"
LOG_PATH = BASE_PATH / "logs"
ANALYTICS_PATH = BASE_PATH / "analytics.json"
ALERTS_PATH = BASE_PATH / "alerts.json"
DASHBOARD_HTML = BASE_PATH / "dashboard.html"
EXECUTION_SUMMARY = BASE_PATH / "execution_summary.json"
SIMULATION_REPORT = BASE_PATH / "simulation_report.json"
AUTONOMOUS_PLAN = BASE_PATH / "autonomous_plan.json"
COMPANY_SCORES = BASE_PATH / "company_scores.json"
DECISION_LOG = BASE_PATH / "decision_log.json"
RISK_REPORT = BASE_PATH / "risk_report.json"
SLA_PREDICTION = BASE_PATH / "sla_prediction.json"

COMPANIES = [f"Company_{i}" for i in range(1, 101)]
MAX_WORKERS = 512
BOTTLENECK_THRESHOLD = 0.7
SLA_VIOLATION_THRESHOLD = 0.3

task_queue = queue.PriorityQueue()
feedback_queue = queue.Queue()
alert_queue = queue.Queue()
analytics_lock = threading.Lock()
decision_lock = threading.Lock()

class TaskStatus(Enum):
    PENDING = "PENDING"; IN_PROGRESS = "IN_PROGRESS"; DEV_DONE = "DEV_DONE"
    DEV_FAILED = "DEV_FAILED"; QA_DONE = "QA_DONE"; QA_FAIL = "QA_FAIL"
    COMPLETED = "COMPLETED"; ROLLED_BACK = "ROLLED_BACK"

@dataclass
class Task:
    id: str; desc: str; task_type: str; assigned_company: str
    priority: str = "normal"; allocated_workers: int = 1; status: str = "PENDING"
    predicted_risk: float = 0.0; sla_deadline: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    tags: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    retry_count: int = 0; max_retries: int = 3

@dataclass
class DecisionRecord:
    timestamp: str; task_id: str; decision_type: str
    input_data: Dict; output_data: Dict; reasoning: str
    confidence: float; company: str

@dataclass
class CompanyStats:
    company: str; qa_fail_rate: float; rollback_rate: float
    task_count: int; avg_completion_time: float; risk_score: float; last_updated: str

def setup_logging():
    LOG_PATH.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[logging.FileHandler(LOG_PATH / f"agent_{datetime.now().strftime('%Y%m%d')}.log"), logging.StreamHandler()])
    return logging.getLogger(__name__)
logger = setup_logging()

def generate_task_id() -> str:
    return f"TASK-{hashlib.md5(str(time.time()*1000).encode()).hexdigest()[:8].upper()}"

def save_json(path: Path, data: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w') as f: json.dump(data, f, indent=2, default=str)

def load_json(path: Path, default: Any = None) -> Any:
    try:
        with open(path, 'r') as f: return json.load(f)
    except: return default if default is not None else []

def get_timestamp() -> str: return datetime.now().isoformat()

def calculate_risk_score(task: Task, company_stats: Dict) -> float:
    base_risk = {"critical": 0.4, "high": 0.25, "medium": 0.15, "normal": 0.1, "low": 0.05}.get(task.priority, 0.1)
    if task.assigned_company:
        stats = company_stats.get(task.assigned_company, {})
        base_risk += stats.get("qa_fail_rate", 0) * 0.3
        base_risk += stats.get("rollback_rate", 0) * 0.2
    base_risk += {"bug": 0.2, "payment": 0.3, "hotfix": 0.25, "audit": 0.15}.get(task.task_type, 0.1)
    return min(base_risk, 1.0)

def self_learning_update() -> Dict[str, CompanyStats]:
    analytics = load_json(ANALYTICS_PATH, [])
    company_stats = {}
    for comp in COMPANIES:
        tasks = [t for t in analytics if t.get("company") == comp]
        total = len(tasks)
        if total == 0:
            company_stats[comp] = CompanyStats(company=comp, qa_fail_rate=0.0, rollback_rate=0.0, task_count=0, avg_completion_time=0.0, risk_score=0.1, last_updated=get_timestamp())
            continue
        qa_fail = sum(1 for t in tasks if t.get("qa_status") == "QA_FAIL")
        rollback = sum(1 for t in tasks if t.get("dev_status") == "DEV_FAILED")
        completion_times = []
        for t in tasks:
            if "completed_at" in t and "created_at" in t:
                try:
                    start, end = datetime.fromisoformat(t["created_at"]), datetime.fromisoformat(t["completed_at"])
                    completion_times.append((end - start).total_seconds())
                except: pass
        avg_time = sum(completion_times) / len(completion_times) if completion_times else 0
        risk_score = (qa_fail / total) * 0.4 + (rollback / total) * 0.3 + 0.3
        company_stats[comp] = CompanyStats(company=comp, qa_fail_rate=qa_fail/total, rollback_rate=rollback/total, task_count=total, avg_completion_time=avg_time, risk_score=risk_score, last_updated=get_timestamp())
    save_json(COMPANY_SCORES, {k: asdict(v) for k, v in company_stats.items()})
    return company_stats

def learn_and_adapt(decision_record: DecisionRecord):
    with decision_lock:
        decisions = load_json(DECISION_LOG, [])
        decisions.append(asdict(decision_record))
        if len(decisions) > 10000: decisions = decisions[-10000:]
        save_json(DECISION_LOG, decisions)
        self_learning_update()

def predictive_priority(task: Task, company_stats: Dict[str, CompanyStats]) -> Task:
    base_priority = {"bug": "critical", "payment": "high", "hotfix": "critical", "audit": "medium", "report": "normal", "feature": "low", "generic": "normal"}
    priority = base_priority.get(task.task_type, "normal")
    if task.assigned_company and task.assigned_company in company_stats:
        stats = company_stats[task.assigned_company]
        if stats.qa_fail_rate > BOTTLENECK_THRESHOLD: priority = "critical"
        elif stats.qa_fail_rate > 0.15: priority = max(priority, "high")
        if stats.risk_score > 0.6: priority = max(priority, "high")
    if task.sla_deadline:
        try:
            deadline = datetime.fromisoformat(task.sla_deadline)
            hours_until = (deadline - datetime.now()).total_seconds() / 3600
            if hours_until < 2: priority = "critical"
            elif hours_until < 8: priority = max(priority, "high")
        except: pass
    task.priority = priority
    return task

def allocate_worker(task: Task, company_stats: Dict[str, CompanyStats]) -> Task:
    base_workers = {"critical": 8, "high": 4, "medium": 2, "normal": 1, "low": 1}
    allocated = base_workers.get(task.priority, 1)
    if task.assigned_company and task.assigned_company in company_stats:
        stats = company_stats[task.assigned_company]
        if stats.qa_fail_rate > BOTTLENECK_THRESHOLD: allocated = min(allocated * 2, MAX_WORKERS)
        elif stats.task_count > 100 and stats.qa_fail_rate < 0.1: allocated = max(allocated - 1, 1)
        if stats.risk_score > 0.6: allocated = min(allocated + 2, MAX_WORKERS)
    if task.task_type in ["bug", "payment", "hotfix"]: allocated = min(allocated + 2, MAX_WORKERS)
    task.allocated_workers = allocated
    return task

def batch_scheduler(tasks: List[Dict]) -> List[Task]:
    logger.info(f"Batch scheduler processing {len(tasks)} tasks")
    company_stats = self_learning_update()
    task_objects = []
    for t in tasks:
        task = Task(id=t.get("id", generate_task_id()), desc=t.get("desc", ""), task_type=t.get("task_type", "generic"), assigned_company=t.get("assigned_company", random.choice(COMPANIES)), sla_deadline=t.get("sla_deadline"), tags=t.get("tags", []), dependencies=t.get("dependencies", []))
        task = predictive_priority(task, company_stats)
        task = allocate_worker(task, company_stats)
        task.predicted_risk = calculate_risk_score(task, company_stats)
        task_objects.append(task)
    priority_order = {"critical": 1, "high": 2, "medium": 3, "normal": 4, "low": 5}
    task_objects.sort(key=lambda x: (priority_order.get(x.priority, 5), -x.predicted_risk))
    simulate_tasks(task_objects, company_stats)
    generate_autonomous_plan(task_objects, company_stats)
    generate_risk_report(task_objects, company_stats)
    predict_sla_violations(task_objects, company_stats)
    logger.info(f"Batch scheduler completed. {len(task_objects)} tasks scheduled.")
    return task_objects

def simulate_tasks(tasks: List[Task], company_stats: Dict) -> Dict:
    report = []
    total_workers = MAX_WORKERS; current_load = 0
    for task in tasks:
        simulated_workers = min(task.allocated_workers, total_workers - current_load)
        current_load += simulated_workers
        risk_factors = []
        if task.assigned_company in company_stats:
            stats = company_stats[task.assigned_company]
            risk_factors.append(f"qa_fail_rate={stats.qa_fail_rate:.2f}")
            risk_factors.append(f"rollback_rate={stats.rollback_rate:.2f}")
        bottleneck_prob = 0.0
        if current_load > total_workers * 0.8: bottleneck_prob = (current_load - total_workers * 0.8) / (total_workers * 0.2)
        report.append({"task_id": task.id, "company": task.assigned_company, "priority": task.priority, "predicted_risk": task.predicted_risk, "allocated_workers": simulated_workers, "bottleneck_probability": bottleneck_prob, "risk_factors": risk_factors, "timestamp": get_timestamp()})
        task.allocated_workers = simulated_workers
    save_json(SIMULATION_REPORT, report)
    return {"simulation": report, "total_load": current_load, "max_workers": total_workers}

def generate_autonomous_plan(tasks: List[Task], company_stats: Dict):
    plan = {"generated_at": get_timestamp(), "total_tasks": len(tasks), "phases": []}
    phases = defaultdict(list)
    for task in tasks:
        phases[task.priority].append({"task_id": task.id, "company": task.assigned_company, "workers": task.allocated_workers, "risk": task.predicted_risk})
    for priority in ["critical", "high", "medium", "normal", "low"]:
        if phases[priority]:
            plan["phases"].append({"phase": priority.upper(), "task_count": len(phases[priority]), "tasks": phases[priority], "estimated_duration_minutes": len(phases[priority]) * 5})
    company_allocation = defaultdict(lambda: {"tasks": 0, "workers": 0})
    for task in tasks:
        company_allocation[task.assigned_company]["tasks"] += 1
        company_allocation[task.assigned_company]["workers"] += task.allocated_workers
    plan["company_summary"] = {k: dict(v) for k, v in company_allocation.items()}
    plan["total_workers_needed"] = sum(v["workers"] for v in company_allocation.values())
    save_json(AUTONOMOUS_PLAN, plan)
    logger.info(f"Autonomous plan generated: {len(plan['phases'])} phases")

def generate_risk_report(tasks: List[Task], company_stats: Dict):
    report = {"generated_at": get_timestamp(), "total_tasks": len(tasks), "high_risk_tasks": [], "bottleneck_predictions": [], "sla_at_risk": []}
    for task in tasks:
        if task.predicted_risk > 0.5:
            report["high_risk_tasks"].append({"task_id": task.id, "company": task.assigned_company, "risk_score": task.predicted_risk, "priority": task.priority})
        if task.assigned_company in company_stats:
            stats = company_stats[task.assigned_company]
            if stats.qa_fail_rate > BOTTLENECK_THRESHOLD:
                report["bottleneck_predictions"].append({"company": task.assigned_company, "qa_fail_rate": stats.qa_fail_rate, "recommended_action": "Increase QA resources or reduce task load"})
        if task.sla_deadline:
            try:
                deadline = datetime.fromisoformat(task.sla_deadline)
                if deadline < datetime.now() + timedelta(hours=4):
                    report["sla_at_risk"].append({"task_id": task.id, "deadline": task.sla_deadline, "hours_remaining": (deadline - datetime.now()).total_seconds() / 3600})
            except: pass
    save_json(RISK_REPORT, report)

def predict_sla_violations(tasks: List[Task], company_stats: Dict):
    predictions = []
    for task in tasks:
        if task.assigned_company in company_stats:
            stats = company_stats[task.assigned_company]
            base_prob = stats.qa_fail_rate
            if task.priority in ["critical", "high"]: base_prob *= 1.2
            base_prob = min(base_prob + task.predicted_risk * 0.3, 1.0)
            predictions.append({"task_id": task.id, "company": task.assigned_company, "sla_violation_probability": base_prob, "predicted_outcome": "AT_RISK" if base_prob > SLA_VIOLATION_THRESHOLD else "ON_TRACK", "recommended_workers": min(task.allocated_workers + 2, MAX_WORKERS) if base_prob > SLA_VIOLATION_THRESHOLD else task.allocated_workers})
    save_json(SLA_PREDICTION, predictions)

def execute_task(task: Task):
    logger.info(f"Executing task {task.id} for {task.assigned_company}")
    company_stats = self_learning_update()
    task = predictive_priority(task, company_stats)
    task = allocate_worker(task, company_stats)
    decision = DecisionRecord(timestamp=get_timestamp(), task_id=task.id, decision_type="TASK_EXECUTION", input_data={"task_type": task.task_type, "company": task.assigned_company}, output_data={"priority": task.priority, "workers": task.allocated_workers}, reasoning=f"Priority based on {task.task_type} type and {task.assigned_company} history", confidence=0.85, company=task.assigned_company)
    learn_and_adapt(decision)
    dev_thread = threading.Thread(target=dev_handler, args=(task,), daemon=True)
    qa_thread = threading.Thread(target=qa_handler, args=(task,), daemon=True)
    dev_thread.start(); qa_thread.start()
    dev_thread.join(); qa_thread.join()
    collect_feedback(task)
    logger.info(f"Task {task.id} execution completed")

def dev_handler(task: Task):
    try:
        patch_file = WORKSPACE_PATH / f"{task.id}_{task.assigned_company}_{task.priority}.patch"
        patch_file.parent.mkdir(parents=True, exist_ok=True)
        patch_content = f"# Dev Patch - {task.id}\n# Company: {task.assigned_company}\n# Priority: {task.priority}\n# Created: {get_timestamp()}\n# Workers: {task.allocated_workers}\n\n[PATCH]\n+ Implementation for {task.desc}\n+ Type: {task.task_type}\n+ Risk Score: {task.predicted_risk:.2f}\n"
        patch_file.write_text(patch_content)
        failure_rate = 0.02 if task.priority == "normal" else (0.05 if task.priority == "critical" else 0.03)
        status = "DEV_DONE" if random.random() > failure_rate else "DEV_FAILED"
        retries = 0
        while status == "DEV_FAILED" and retries < task.max_retries:
            logger.warning(f"Dev failed for {task.id}, retry {retries + 1}")
            time.sleep(0.1)
            status = "DEV_DONE" if random.random() > failure_rate else "DEV_FAILED"
            retries += 1
        if status == "DEV_FAILED":
            task.status = TaskStatus.DEV_FAILED.value
            patch_file.unlink(missing_ok=True)
        feedback_queue.put({"task_id": task.id, "company": task.assigned_company, "dev_status": status, "patch_file": str(patch_file) if status == "DEV_DONE" else None, "retries": retries})
        logger.info(f"Dev handler completed for {task.id}: {status}")
    except Exception as e:
        logger.error(f"Dev handler error for {task.id}: {e}")
        feedback_queue.put({"task_id": task.id, "company": task.assigned_company, "dev_status": "DEV_FAILED", "error": str(e)})

def qa_handler(task: Task):
    time.sleep(0.05)
    try:
        patch_file = WORKSPACE_PATH / f"{task.id}_{task.assigned_company}_{task.priority}.patch"
        failure_rate = 0.03 if task.priority not in ["critical", "high"] else 0.05
        status = "QA_DONE" if random.random() > failure_rate else "QA_FAIL"
        if status == "QA_FAIL":
            patch_file.unlink(missing_ok=True)
            task.status = TaskStatus.QA_FAIL.value
            decision = DecisionRecord(timestamp=get_timestamp(), task_id=task.id, decision_type="QA_ROLLBACK", input_data={"company": task.assigned_company, "priority": task.priority}, output_data={"rollback_reason": "QA_FAIL"}, reasoning="Automated rollback due to QA failure", confidence=1.0, company=task.assigned_company)
            learn_and_adapt(decision)
            alert_queue.put({"type": "QA_FAIL", "task_id": task.id, "company": task.assigned_company, "timestamp": get_timestamp()})
        feedback_queue.put({"task_id": task.id, "company": task.assigned_company, "qa_status": status})
        logger.info(f"QA handler completed for {task.id}: {status}")
    except Exception as e:
        logger.error(f"QA handler error for {task.id}: {e}")
        feedback_queue.put({"task_id": task.id, "company": task.assigned_company, "qa_status": "QA_FAIL", "error": str(e)})

def collect_feedback(task: Task):
    feedbacks = []
    while not feedback_queue.empty():
        try: feedbacks.append(feedback_queue.get_nowait())
        except queue.Empty: break
    update_analytics(task, feedbacks)
    update_execution_summary(task, feedbacks)
    mark_task_done(task.id)
    if any(f.get("qa_status") == "QA_FAIL" or f.get("dev_status") == "DEV_FAILED" for f in feedbacks):
        generate_alert(task, feedbacks)

def update_analytics(task: Task, feedbacks: List[Dict]):
    with analytics_lock:
        data = load_json(ANALYTICS_PATH, [])
        entry = {"task_id": task.id, "company": task.assigned_company, "task_type": task.task_type, "priority": task.priority, "allocated_workers": task.allocated_workers, "predicted_risk": task.predicted_risk, "dev_status": next((f.get("dev_status") for f in feedbacks if "dev_status" in f), "UNKNOWN"), "qa_status": next((f.get("qa_status") for f in feedbacks if "qa_status" in f), "UNKNOWN"), "created_at": task.created_at, "completed_at": get_timestamp(), "timestamp": get_timestamp()}
        data.append(entry)
        if len(data) > 10000: data = data[-10000:]
        save_json(ANALYTICS_PATH, data)
        generate_dashboard(data)
        generate_alerts(data)

def update_execution_summary(task: Task, feedbacks: List[Dict]):
    summary = load_json(EXECUTION_SUMMARY, [])
    dev_status = next((f.get("dev_status") for f in feedbacks if "dev_status" in f), "UNKNOWN")
    qa_status = next((f.get("qa_status") for f in feedbacks if "qa_status" in f), "UNKNOWN")
    summary.append({"task_id": task.id, "company": task.assigned_company, "task_type": task.task_type, "dev_status": dev_status, "qa_status": qa_status, "priority": task.priority, "allocated_workers": task.allocated_workers, "predicted_risk": task.predicted_risk, "timestamp": get_timestamp(), "outcome": "SUCCESS" if dev_status == "DEV_DONE" and qa_status == "QA_DONE" else "FAILED"})
    if len(summary) > 5000: summary = summary[-5000:]
    save_json(EXECUTION_SUMMARY, summary)

def generate_dashboard(data: List[Dict]):
    total_tasks = len(data)
    dev_failures = sum(1 for d in data if d.get("dev_status") == "DEV_FAILED")
    qa_failures = sum(1 for d in data if d.get("qa_status") == "QA_FAIL")
    success_rate = ((total_tasks - dev_failures - qa_failures) / total_tasks * 100) if total_tasks > 0 else 100
    company_stats = defaultdict(lambda: {"total": 0, "qa_fail": 0, "dev_fail": 0})
    for d in data:
        comp = d.get("company", "Unknown")
        company_stats[comp]["total"] += 1
        if d.get("qa_status") == "QA_FAIL": company_stats[comp]["qa_fail"] += 1
        if d.get("dev_status") == "DEV_FAILED": company_stats[comp]["dev_fail"] += 1
    risk_buckets = {"critical": 0, "high": 0, "medium": 0, "normal": 0, "low": 0}
    for d in data:
        p = d.get("priority", "normal")
        risk_buckets[p] = risk_buckets.get(p, 0) + 1
    html = f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Full Autonomous Agent Dashboard</title><style>*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0}}.container{{max-width:1600px;margin:0 auto;padding:20px}}h1{{color:#60a5fa;margin-bottom:20px;font-size:28px}}h2{{color:#93c5fd;margin:20px 0 10px;font-size:18px}}.header{{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px}}.timestamp{{color:#64748b;font-size:14px}}.stats-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:30px}}.stat-card{{background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155}}.stat-label{{color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px}}.stat-value{{font-size:32px;font-weight:bold;color:#60a5fa;margin-top:5px}}.stat-value.success{{color:#4ade80}}.stat-value.warning{{color:#fbbf24}}.stat-value.danger{{color:#f87171}}table{{width:100%;border-collapse:collapse;background:#1e293b;border-radius:12px;overflow:hidden;margin-bottom:20px}}th,td{{padding:12px 15px;text-align:left;border-bottom:1px solid #334155}}th{{background:#0f172a;color:#60a5fa;font-weight:600;font-size:12px;text-transform:uppercase}}tr:hover{{background:#334155}}.badge{{padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600}}.badge-dev-done{{background:#065f46;color:#4ade80}}.badge-dev-failed{{background:#7f1d1d;color:#f87171}}.badge-qa-done{{background:#1e40af;color:#60a5fa}}.badge-qa-fail{{background:#78350f;color:#fbbf24}}.badge-critical{{background:#7f1d1d;color:#f87171}}.badge-high{{background:#78350f;color:#fbbf24}}.badge-medium{{background:#1e40af;color:#60a5fa}}.badge-normal{{background:#334155;color:#94a3b8}}.badge-low{{background:#1e293b;color:#64748b}}.chart-grid{{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px}}.chart-card{{background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155}}</style></head><body><div class="container"><div class="header"><h1>Full Autonomous Corporate Agent Dashboard</h1><div class="timestamp">Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div></div><div class="stats-grid"><div class="stat-card"><div class="stat-label">Total Tasks</div><div class="stat-value">{total_tasks}</div></div><div class="stat-card"><div class="stat-label">Success Rate</div><div class="stat-value success">{success_rate:.1f}%</div></div><div class="stat-card"><div class="stat-label">Dev Failures</div><div class="stat-value warning">{dev_failures}</div></div><div class="stat-card"><div class="stat-label">QA Failures</div><div class="stat-value danger">{qa_failures}</div></div></div><div class="chart-grid"><div class="chart-card"><h2>Recent Task Execution</h2><table><thead><tr><th>Task ID</th><th>Company</th><th>Type</th><th>Priority</th><th>Dev</th><th>QA</th><th>Risk</th><th>Time</th></tr></thead><tbody>{generate_table_rows(data[-50:])}</tbody></table></div></div></div></body></html>"""
    save_json(DASHBOARD_HTML.with_suffix(".html"), html)

def generate_table_rows(data: List[Dict]) -> str:
    html = ""
    for d in data:
        risk = d.get("predicted_risk", 0)
        risk_color = "#f87171" if risk > 0.5 else "#fbbf24" if risk > 0.3 else "#4ade80"
        html += f"""<tr><td><code>{d.get('task_id', 'N/A')}</code></td><td>{d.get('company', 'N/A')}</td><td>{d.get('task_type', 'N/A')}</td><td><span class="badge badge-{d.get('priority', 'normal')}">{d.get('priority', 'NORMAL')}</span></td><td><span class="badge {'badge-dev-done' if d.get('dev_status') == 'DEV_DONE' else 'badge-dev-failed'}">{d.get('dev_status', 'N/A')}</span></td><td><span class="badge {'badge-qa-done' if d.get('qa_status') == 'QA_DONE' else 'badge-qa-fail'}">{d.get('qa_status', 'N/A')}</span></td><td><span style="color:{risk_color};">{risk:.2f}</span></td><td>{d.get('timestamp', 'N/A')[:19]}</td></tr>"""
    return html

def generate_alerts(data: List[Dict]):
    alerts = []
    for d in data[-100:]:
        if d.get("qa_status") == "QA_FAIL": alerts.append({"type": "QA_FAIL", "task_id": d.get("task_id"), "company": d.get("company"), "timestamp": d.get("timestamp"), "severity": "HIGH"})
        if d.get("dev_status") == "DEV_FAILED": alerts.append({"type": "DEV_FAILED", "task_id": d.get("task_id"), "company": d.get("company"), "timestamp": d.get("timestamp"), "severity": "MEDIUM"})
        if d.get("predicted_risk", 0) > 0.6: alerts.append({"type": "HIGH_RISK", "task_id": d.get("task_id"), "company": d.get("company"), "risk_score": d.get("predicted_risk"), "timestamp": d.get("timestamp"), "severity": "WARNING"})
    alerts = alerts[-100:]
    save_json(ALERTS_PATH, alerts)

def generate_alert(task: Task, feedbacks: List[Dict]):
    alert = {"type": "TASK_FAILURE", "task_id": task.id, "company": task.assigned_company, "priority": task.priority, "dev_status": next((f.get("dev_status") for f in feedbacks if "dev_status" in f), "UNKNOWN"), "qa_status": next((f.get("qa_status") for f in feedbacks if "qa_status" in f), "UNKNOWN"), "timestamp": get_timestamp(), "severity": "CRITICAL" if task.priority == "critical" else "HIGH"}
    alerts = load_json(ALERTS_PATH, [])
    alerts.append(alert)
    alerts = alerts[-100:]
    save_json(ALERTS_PATH, alerts)
    logger.warning(f"ALERT: Task {task.id} failed - {alert['dev_status']}/{alert['qa_status']}")

def load_tasks() -> List[Dict]: return load_json(TASK_DB, [])
def save_tasks(tasks: List[Dict]): save_json(TASK_DB, tasks)

def add_task(task_data: Dict) -> str:
    tasks = load_tasks()
    task_data["id"] = task_data.get("id", generate_task_id())
    task_data["status"] = "PENDING"
    task_data["created_at"] = get_timestamp()
    tasks.append(task_data)
    save_tasks(tasks)
    return task_data["id"]

def mark_task_done(task_id: str):
    tasks = load_tasks()
    for task in tasks:
        if task.get("id") == task_id:
            task["status"] = "COMPLETED"
            task["completed_at"] = get_timestamp()
            break
    save_tasks(tasks)

def fetch_new_tasks() -> List[Dict]:
    tasks = load_tasks()
    new_tasks = [t for t in tasks if t.get("status") == "PENDING"]
    for task in new_tasks: task["status"] = "IN_PROGRESS"
    save_tasks(tasks)
    return new_tasks

def route_tasks_batch(tasks: List[Dict]):
    if not tasks: return
    scheduled_tasks = batch_scheduler(tasks)
    for task in scheduled_tasks: execute_task(task)

def telegram_handler(update, context):
    msg = update.message.text.strip()
    chat_id = update.message.chat_id
    logger.info(f"Telegram message from {chat_id}: {msg}")
    if msg.lower() == "/start":
        context.bot.send_message(chat_id=chat_id, text="Full Autonomous Corporate Agent\n\n/kpi - KPI report\n/plan - Autonomous plan\n/status - System status\n/alerts - Recent alerts\n/risk - Risk report\n\nSend any text to create a new task.")
        return
    elif msg.lower() == "/kpi":
        company_stats = self_learning_update()
        analytics = load_json(ANALYTICS_PATH, [])
        total = len(analytics); qa_fail = sum(1 for a in analytics if a.get("qa_status") == "QA_FAIL")
        dev_fail = sum(1 for a in analytics if a.get("dev_status") == "DEV_FAILED")
        success_rate = ((total - qa_fail - dev_fail) / total * 100) if total > 0 else 100
        response = f"KPI Report\n\nTotal Tasks: {total}\nSuccess Rate: {success_rate:.1f}%\nDev Failures: {dev_fail}\nQA Failures: {qa_fail}\n\nDashboard: .super-agent-fullauto-kpi/dashboard.html"
        context.bot.send_message(chat_id=chat_id, text=response)
        return
    elif msg.lower() == "/plan":
        plan = load_json(AUTONOMOUS_PLAN, {})
        if not plan:
            context.bot.send_message(chat_id=chat_id, text="No autonomous plan generated yet.")
            return
        response = f"Autonomous Execution Plan\n\nGenerated: {plan.get('generated_at', 'N/A')}\nTotal Tasks: {plan.get('total_tasks', 0)}\nTotal Workers Needed: {plan.get('total_workers_needed', 0)}\n\n"
        for phase in plan.get("phases", []):
            response += f"{phase['phase']} Phase: {phase['task_count']} tasks\n"
        context.bot.send_message(chat_id=chat_id, text=response)
        return
    elif msg.lower() == "/status":
        tasks = load_tasks()
        pending = sum(1 for t in tasks if t.get("status") == "PENDING")
        in_progress = sum(1 for t in tasks if t.get("status") == "IN_PROGRESS")
        completed = sum(1 for t in tasks if t.get("status") == "COMPLETED")
        response = f"System Status\n\nPending Tasks: {pending}\nIn Progress: {in_progress}\nCompleted: {completed}\nMax Workers: {MAX_WORKERS}\nCompanies: {len(COMPANIES)}"
        context.bot.send_message(chat_id=chat_id, text=response)
        return
    elif msg.lower() == "/alerts":
        alerts = load_json(ALERTS_PATH, [])
        if not alerts:
            context.bot.send_message(chat_id=chat_id, text="No alerts.")
            return
        response = f"Recent Alerts ({len(alerts[-10:])})\n\n"
        for alert in alerts[-10:]:
            response += f"[{alert.get('severity', 'N/A')}] {alert.get('type', 'N/A')}\nTask: {alert.get('task_id', 'N/A')}\nCompany: {alert.get('company', 'N/A')}\n\n"
        context.bot.send_message(chat_id=chat_id, text=response)
        return
    elif msg.lower() == "/risk":
        risk_report = load_json(RISK_REPORT, {})
        if not risk_report:
            context.bot.send_message(chat_id=chat_id, text="No risk report generated yet.")
            return
        response = f"Risk Report\n\nHigh Risk Tasks: {len(risk_report.get('high_risk_tasks', []))}\nBottleneck Predictions: {len(risk_report.get('bottleneck_predictions', []))}\nSLA At Risk: {len(risk_report.get('sla_at_risk', []))}\n\n"
        for task in risk_report.get("high_risk_tasks", [])[:5]:
            response += f"{task.get('task_id')}: {task.get('risk_score', 0)*100:.0f}% risk\n"
        context.bot.send_message(chat_id=chat_id, text=response)
        return
    else:
        task_id = str(int(time.time() * 1000))
        task = {"id": task_id, "desc": msg, "task_type": "generic", "assigned_company": random.choice(COMPANIES)}
        add_task(task)
        route_tasks_batch([task])
        context.bot.send_message(chat_id=chat_id, text=f"Task created: {task_id}\nCompany: {task['assigned_company']}\nDescription: {msg[:100]}...\n\nTask dispatched and processing.")

def start_telegram_bot():
    try:
        from telegram.ext import Updater, MessageHandler, Filters
        updater = Updater(TELEGRAM_TOKEN, use_context=True)
        dispatcher = updater.dispatcher
        dispatcher.add_handler(MessageHandler(Filters.text & ~Filters.command, telegram_handler))
        logger.info("Telegram bot starting...")
        updater.start_polling()
        updater.idle()
    except ImportError:
        logger.warning("python-telegram-bot not installed. Telegram features disabled.")
    except Exception as e:
        logger.error(f"Telegram bot error: {e}")

def auto_task_monitor():
    logger.info("Auto-task monitor started")
    while True:
        try:
            tasks = fetch_new_tasks()
            if tasks:
                logger.info(f"Auto-monitor found {len(tasks)} new tasks")
                route_tasks_batch(tasks)
            time.sleep(5)
        except Exception as e:
            logger.error(f"Auto-monitor error: {e}")
            time.sleep(10)

if __name__ == "__main__":
    print("=" * 60)
    print("SUPER AGENT OFFLINE FULL AUTONOMOUS + KPI-DRIVEN")
    print("=" * 60)
    BASE_PATH.mkdir(parents=True, exist_ok=True)
    WORKSPACE_PATH.mkdir(parents=True, exist_ok=True)
    LOG_PATH.mkdir(parents=True, exist_ok=True)
    KB_PATH.mkdir(parents=True, exist_ok=True)
    for path, default in [(TASK_DB, []), (ANALYTICS_PATH, []), (ALERTS_PATH, []), (EXECUTION_SUMMARY, []), (DECISION_LOG, [])]:
        if not path.exists(): save_json(path, default)
    self_learning_update()
    monitor_thread = threading.Thread(target=auto_task_monitor, daemon=True)
    monitor_thread.start()
    start_telegram_bot()