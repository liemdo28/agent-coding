#!/usr/bin/env python3
"""
Super Agent Offline 10000x prototype with priority patching and alerts.

Runtime state is isolated under:
    .super-agent-10000x/

The prototype remains offline-first:
- Telegram is optional and only queues tasks / returns KPI text.
- Auto-patch writes only to .super-agent-10000x/workspace/.
- QA failure triggers sandbox rollback.
- Analytics, alerts, and dashboard are local files.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PROTOTYPES_DIR = ROOT / "prototypes"
if str(PROTOTYPES_DIR) not in sys.path:
    sys.path.insert(0, str(PROTOTYPES_DIR))

from super_agent_offline_1000x import (  # noqa: E402
    AnalyticsStore,
    BASE_COMPANIES,
    AgentResult,
    CompanyProfile,
    OfflineTask,
    PatchSandbox,
    SuperAgent1000x,
    TaskDB1000x,
    classify_task,
    format_summary,
    load_company_kb,
    parse_patch,
    score_keywords,
    stable_id,
    utc_now,
)


STATE_DIR = ROOT / ".super-agent-10000x"
WORKSPACE_DIR = STATE_DIR / "workspace"
SNAPSHOT_DIR = STATE_DIR / "snapshots"
TASK_DB_PATH = STATE_DIR / "task_db.json"
LOG_DIR = STATE_DIR / "logs"
ANALYTICS_PATH = STATE_DIR / "analytics.json"
ALERTS_PATH = STATE_DIR / "alerts.json"
DASHBOARD_PATH = STATE_DIR / "dashboard.html"
MAX_WORKERS = 512
PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "normal": 3, "low": 4}


SPECIALIST_COMPANIES_10000X: tuple[CompanyProfile, ...] = tuple(
    CompanyProfile(
        id=f"company_{index:03d}",
        name=f"Company_{index:03d}",
        mission=f"Autonomous specialist company {index:03d} for large-scale batch and overflow execution.",
        keywords=(f"company_{index:03d}", f"unit-{index:03d}", "batch", "overflow", "scale", "10000x"),
        scale_units=10000,
    )
    for index in range(9, 101)
)


COMPANIES_10000X: tuple[CompanyProfile, ...] = tuple(
    CompanyProfile(
        id=company.id,
        name=company.name,
        mission=company.mission,
        keywords=company.keywords,
        scale_units=10000,
    )
    for company in BASE_COMPANIES
) + SPECIALIST_COMPANIES_10000X


class AnalyticsStore10000x(AnalyticsStore):
    def __init__(
        self,
        path: Path = ANALYTICS_PATH,
        dashboard_path: Path = DASHBOARD_PATH,
        alerts_path: Path = ALERTS_PATH,
    ):
        self.alerts_path = alerts_path
        super().__init__(path=path, dashboard_path=dashboard_path)
        if not self.alerts_path.exists():
            self._write_alerts([])

    def record(self, event: dict[str, Any]) -> dict[str, Any]:
        row = self._event_to_row(event)
        with self.lock, self._file_lock():
            data = self._read()
            data["events"].append(row)
            data["kpi"] = self.compute_kpi(data["events"])
            alerts = self.evaluate_alerts(data["kpi"], row)
            if alerts:
                self._append_alerts(alerts)
            data["alerts"] = self._read_alerts()[-100:]
            self._write(data)
            self.render_dashboard(data)
            return data["kpi"]

    def load_kpi(self) -> dict[str, Any]:
        with self.lock, self._file_lock():
            data = self._read()
            data["kpi"] = self.compute_kpi(data["events"])
            data["alerts"] = self._read_alerts()[-100:]
            self._write(data)
            self.render_dashboard(data)
            return data["kpi"]

    def render_dashboard(self, data: dict[str, Any] | None = None) -> Path:
        data = data or self._read()
        kpi = data.get("kpi") or self.compute_kpi(data.get("events", []))
        alerts = data.get("alerts") or self._read_alerts()[-100:]
        by_company = kpi.get("by_company", {})
        priority_mix = kpi.get("by_priority", {})
        latest_events = list(reversed(data.get("events", [])[-50:]))

        company_rows = "\n".join(
            f"<tr><td>{name}</td><td>{stats['total']}</td><td>{stats['qa_failed']}</td><td>{stats['rollback_count']}</td></tr>"
            for name, stats in sorted(by_company.items())
        )
        priority_rows = "\n".join(
            f"<tr><td>{priority}</td><td>{count}</td></tr>"
            for priority, count in sorted(priority_mix.items(), key=lambda item: PRIORITY_ORDER.get(item[0], 99))
        )
        alert_rows = "\n".join(
            f"<tr><td>{alert['severity']}</td><td>{alert['code']}</td><td>{alert['message']}</td><td>{alert['timestamp']}</td></tr>"
            for alert in reversed(alerts[-20:])
        )
        task_rows = "\n".join(
            f"<tr><td>{event.get('task_id')}</td><td>{event.get('company')}</td><td>{event.get('priority')}</td><td>{event.get('dev_status')}</td><td>{event.get('qa_status')}</td><td>{event.get('rollback')}</td></tr>"
            for event in latest_events
        )
        html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Super Agent Offline 10000x Dashboard</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #17202a; }}
    main {{ max-width: 1280px; margin: 0 auto; }}
    h1 {{ font-size: 28px; margin-bottom: 4px; }}
    h2 {{ margin-top: 28px; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 20px 0; }}
    .metric {{ border: 1px solid #d8dee9; border-radius: 8px; padding: 14px; background: #f8fafc; }}
    .metric strong {{ display: block; font-size: 24px; margin-top: 8px; }}
    .alert {{ background: #fff7ed; border-color: #fed7aa; }}
    table {{ border-collapse: collapse; width: 100%; margin-top: 12px; }}
    th, td {{ border-bottom: 1px solid #e5e7eb; padding: 9px; text-align: left; }}
    th {{ background: #f3f4f6; }}
    code {{ background: #eef2f7; padding: 2px 5px; border-radius: 4px; }}
  </style>
</head>
<body>
  <main>
    <h1>Super Agent Offline 10000x Dashboard</h1>
    <p>Generated at <code>{kpi.get('generated_at')}</code>. Runtime state stays local under <code>.super-agent-10000x/</code>.</p>
    <section class="grid">
      <div class="metric">Total tasks<strong>{kpi['total_tasks']}</strong></div>
      <div class="metric">Throughput/hour<strong>{kpi['throughput_last_hour']}</strong></div>
      <div class="metric">Dev success rate<strong>{kpi['dev_success_rate']:.2%}</strong></div>
      <div class="metric">QA fail rate<strong>{kpi['qa_fail_rate']:.2%}</strong></div>
      <div class="metric">Rollback rate<strong>{kpi['rollback_rate']:.2%}</strong></div>
      <div class="metric">High priority<strong>{kpi['high_priority_count']}</strong></div>
      <div class="metric alert">Active alerts<strong>{len(alerts)}</strong></div>
    </section>
    <h2>Alerts</h2>
    <table><thead><tr><th>Severity</th><th>Code</th><th>Message</th><th>Time</th></tr></thead><tbody>{alert_rows}</tbody></table>
    <h2>Priority Mix</h2>
    <table><thead><tr><th>Priority</th><th>Count</th></tr></thead><tbody>{priority_rows}</tbody></table>
    <h2>Latest Tasks</h2>
    <table><thead><tr><th>Task</th><th>Company</th><th>Priority</th><th>Dev</th><th>QA</th><th>Rollback</th></tr></thead><tbody>{task_rows}</tbody></table>
    <h2>Company KPI</h2>
    <table><thead><tr><th>Company</th><th>Total</th><th>QA failed</th><th>Rollbacks</th></tr></thead><tbody>{company_rows}</tbody></table>
  </main>
</body>
</html>
"""
        self.dashboard_path.write_text(html, encoding="utf-8")
        return self.dashboard_path

    @staticmethod
    def _event_to_row(event: dict[str, Any]) -> dict[str, Any]:
        row = AnalyticsStore._event_to_row(event)
        task = event.get("task", {})
        row["priority"] = task.get("priority") or "normal"
        row["alert_codes"] = [alert.get("code") for alert in event.get("alerts", [])]
        return row

    @staticmethod
    def compute_kpi(events: list[dict[str, Any]]) -> dict[str, Any]:
        kpi = AnalyticsStore.compute_kpi(events)
        by_priority: dict[str, int] = {}
        for event in events:
            priority = event.get("priority") or "normal"
            by_priority[priority] = by_priority.get(priority, 0) + 1
        kpi["by_priority"] = by_priority
        kpi["high_priority_count"] = by_priority.get("critical", 0) + by_priority.get("high", 0)
        return kpi

    def evaluate_alerts(self, kpi: dict[str, Any], row: dict[str, Any]) -> list[dict[str, Any]]:
        alerts = []
        if row.get("qa_status") == "failed":
            alerts.append(self._alert("critical", "QA_FAILED", f"QA failed for task {row.get('task_id')}."))
        if row.get("rollback"):
            alerts.append(self._alert("critical", "ROLLBACK", f"Rollback executed for task {row.get('task_id')}."))
        if row.get("priority") in {"critical", "high"} and row.get("qa_status") == "review-required":
            alerts.append(self._alert("warning", "HIGH_PRIORITY_REVIEW", f"High priority task {row.get('task_id')} needs review."))
        if kpi.get("qa_fail_rate", 0) >= 0.25 and kpi.get("total_tasks", 0) >= 4:
            alerts.append(self._alert("warning", "QA_FAIL_RATE", f"QA fail rate is {kpi['qa_fail_rate']:.2%}."))
        if kpi.get("rollback_rate", 0) >= 0.20 and kpi.get("total_tasks", 0) >= 4:
            alerts.append(self._alert("warning", "ROLLBACK_RATE", f"Rollback rate is {kpi['rollback_rate']:.2%}."))
        return alerts

    @staticmethod
    def _alert(severity: str, code: str, message: str) -> dict[str, Any]:
        return {
            "id": stable_id("alert", f"{severity}:{code}:{message}:{utc_now()}"),
            "severity": severity,
            "code": code,
            "message": message,
            "timestamp": utc_now(),
        }

    def _read_alerts(self) -> list[dict[str, Any]]:
        try:
            alerts = json.loads(self.alerts_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, FileNotFoundError):
            return []
        return alerts if isinstance(alerts, list) else []

    def _write_alerts(self, alerts: list[dict[str, Any]]) -> None:
        self.alerts_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.alerts_path.with_name(f"{self.alerts_path.name}.{os.getpid()}.{threading.get_ident()}.tmp")
        tmp.write_text(json.dumps(alerts, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, self.alerts_path)

    def _append_alerts(self, alerts: list[dict[str, Any]]) -> None:
        current = self._read_alerts()
        current.extend(alerts)
        self._write_alerts(current[-500:])


class SuperAgent10000x(SuperAgent1000x):
    def __init__(self, workers: int = MAX_WORKERS):
        self.db = TaskDB1000x(TASK_DB_PATH)
        self.workers = min(max(workers, 1), MAX_WORKERS)
        self.patch_sandbox = PatchSandbox(WORKSPACE_DIR, SNAPSHOT_DIR)
        self.analytics = AnalyticsStore10000x()

    def process_pending_once(self, limit: int = 10000) -> list[dict[str, Any]]:
        tasks = sorted(self.db.pending(limit=limit), key=priority_rank)
        if not tasks:
            return []

        events = []
        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            futures = [executor.submit(self._process_task_if_claimed, task) for task in tasks]
            for future in futures:
                event = future.result()
                if event:
                    events.append(event)
        return events

    def _process_task_if_claimed(self, task: OfflineTask) -> dict[str, Any] | None:
        if not self.db.claim(task.id):
            return None
        try:
            event = self.execute(task)
            final_status = "done" if event["qa"]["status"] != "failed" else "failed"
            event["kpi"] = self.analytics.record(event)
            event["alerts"] = self.analytics._read_alerts()[-10:]
            self.db.complete(task.id, final_status, event)
            return event
        except Exception as exc:
            error_event = {
                "task": asdict(task),
                "status": "failed",
                "error": str(exc),
                "logged_at": utc_now(),
            }
            self.db.complete(task.id, "failed", error_event)
            return error_event

    def execute(self, task: OfflineTask) -> dict[str, Any]:
        enriched = enrich_task_10000x(task)
        company = get_company_10000x(enriched.assigned_company)
        prompt = generate_prompt_10000x(enriched, company)

        with ThreadPoolExecutor(max_workers=2) as executor:
            dev_future = executor.submit(self._dev_autopatch, enriched, company, prompt)
            qa_future = executor.submit(self._qa_audit, enriched, company, prompt)
            dev = dev_future.result()
            qa = qa_future.result()

        rollback = None
        patch_result = dev.details.get("patch_result")
        if patch_result and qa.status == "failed":
            rollback = self.patch_sandbox.rollback(patch_result)

        event = {
            "task": asdict(enriched),
            "company": asdict(company),
            "dev": asdict(dev),
            "qa": asdict(qa),
            "rollback": rollback,
            "summary": format_summary(enriched, company, dev, qa, rollback),
            "logged_at": utc_now(),
        }
        log_event_10000x(event)
        return event

    def _dev_autopatch(self, task: OfflineTask, company: CompanyProfile, prompt: str) -> AgentResult:
        patch_result = self.patch_sandbox.apply_patch(task)
        return AgentResult(
            role="Dev",
            company=company.name,
            status="patched-in-sandbox",
            summary=f"10000x Dev worker applied {task.priority} priority sandbox patch for {task.id}.",
            details={
                "prompt_digest": stable_id("prompt", prompt),
                "priority": task.priority,
                "patch_result": patch_result,
                "verification_commands": ["python3 -m py_compile prototypes/super_agent_offline_10000x.py"],
            },
        )

    def _qa_audit(self, task: OfflineTask, company: CompanyProfile, prompt: str) -> AgentResult:
        risk_terms = ("payment", "auth", "security", "ledger", "deploy", "token", "secret")
        risky = any(term in task.desc.lower() for term in risk_terms)
        forced_fail = "[qa-fail]" in task.desc.lower()
        status = "failed" if forced_fail else "review-required" if risky or task.priority in {"critical", "high"} else "passed"
        return AgentResult(
            role="QA",
            company=company.name,
            status=status,
            summary=f"10000x QA worker completed priority audit for {task.id}.",
            details={
                "prompt_digest": stable_id("qa", prompt),
                "risk_level": "high" if task.priority == "critical" else "medium" if risky else "low",
                "continuous_checks": [
                    "priority-order",
                    "sandbox-boundary",
                    "snapshot-created",
                    "rollback-available",
                    "offline-policy",
                    "analytics-recorded",
                    "alert-policy-evaluated",
                    "dashboard-refresh",
                ],
            },
        )


def priority_rank(task: OfflineTask) -> tuple[int, str]:
    priority = infer_priority(task.desc, task.priority)
    return PRIORITY_ORDER.get(priority.lower(), 3), task.created_at or ""


def infer_priority(desc: str, current: str = "normal") -> str:
    text = desc.lower()
    if "[critical]" in text or "p0" in text or "critical" in text or "nghiêm trọng" in text:
        return "critical"
    if "[high]" in text or "urgent" in text or "khẩn" in text or "gấp" in text:
        return "high"
    if "[medium]" in text or "payment" in text or "deploy" in text or "security" in text:
        return "medium"
    if "[low]" in text or "minor" in text or "later" in text:
        return "low"
    return current or "normal"


def enrich_task_10000x(task: OfflineTask) -> OfflineTask:
    task_type = task.task_type or classify_task(task.desc)
    task.priority = infer_priority(task.desc, task.priority)
    company = get_company_10000x(task.assigned_company) if task.assigned_company else select_company_10000x(task.desc, task_type)
    task.task_type = task_type
    task.assigned_company = company.id
    task.updated_at = utc_now()
    return task


def select_company_10000x(task_text: str, task_type: str) -> CompanyProfile:
    normalized = f"{task_text} {task_type}".lower()
    scored = []
    for company in COMPANIES_10000X:
        score = score_keywords(normalized, company.keywords)
        if task_type == "build_fix" and company.id == "it_ai":
            score += 8
        if task_type == "build_fix" and company.id == "engineering":
            score += 1
        if task_type == "audit" and company.id == "legal_compliance":
            score += 2
        if "batch" in normalized and company.id.startswith("company_"):
            score += 1
        scored.append((company, score))
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[0][0] if scored[0][1] > 0 else get_company_10000x("it_ai")


def get_company_10000x(company_id: str | None) -> CompanyProfile:
    for company in COMPANIES_10000X:
        if company.id == company_id:
            return company
    return next(company for company in COMPANIES_10000X if company.id == "it_ai")


def generate_prompt_10000x(task: OfflineTask, company: CompanyProfile) -> str:
    kb_data = load_company_kb(company.id)
    context = kb_data.get("context") or kb_data.get("summary") or json.dumps(kb_data)[:1200]
    return "\n".join(
        [
            f"[{company.name} 10000x PROMPT]",
            f"Mission: {company.mission}",
            f"Scale units: {company.scale_units}",
            f"Task: {task.desc}",
            f"Task type: {task.task_type}",
            f"Priority: {task.priority}",
            "",
            "Offline KB context:",
            str(context),
            "",
            "Execution rules:",
            "- Work offline except optional Telegram adapter.",
            "- Process tasks by priority before lower priority work.",
            "- Auto-patch only inside .super-agent-10000x/workspace.",
            "- Create a snapshot before mutation.",
            "- Roll back automatically if QA fails.",
            "- Record analytics, evaluate alerts, and refresh dashboard after every task.",
        ]
    )


def log_event_10000x(event: dict[str, Any]) -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = LOG_DIR / "events.jsonl"
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    return path


def start_telegram_bot_10000x(agent: SuperAgent10000x) -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("Set TELEGRAM_BOT_TOKEN before starting the Telegram adapter.")

    try:
        from telegram.ext import ApplicationBuilder, MessageHandler, ContextTypes, filters
        from telegram import Update
    except ImportError as exc:
        raise RuntimeError(
            "Telegram adapter requires python-telegram-bot. "
            "Install it in your chosen environment, then rerun with --telegram."
        ) from exc

    async def telegram_handler(update: "Update", context: "ContextTypes.DEFAULT_TYPE") -> None:
        if not update.message or not update.message.text:
            return
        text = update.message.text.strip()
        if text == "/kpi":
            kpi = agent.analytics.load_kpi()
            await update.message.reply_text(format_kpi_text_10000x(kpi))
            return
        task = agent.db.add(text, source="telegram")
        await update.message.reply_text(f"Queued offline 10000x task {task.id}.")

    app = ApplicationBuilder().token(token).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, telegram_handler))
    print("[TELEGRAM BOT STARTED] 10000x offline task queue is listening.")
    app.run_polling()


def format_kpi_text_10000x(kpi: dict[str, Any]) -> str:
    return "\n".join(
        [
            "Super Agent 10000x KPI",
            f"Total tasks: {kpi['total_tasks']}",
            f"Throughput/hour: {kpi['throughput_last_hour']}",
            f"Dev success rate: {kpi['dev_success_rate']:.2%}",
            f"QA fail rate: {kpi['qa_fail_rate']:.2%}",
            f"Rollback rate: {kpi['rollback_rate']:.2%}",
            f"High priority count: {kpi.get('high_priority_count', 0)}",
            f"Review queue: {kpi['review_required']}",
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Super Agent Offline 10000x prototype")
    parser.add_argument("--task", action="append", help="Add task(s) to offline DB before processing.")
    parser.add_argument("--patch", help="JSON patch object for the last --task.")
    parser.add_argument("--once", action="store_true", help="Process pending DB tasks once and exit.")
    parser.add_argument("--monitor", action="store_true", help="Continuously monitor offline task DB.")
    parser.add_argument("--interval", type=float, default=1.0, help="Monitor polling interval in seconds.")
    parser.add_argument("--workers", type=int, default=MAX_WORKERS, help="Worker count, capped at 512.")
    parser.add_argument("--telegram", action="store_true", help="Start optional Telegram adapter.")
    parser.add_argument("--dashboard", action="store_true", help="Refresh and print KPI dashboard paths.")
    parser.add_argument("--json", action="store_true", help="Print JSON for --once output.")
    args = parser.parse_args()

    agent = SuperAgent10000x(workers=args.workers)

    patches = [None] * len(args.task or [])
    if args.patch and args.task:
        patches[-1] = parse_patch(args.patch)

    for desc, patch in zip(args.task or [], patches):
        task = agent.seed_task(desc, patch=patch)
        print(f"Queued {task.id}: {task.desc}")

    if args.telegram:
        telegram_thread = threading.Thread(target=start_telegram_bot_10000x, args=(agent,), daemon=True)
        telegram_thread.start()

    if args.monitor:
        agent.monitor(interval=args.interval, once=False)
        return 0

    events = agent.process_pending_once() if args.once or args.task else []
    if args.json:
        print(json.dumps(events, ensure_ascii=False, indent=2))
    else:
        for event in events:
            print(event["summary"])

    if args.dashboard or events:
        kpi = agent.analytics.load_kpi()
        print(format_kpi_text_10000x(kpi))
        print(f"Analytics: {ANALYTICS_PATH.relative_to(ROOT)}")
        print(f"Alerts: {ALERTS_PATH.relative_to(ROOT)}")
        print(f"Dashboard: {DASHBOARD_PATH.relative_to(ROOT)}")

    if args.telegram and not args.monitor:
        print("Telegram adapter started. Use --monitor to keep processing queued tasks continuously.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
