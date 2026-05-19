#!/usr/bin/env python3
"""
Super Agent Offline 1000x prototype with analytics and KPI dashboard.

This script builds on the 100x prototype but uses an isolated runtime state:
    .super-agent-1000x/

Runtime outputs are local-only:
- task_db.json
- workspace sandbox patches
- snapshots
- logs/events.jsonl
- analytics.json
- dashboard.html
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows fallback
    fcntl = None


ROOT = Path(__file__).resolve().parents[1]
PROTOTYPES_DIR = ROOT / "prototypes"
if str(PROTOTYPES_DIR) not in sys.path:
    sys.path.insert(0, str(PROTOTYPES_DIR))

from super_agent_offline_100x import (  # noqa: E402
    AgentResult,
    CompanyProfile,
    OfflineTask,
    PatchSandbox,
    SuperAgent100x,
    TaskDB,
    classify_task,
    format_summary,
    load_company_kb,
    parse_patch,
    score_keywords,
    stable_id,
    utc_now,
)


STATE_DIR = ROOT / ".super-agent-1000x"
WORKSPACE_DIR = STATE_DIR / "workspace"
SNAPSHOT_DIR = STATE_DIR / "snapshots"
TASK_DB_PATH = STATE_DIR / "task_db.json"
LOG_DIR = STATE_DIR / "logs"
ANALYTICS_PATH = STATE_DIR / "analytics.json"
DASHBOARD_PATH = STATE_DIR / "dashboard.html"
MAX_WORKERS = 128


BASE_COMPANIES: tuple[CompanyProfile, ...] = (
    CompanyProfile(
        id="rnd",
        name="R&D",
        mission="Prototype new capabilities, experiments, benchmark design, and research-heavy work.",
        keywords=("research", "prototype", "experiment", "benchmark", "innovation", "r&d"),
        scale_units=1000,
    ),
    CompanyProfile(
        id="engineering",
        name="Engineering",
        mission="Own implementation quality, build systems, production readiness, and reliability.",
        keywords=("engineering", "build", "fix", "bug", "test", "lint", "deploy", "module"),
        scale_units=1000,
    ),
    CompanyProfile(
        id="it_ai",
        name="IT_AI",
        mission="Own AI workflows, local agents, code automation, LLM routing, and Telegram bridge.",
        keywords=("ai", "agent", "code", "coding", "llm", "telegram", "visual studio", "vs", "parser"),
        scale_units=1000,
    ),
    CompanyProfile(
        id="finance_invest",
        name="Finance_Invest",
        mission="Own payment, ledger, accounting, investment, tax, and finance controls.",
        keywords=("finance", "payment", "invoice", "ledger", "accounting", "tax", "investment"),
        scale_units=1000,
    ),
    CompanyProfile(
        id="marketing",
        name="Marketing",
        mission="Own growth, reports, campaign work, positioning, SEO, and customer narratives.",
        keywords=("marketing", "sales", "report", "seo", "campaign", "brand", "customer"),
        scale_units=1000,
    ),
    CompanyProfile(
        id="logistics",
        name="Logistics",
        mission="Own operations, routing, delivery, resource planning, and incident movement.",
        keywords=("logistics", "supply", "routing", "delivery", "ops", "operation", "warehouse"),
        scale_units=1000,
    ),
    CompanyProfile(
        id="hr_culture",
        name="HR_Culture",
        mission="Own hiring, team design, culture, training, handbook, and internal standards.",
        keywords=("hr", "hiring", "jd", "people", "culture", "training", "handbook"),
        scale_units=1000,
    ),
    CompanyProfile(
        id="legal_compliance",
        name="Legal_Compliance",
        mission="Own legal, compliance, audit, policy, risk, and governance review.",
        keywords=("legal", "compliance", "audit", "policy", "risk", "contract", "governance"),
        scale_units=1000,
    ),
)


SPECIALIST_COMPANIES: tuple[CompanyProfile, ...] = tuple(
    CompanyProfile(
        id=f"company_{index:02d}",
        name=f"Company_{index:02d}",
        mission=f"Specialist autonomous unit {index:02d} for overflow, batch work, and domain-specific execution.",
        keywords=(f"company_{index:02d}", f"unit-{index:02d}", "batch", "overflow", "scale"),
        scale_units=1000,
    )
    for index in range(9, 21)
)


COMPANIES_1000X = BASE_COMPANIES + SPECIALIST_COMPANIES


class AnalyticsStore:
    def __init__(self, path: Path = ANALYTICS_PATH, dashboard_path: Path = DASHBOARD_PATH):
        self.path = path
        self.dashboard_path = dashboard_path
        self.lock_path = self.path.with_suffix(".lock")
        self.lock = threading.RLock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._write({"events": [], "kpi": self._empty_kpi()})

    @contextlib.contextmanager
    def _file_lock(self):
        self.lock_path.parent.mkdir(parents=True, exist_ok=True)
        with self.lock_path.open("a+", encoding="utf-8") as handle:
            if fcntl:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                if fcntl:
                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    def _read(self) -> dict[str, Any]:
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, FileNotFoundError):
            data = {"events": [], "kpi": self._empty_kpi()}
        if not isinstance(data.get("events"), list):
            data["events"] = []
        return data

    def _write(self, data: dict[str, Any]) -> None:
        tmp = self.path.with_name(f"{self.path.name}.{os.getpid()}.{threading.get_ident()}.tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, self.path)

    def record(self, event: dict[str, Any]) -> dict[str, Any]:
        row = self._event_to_row(event)
        with self.lock, self._file_lock():
            data = self._read()
            data["events"].append(row)
            data["kpi"] = self.compute_kpi(data["events"])
            self._write(data)
            self.render_dashboard(data)
            return data["kpi"]

    def load_kpi(self) -> dict[str, Any]:
        with self.lock, self._file_lock():
            data = self._read()
            data["kpi"] = self.compute_kpi(data["events"])
            self._write(data)
            self.render_dashboard(data)
            return data["kpi"]

    def render_dashboard(self, data: dict[str, Any] | None = None) -> Path:
        data = data or self._read()
        kpi = data.get("kpi") or self.compute_kpi(data.get("events", []))
        by_company = kpi.get("by_company", {})
        company_rows = "\n".join(
            f"<tr><td>{name}</td><td>{stats['total']}</td><td>{stats['qa_failed']}</td><td>{stats['rollback_count']}</td></tr>"
            for name, stats in sorted(by_company.items())
        )
        html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Super Agent Offline 1000x Dashboard</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #17202a; }}
    main {{ max-width: 1120px; margin: 0 auto; }}
    h1 {{ font-size: 28px; margin-bottom: 4px; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 20px 0; }}
    .metric {{ border: 1px solid #d8dee9; border-radius: 8px; padding: 14px; background: #f8fafc; }}
    .metric strong {{ display: block; font-size: 24px; margin-top: 8px; }}
    table {{ border-collapse: collapse; width: 100%; margin-top: 16px; }}
    th, td {{ border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }}
    th {{ background: #f3f4f6; }}
    code {{ background: #eef2f7; padding: 2px 5px; border-radius: 4px; }}
  </style>
</head>
<body>
  <main>
    <h1>Super Agent Offline 1000x Dashboard</h1>
    <p>Generated at <code>{kpi.get('generated_at')}</code>. Runtime state stays local under <code>.super-agent-1000x/</code>.</p>
    <section class="grid">
      <div class="metric">Total tasks<strong>{kpi['total_tasks']}</strong></div>
      <div class="metric">Throughput/hour<strong>{kpi['throughput_last_hour']}</strong></div>
      <div class="metric">Dev success rate<strong>{kpi['dev_success_rate']:.2%}</strong></div>
      <div class="metric">QA fail rate<strong>{kpi['qa_fail_rate']:.2%}</strong></div>
      <div class="metric">Rollback rate<strong>{kpi['rollback_rate']:.2%}</strong></div>
      <div class="metric">Review queue<strong>{kpi['review_required']}</strong></div>
    </section>
    <h2>Company KPI</h2>
    <table>
      <thead><tr><th>Company</th><th>Total</th><th>QA failed</th><th>Rollbacks</th></tr></thead>
      <tbody>{company_rows}</tbody>
    </table>
  </main>
</body>
</html>
"""
        self.dashboard_path.write_text(html, encoding="utf-8")
        return self.dashboard_path

    @staticmethod
    def _event_to_row(event: dict[str, Any]) -> dict[str, Any]:
        task = event.get("task", {})
        company = event.get("company", {})
        dev = event.get("dev", {})
        qa = event.get("qa", {})
        return {
            "task_id": task.get("id"),
            "task_type": task.get("task_type"),
            "company": company.get("name"),
            "company_id": company.get("id"),
            "dev_status": dev.get("status"),
            "qa_status": qa.get("status"),
            "rollback": bool(event.get("rollback")),
            "timestamp": event.get("logged_at") or utc_now(),
        }

    @staticmethod
    def compute_kpi(events: list[dict[str, Any]]) -> dict[str, Any]:
        total = len(events)
        dev_success = sum(1 for event in events if event.get("dev_status") == "patched-in-sandbox")
        qa_failed = sum(1 for event in events if event.get("qa_status") == "failed")
        rollbacks = sum(1 for event in events if event.get("rollback"))
        review_required = sum(1 for event in events if event.get("qa_status") == "review-required")
        now_ts = time.time()
        throughput_last_hour = sum(1 for event in events if _within_last_hour(event.get("timestamp"), now_ts))

        by_company: dict[str, dict[str, int]] = {}
        by_task_type: dict[str, int] = {}
        for event in events:
            company = event.get("company") or "unknown"
            task_type = event.get("task_type") or "unknown"
            by_company.setdefault(company, {"total": 0, "qa_failed": 0, "rollback_count": 0})
            by_company[company]["total"] += 1
            by_company[company]["qa_failed"] += 1 if event.get("qa_status") == "failed" else 0
            by_company[company]["rollback_count"] += 1 if event.get("rollback") else 0
            by_task_type[task_type] = by_task_type.get(task_type, 0) + 1

        return {
            "generated_at": utc_now(),
            "total_tasks": total,
            "throughput_last_hour": throughput_last_hour,
            "dev_success_rate": dev_success / total if total else 0,
            "qa_fail_rate": qa_failed / total if total else 0,
            "rollback_rate": rollbacks / total if total else 0,
            "rollback_count": rollbacks,
            "review_required": review_required,
            "by_company": by_company,
            "by_task_type": by_task_type,
        }

    @staticmethod
    def _empty_kpi() -> dict[str, Any]:
        return {
            "generated_at": utc_now(),
            "total_tasks": 0,
            "throughput_last_hour": 0,
            "dev_success_rate": 0,
            "qa_fail_rate": 0,
            "rollback_rate": 0,
            "rollback_count": 0,
            "review_required": 0,
            "by_company": {},
            "by_task_type": {},
        }


class SuperAgent1000x(SuperAgent100x):
    def __init__(self, db: TaskDB | None = None, workers: int = MAX_WORKERS, analytics: AnalyticsStore | None = None):
        self.db = db or TaskDB1000x(TASK_DB_PATH)
        self.workers = min(max(workers, 1), MAX_WORKERS)
        self.patch_sandbox = PatchSandbox(WORKSPACE_DIR, SNAPSHOT_DIR)
        self.analytics = analytics or AnalyticsStore()

    def _process_task_if_claimed(self, task: OfflineTask) -> dict[str, Any] | None:
        if not self.db.claim(task.id):
            return None
        try:
            event = self.execute(task)
            final_status = "done" if event["qa"]["status"] != "failed" else "failed"
            self.db.complete(task.id, final_status, event)
            event["kpi"] = self.analytics.record(event)
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
        enriched = enrich_task_1000x(task)
        company = get_company_1000x(enriched.assigned_company)
        prompt = generate_prompt_1000x(enriched, company)

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
        log_event_1000x(event)
        return event

    def _dev_autopatch(self, task: OfflineTask, company: CompanyProfile, prompt: str) -> AgentResult:
        patch_result = self.patch_sandbox.apply_patch(task)
        return AgentResult(
            role="Dev",
            company=company.name,
            status="patched-in-sandbox",
            summary=f"1000x Dev worker applied sandbox patch for {task.id}.",
            details={
                "prompt_digest": stable_id("prompt", prompt),
                "patch_result": patch_result,
                "verification_commands": ["python3 -m py_compile prototypes/super_agent_offline_1000x.py"],
            },
        )

    def _qa_audit(self, task: OfflineTask, company: CompanyProfile, prompt: str) -> AgentResult:
        risk_terms = ("payment", "auth", "security", "ledger", "deploy", "token", "secret")
        risky = any(term in task.desc.lower() for term in risk_terms)
        forced_fail = "[qa-fail]" in task.desc.lower()
        status = "failed" if forced_fail else "review-required" if risky else "passed"
        return AgentResult(
            role="QA",
            company=company.name,
            status=status,
            summary=f"1000x QA worker completed audit for {task.id}.",
            details={
                "prompt_digest": stable_id("qa", prompt),
                "risk_level": "medium" if risky else "low",
                "continuous_checks": [
                    "sandbox-boundary",
                    "snapshot-created",
                    "rollback-available",
                    "offline-policy",
                    "analytics-recorded",
                    "kpi-dashboard-refresh",
                ],
            },
        )


def _within_last_hour(timestamp: str | None, now_ts: float) -> bool:
    if not timestamp:
        return False
    try:
        parsed = datetime.fromisoformat(timestamp)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return now_ts - parsed.timestamp() <= 3600
    except ValueError:
        return False


class TaskDB1000x(TaskDB):
    def _write(self, rows: list[dict[str, Any]]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_name(f"{self.path.name}.{os.getpid()}.{threading.get_ident()}.tmp")
        tmp.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, self.path)


def select_company_1000x(task_text: str, task_type: str) -> CompanyProfile:
    normalized = f"{task_text} {task_type}".lower()
    scored = []
    for company in COMPANIES_1000X:
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
    return scored[0][0] if scored[0][1] > 0 else get_company_1000x("it_ai")


def enrich_task_1000x(task: OfflineTask) -> OfflineTask:
    task_type = task.task_type or classify_task(task.desc)
    company = get_company_1000x(task.assigned_company) if task.assigned_company else select_company_1000x(task.desc, task_type)
    task.task_type = task_type
    task.assigned_company = company.id
    task.updated_at = utc_now()
    return task


def get_company_1000x(company_id: str | None) -> CompanyProfile:
    for company in COMPANIES_1000X:
        if company.id == company_id:
            return company
    return next(company for company in COMPANIES_1000X if company.id == "it_ai")


def generate_prompt_1000x(task: OfflineTask, company: CompanyProfile) -> str:
    kb_data = load_company_kb(company.id)
    context = kb_data.get("context") or kb_data.get("summary") or json.dumps(kb_data)[:1200]
    return "\n".join(
        [
            f"[{company.name} 1000x PROMPT]",
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
            "- Auto-patch only inside .super-agent-1000x/workspace.",
            "- Create a snapshot before mutation.",
            "- Roll back automatically if QA fails.",
            "- Record analytics and refresh dashboard after every task.",
        ]
    )


def log_event_1000x(event: dict[str, Any]) -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = LOG_DIR / "events.jsonl"
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    return path


def start_telegram_bot_1000x(agent: SuperAgent1000x) -> None:
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
            await update.message.reply_text(format_kpi_text(kpi))
            return
        task = agent.db.add(text, source="telegram")
        await update.message.reply_text(f"Queued offline 1000x task {task.id}.")

    app = ApplicationBuilder().token(token).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, telegram_handler))
    print("[TELEGRAM BOT STARTED] 1000x offline task queue is listening.")
    app.run_polling()


def format_kpi_text(kpi: dict[str, Any]) -> str:
    return "\n".join(
        [
            "Super Agent 1000x KPI",
            f"Total tasks: {kpi['total_tasks']}",
            f"Throughput/hour: {kpi['throughput_last_hour']}",
            f"Dev success rate: {kpi['dev_success_rate']:.2%}",
            f"QA fail rate: {kpi['qa_fail_rate']:.2%}",
            f"Rollback rate: {kpi['rollback_rate']:.2%}",
            f"Review queue: {kpi['review_required']}",
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Super Agent Offline 1000x prototype")
    parser.add_argument("--task", action="append", help="Add task(s) to offline DB before processing.")
    parser.add_argument("--patch", help="JSON patch object for the last --task.")
    parser.add_argument("--once", action="store_true", help="Process pending DB tasks once and exit.")
    parser.add_argument("--monitor", action="store_true", help="Continuously monitor offline task DB.")
    parser.add_argument("--interval", type=float, default=2.0, help="Monitor polling interval in seconds.")
    parser.add_argument("--workers", type=int, default=MAX_WORKERS, help="Worker count, capped at 128.")
    parser.add_argument("--telegram", action="store_true", help="Start optional Telegram adapter.")
    parser.add_argument("--dashboard", action="store_true", help="Refresh and print KPI dashboard paths.")
    parser.add_argument("--json", action="store_true", help="Print JSON for --once output.")
    args = parser.parse_args()

    agent = SuperAgent1000x(workers=args.workers)

    patches = [None] * len(args.task or [])
    if args.patch and args.task:
        patches[-1] = parse_patch(args.patch)

    for desc, patch in zip(args.task or [], patches):
        task = agent.seed_task(desc, patch=patch)
        print(f"Queued {task.id}: {task.desc}")

    if args.telegram:
        telegram_thread = threading.Thread(target=start_telegram_bot_1000x, args=(agent,), daemon=True)
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
        print(format_kpi_text(kpi))
        print(f"Analytics: {ANALYTICS_PATH.relative_to(ROOT)}")
        print(f"Dashboard: {DASHBOARD_PATH.relative_to(ROOT)}")

    if args.telegram and not args.monitor:
        print("Telegram adapter started. Use --monitor to keep processing queued tasks continuously.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
