#!/usr/bin/env python3
"""
Super Agent Offline AI Decision prototype.

This layer adds explainable offline decision-making on top of the 10.000x
prototype:
- Priority is inferred from task type, SLA terms, impact, and KPI history.
- Company assignment considers skill match, workload, QA failure history, and
  rollback history.
- Decision records are stored with each task event for auditability.

Runtime state is isolated under .super-agent-ai/.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PROTOTYPES_DIR = ROOT / "prototypes"
if str(PROTOTYPES_DIR) not in sys.path:
    sys.path.insert(0, str(PROTOTYPES_DIR))

from super_agent_offline_10000x import (  # noqa: E402
    ALERTS_PATH as BASE_ALERTS_PATH,
    AnalyticsStore10000x,
    COMPANIES_10000X,
    DASHBOARD_PATH as BASE_DASHBOARD_PATH,
    LOG_DIR as BASE_LOG_DIR,
    MAX_WORKERS,
    SNAPSHOT_DIR as BASE_SNAPSHOT_DIR,
    WORKSPACE_DIR as BASE_WORKSPACE_DIR,
    AgentResult,
    CompanyProfile,
    OfflineTask,
    PatchSandbox,
    SuperAgent10000x,
    TaskDB1000x,
    classify_task,
    format_kpi_text_10000x,
    format_summary,
    infer_priority,
    load_company_kb,
    parse_patch,
    score_keywords,
    stable_id,
    utc_now,
)


STATE_DIR = ROOT / ".super-agent-ai"
WORKSPACE_DIR = STATE_DIR / "workspace"
SNAPSHOT_DIR = STATE_DIR / "snapshots"
TASK_DB_PATH = STATE_DIR / "task_db.json"
LOG_DIR = STATE_DIR / "logs"
ANALYTICS_PATH = STATE_DIR / "analytics.json"
ALERTS_PATH = STATE_DIR / "alerts.json"
DASHBOARD_PATH = STATE_DIR / "dashboard.html"


@dataclass(frozen=True)
class Decision:
    task_id: str
    priority: str
    assigned_company: str
    task_type: str
    score: float
    reasons: list[str]
    company_scores: list[dict[str, Any]]


class OfflineDecisionEngine:
    def __init__(self, analytics_path: Path = ANALYTICS_PATH):
        self.analytics_path = analytics_path

    def decide(self, task: OfflineTask) -> Decision:
        task_type = task.task_type or classify_task(task.desc)
        history = self._load_history()
        priority, priority_reasons = self._decide_priority(task, task_type, history)
        company_scores = self._score_companies(task, task_type, priority, history)
        best = company_scores[0]
        reasons = priority_reasons + [
            f"selected {best['company_id']} with score {best['score']:.2f}",
            f"skill={best['skill_score']}, load_penalty={best['load_penalty']:.2f}, reliability_penalty={best['reliability_penalty']:.2f}",
        ]
        return Decision(
            task_id=task.id,
            priority=priority,
            assigned_company=best["company_id"],
            task_type=task_type,
            score=best["score"],
            reasons=reasons,
            company_scores=company_scores[:5],
        )

    def _decide_priority(self, task: OfflineTask, task_type: str, history: list[dict[str, Any]]) -> tuple[str, list[str]]:
        text = task.desc.lower()
        base = infer_priority(task.desc, task.priority)
        reasons = [f"base priority={base}"]
        score = {"low": 1, "normal": 2, "medium": 3, "high": 4, "critical": 5}.get(base, 2)

        if task_type == "build_fix":
            score += 1
            reasons.append("build_fix adds urgency")
        if task_type == "audit":
            score += 0.5
            reasons.append("audit requires governance review")
        if any(term in text for term in ("payment", "auth", "security", "ledger", "deploy", "token", "secret")):
            score += 1
            reasons.append("high-impact domain detected")
        if any(term in text for term in ("sla", "deadline", "customer", "production", "revenue")):
            score += 1
            reasons.append("SLA/customer/revenue term detected")

        recent_failures = sum(1 for row in history[-20:] if row.get("qa_status") == "failed" or row.get("rollback"))
        if recent_failures >= 3:
            score += 0.5
            reasons.append("recent QA/rollback instability raises caution")

        if score >= 5:
            return "critical", reasons
        if score >= 4:
            return "high", reasons
        if score >= 3:
            return "medium", reasons
        if score <= 1:
            return "low", reasons
        return "normal", reasons

    def _score_companies(
        self,
        task: OfflineTask,
        task_type: str,
        priority: str,
        history: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        text = f"{task.desc} {task_type} {priority}".lower()
        workload = self._company_workload(history)
        reliability = self._company_reliability_penalty(history)
        scored = []
        for company in COMPANIES_10000X:
            skill_score = score_keywords(text, company.keywords)
            if task_type == "build_fix" and company.id == "it_ai":
                skill_score += 8
            if task_type == "build_fix" and company.id == "engineering":
                skill_score += 2
            if task_type == "audit" and company.id == "legal_compliance":
                skill_score += 4
            if "payment" in text and company.id == "finance_invest":
                skill_score += 3
            if "report" in text and company.id == "marketing":
                skill_score += 3
            if "batch" in text and company.id.startswith("company_"):
                skill_score += 1

            load_penalty = workload.get(company.name, 0) * 0.15
            reliability_penalty = reliability.get(company.name, 0)
            priority_bonus = 1 if priority in {"critical", "high"} and company.id in {"it_ai", "legal_compliance"} else 0
            score = skill_score + priority_bonus - load_penalty - reliability_penalty
            scored.append(
                {
                    "company_id": company.id,
                    "company": company.name,
                    "score": round(score, 3),
                    "skill_score": skill_score,
                    "load_penalty": round(load_penalty, 3),
                    "reliability_penalty": round(reliability_penalty, 3),
                }
            )
        scored.sort(key=lambda item: item["score"], reverse=True)
        return scored

    def _load_history(self) -> list[dict[str, Any]]:
        try:
            data = json.loads(self.analytics_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, FileNotFoundError):
            return []
        events = data.get("events", []) if isinstance(data, dict) else []
        return events if isinstance(events, list) else []

    @staticmethod
    def _company_workload(history: list[dict[str, Any]]) -> dict[str, int]:
        workload: dict[str, int] = {}
        for row in history[-100:]:
            company = row.get("company")
            if company:
                workload[company] = workload.get(company, 0) + 1
        return workload

    @staticmethod
    def _company_reliability_penalty(history: list[dict[str, Any]]) -> dict[str, float]:
        penalties: dict[str, float] = {}
        totals: dict[str, int] = {}
        failures: dict[str, int] = {}
        for row in history[-200:]:
            company = row.get("company")
            if not company:
                continue
            totals[company] = totals.get(company, 0) + 1
            failures[company] = failures.get(company, 0) + (1 if row.get("qa_status") == "failed" or row.get("rollback") else 0)
        for company, total in totals.items():
            penalties[company] = (failures.get(company, 0) / total) * 2 if total else 0
        return penalties


class SuperAgentAIDecision(SuperAgent10000x):
    def __init__(self, workers: int = MAX_WORKERS):
        self.db = TaskDB1000x(TASK_DB_PATH)
        self.workers = min(max(workers, 1), MAX_WORKERS)
        self.patch_sandbox = PatchSandbox(WORKSPACE_DIR, SNAPSHOT_DIR)
        self.analytics = AnalyticsStore10000x(ANALYTICS_PATH, DASHBOARD_PATH, ALERTS_PATH)
        self.decision_engine = OfflineDecisionEngine(ANALYTICS_PATH)

    def execute(self, task: OfflineTask) -> dict[str, Any]:
        decision = self.decision_engine.decide(task)
        task.priority = decision.priority
        task.assigned_company = decision.assigned_company
        task.task_type = decision.task_type
        task.updated_at = utc_now()

        company = get_company_ai(task.assigned_company)
        prompt = generate_prompt_ai(task, company, decision)

        with __import__("concurrent.futures").futures.ThreadPoolExecutor(max_workers=2) as executor:
            dev_future = executor.submit(self._dev_autopatch, task, company, prompt)
            qa_future = executor.submit(self._qa_audit, task, company, prompt)
            dev = dev_future.result()
            qa = qa_future.result()

        rollback = None
        patch_result = dev.details.get("patch_result")
        if patch_result and qa.status == "failed":
            rollback = self.patch_sandbox.rollback(patch_result)

        event = {
            "task": asdict(task),
            "company": asdict(company),
            "decision": asdict(decision),
            "dev": asdict(dev),
            "qa": asdict(qa),
            "rollback": rollback,
            "summary": format_summary(task, company, dev, qa, rollback),
            "logged_at": utc_now(),
        }
        log_event_ai(event)
        return event

    def _dev_autopatch(self, task: OfflineTask, company: CompanyProfile, prompt: str) -> AgentResult:
        patch_result = self.patch_sandbox.apply_patch(task)
        return AgentResult(
            role="Dev",
            company=company.name,
            status="patched-in-sandbox",
            summary=f"AI decision Dev applied {task.priority} priority sandbox patch for {task.id}.",
            details={
                "prompt_digest": stable_id("prompt", prompt),
                "priority": task.priority,
                "patch_result": patch_result,
                "verification_commands": ["python3 -m py_compile prototypes/super_agent_offline_ai.py"],
            },
        )

    def _qa_audit(self, task: OfflineTask, company: CompanyProfile, prompt: str) -> AgentResult:
        risky = task.priority in {"critical", "high"} or any(
            term in task.desc.lower()
            for term in ("payment", "auth", "security", "ledger", "deploy", "token", "secret")
        )
        forced_fail = "[qa-fail]" in task.desc.lower()
        status = "failed" if forced_fail else "review-required" if risky else "passed"
        return AgentResult(
            role="QA",
            company=company.name,
            status=status,
            summary=f"AI decision QA completed audit for {task.id}.",
            details={
                "prompt_digest": stable_id("qa", prompt),
                "risk_level": "high" if task.priority == "critical" else "medium" if risky else "low",
                "continuous_checks": [
                    "offline-decision-record",
                    "company-workload",
                    "historical-reliability",
                    "sandbox-boundary",
                    "rollback-available",
                    "analytics-recorded",
                    "alert-policy-evaluated",
                ],
            },
        )


def get_company_ai(company_id: str | None) -> CompanyProfile:
    for company in COMPANIES_10000X:
        if company.id == company_id:
            return company
    return next(company for company in COMPANIES_10000X if company.id == "it_ai")


def generate_prompt_ai(task: OfflineTask, company: CompanyProfile, decision: Decision) -> str:
    kb_data = load_company_kb(company.id)
    context = kb_data.get("context") or kb_data.get("summary") or json.dumps(kb_data)[:1200]
    return "\n".join(
        [
            f"[{company.name} AI DECISION PROMPT]",
            f"Mission: {company.mission}",
            f"Task: {task.desc}",
            f"Task type: {task.task_type}",
            f"Priority: {task.priority}",
            f"Decision score: {decision.score:.2f}",
            "Decision reasons:",
            *[f"- {reason}" for reason in decision.reasons],
            "",
            "Offline KB context:",
            str(context),
            "",
            "Execution rules:",
            "- Work offline except optional Telegram adapter.",
            "- Use decision record for auditability.",
            "- Auto-patch only inside .super-agent-ai/workspace.",
            "- Roll back automatically if QA fails.",
            "- Record analytics, alerts, and dashboard after every task.",
        ]
    )


def log_event_ai(event: dict[str, Any]) -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = LOG_DIR / "events.jsonl"
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    return path


def start_telegram_bot_ai(agent: SuperAgentAIDecision) -> None:
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
        await update.message.reply_text(f"Queued offline AI decision task {task.id}.")

    app = ApplicationBuilder().token(token).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, telegram_handler))
    print("[TELEGRAM BOT STARTED] Offline AI decision queue is listening.")
    app.run_polling()


def main() -> int:
    parser = argparse.ArgumentParser(description="Super Agent Offline AI Decision prototype")
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

    agent = SuperAgentAIDecision(workers=args.workers)

    patches = [None] * len(args.task or [])
    if args.patch and args.task:
        patches[-1] = parse_patch(args.patch)

    for desc, patch in zip(args.task or [], patches):
        task = agent.seed_task(desc, patch=patch)
        print(f"Queued {task.id}: {task.desc}")

    if args.telegram:
        telegram_thread = threading.Thread(target=start_telegram_bot_ai, args=(agent,), daemon=True)
        telegram_thread.start()

    if args.monitor:
        agent.monitor(interval=args.interval, once=False)
        return 0

    events = agent.process_pending_once() if args.once or args.task else []
    if args.json:
        print(json.dumps(events, ensure_ascii=False, indent=2))
    else:
        for event in events:
            decision = event.get("decision", {})
            print(event["summary"])
            if decision:
                print(f"- Decision: {decision.get('assigned_company')} / {decision.get('priority')} / score={decision.get('score')}")

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
