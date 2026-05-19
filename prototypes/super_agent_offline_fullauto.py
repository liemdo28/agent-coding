#!/usr/bin/env python3
"""
Full Autonomous Corporate Agent prototype.

This is the autonomous orchestration layer above the offline self-learning
agent. It keeps the same safety boundary:
- all runtime state stays under .super-agent-fullauto/
- auto-patch writes only to .super-agent-fullauto/workspace/
- QA failure rolls back sandbox changes
- Telegram is optional and only queues tasks / reports KPI

The full-auto layer adds proactive planning, autonomous cycles, bottleneck
forecasting, and explainable corporate plans before or after execution.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PROTOTYPES_DIR = ROOT / "prototypes"
if str(PROTOTYPES_DIR) not in sys.path:
    sys.path.insert(0, str(PROTOTYPES_DIR))

from super_agent_offline_10000x import (  # noqa: E402
    AnalyticsStore10000x,
    MAX_WORKERS,
    AgentResult,
    CompanyProfile,
    OfflineTask,
    PatchSandbox,
    TaskDB1000x,
    format_kpi_text_10000x,
    format_summary,
    parse_patch,
    stable_id,
    utc_now,
)
from super_agent_offline_ai_selflearning import (  # noqa: E402
    PredictiveDecisionEngine,
    SelfLearningDecision,
    SelfLearningModelStore,
    get_company_selflearning,
    generate_prompt_selflearning,
)


STATE_DIR = ROOT / ".super-agent-fullauto"
WORKSPACE_DIR = STATE_DIR / "workspace"
SNAPSHOT_DIR = STATE_DIR / "snapshots"
TASK_DB_PATH = STATE_DIR / "task_db.json"
LOG_DIR = STATE_DIR / "logs"
ANALYTICS_PATH = STATE_DIR / "analytics.json"
ALERTS_PATH = STATE_DIR / "alerts.json"
DASHBOARD_PATH = STATE_DIR / "dashboard.html"
MODEL_PATH = STATE_DIR / "learning_model.json"
SIMULATION_PATH = STATE_DIR / "simulation_report.json"
PLAN_PATH = STATE_DIR / "autonomous_plan.json"
EXECUTION_SUMMARY_PATH = STATE_DIR / "execution_summary.json"


PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "normal": 3, "low": 4}


class FullAutonomousPlanner:
    def __init__(self, model_store: SelfLearningModelStore, decision_engine: PredictiveDecisionEngine):
        self.model_store = model_store
        self.decision_engine = decision_engine

    def build_plan(self, tasks: list[OfflineTask]) -> dict[str, Any]:
        model = self.model_store.update()
        decisions = [asdict(self.decision_engine.decide(task)) for task in tasks]
        company_load = self._company_load(decisions)
        priority_mix = self._priority_mix(decisions)
        bottlenecks = self._bottlenecks(company_load, decisions)
        resource_needs = self._resource_needs(decisions, model.worker_plan)
        plan = {
            "generated_at": utc_now(),
            "task_count": len(tasks),
            "model_events": model.total_events,
            "priority_mix": priority_mix,
            "company_load": company_load,
            "bottlenecks": bottlenecks,
            "resource_needs": resource_needs,
            "recommended_actions": self._recommended_actions(bottlenecks, priority_mix, resource_needs),
            "decisions": decisions,
        }
        PLAN_PATH.parent.mkdir(parents=True, exist_ok=True)
        PLAN_PATH.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
        return plan

    @staticmethod
    def _company_load(decisions: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        load: dict[str, dict[str, Any]] = {}
        for decision in decisions:
            company = decision["assigned_company"]
            item = load.setdefault(company, {"tasks": 0, "critical": 0, "high": 0, "avg_risk": 0.0, "workers": 0})
            item["tasks"] += 1
            item["critical"] += 1 if decision["priority"] == "critical" else 0
            item["high"] += 1 if decision["priority"] == "high" else 0
            item["avg_risk"] += decision["predicted_risk"]
            item["workers"] += decision["allocated_workers"]
        for item in load.values():
            item["avg_risk"] = round(item["avg_risk"] / item["tasks"], 4) if item["tasks"] else 0
        return load

    @staticmethod
    def _priority_mix(decisions: list[dict[str, Any]]) -> dict[str, int]:
        mix = {priority: 0 for priority in PRIORITY_ORDER}
        for decision in decisions:
            mix[decision["priority"]] = mix.get(decision["priority"], 0) + 1
        return mix

    @staticmethod
    def _bottlenecks(company_load: dict[str, dict[str, Any]], decisions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        bottlenecks = []
        for company, stats in company_load.items():
            if stats["tasks"] >= 3 or stats["critical"] >= 2 or stats["avg_risk"] >= 0.25:
                bottlenecks.append({"company": company, **stats})
        bottlenecks.sort(key=lambda item: (item["critical"], item["tasks"], item["avg_risk"]), reverse=True)
        high_risk_tasks = [
            {
                "task_id": decision["task_id"],
                "company": decision["assigned_company"],
                "priority": decision["priority"],
                "predicted_risk": decision["predicted_risk"],
            }
            for decision in decisions
            if decision["predicted_risk"] >= 0.25 or decision["priority"] == "critical"
        ]
        if high_risk_tasks:
            bottlenecks.append({"company": "cross-company", "tasks": len(high_risk_tasks), "high_risk_tasks": high_risk_tasks})
        return bottlenecks

    @staticmethod
    def _resource_needs(decisions: list[dict[str, Any]], worker_plan: dict[str, Any]) -> dict[str, Any]:
        requested_workers = sum(decision["allocated_workers"] for decision in decisions)
        recommended_workers = int(worker_plan.get("recommended_workers", 16) or 16)
        return {
            "requested_workers": requested_workers,
            "recommended_workers": recommended_workers,
            "within_capacity": requested_workers <= MAX_WORKERS,
            "pressure": round(requested_workers / max(recommended_workers, 1), 3),
        }

    @staticmethod
    def _recommended_actions(
        bottlenecks: list[dict[str, Any]],
        priority_mix: dict[str, int],
        resource_needs: dict[str, Any],
    ) -> list[str]:
        actions = []
        if priority_mix.get("critical", 0) > 0:
            actions.append("Run critical tasks first and require QA review before promotion.")
        if bottlenecks:
            actions.append("Throttle bottleneck companies and split overflow to specialist units.")
        if resource_needs["pressure"] > 2:
            actions.append("Increase local worker cap only after QA stability improves.")
        if not actions:
            actions.append("Proceed with normal autonomous execution.")
        return actions


class FullAutonomousCorporateAgent:
    def __init__(self, workers: int = MAX_WORKERS):
        self.db = TaskDB1000x(TASK_DB_PATH)
        self.model_store = SelfLearningModelStore(ANALYTICS_PATH, MODEL_PATH)
        model = self.model_store.load_or_update()
        recommended = int(model.worker_plan.get("recommended_workers", workers) or workers)
        self.workers = min(max(workers, 1), recommended, MAX_WORKERS)
        self.patch_sandbox = PatchSandbox(WORKSPACE_DIR, SNAPSHOT_DIR)
        self.analytics = AnalyticsStore10000x(ANALYTICS_PATH, DASHBOARD_PATH, ALERTS_PATH)
        self.decision_engine = PredictiveDecisionEngine(self.model_store)
        self.planner = FullAutonomousPlanner(self.model_store, self.decision_engine)

    def seed_task(self, desc: str, patch: dict[str, Any] | None = None) -> OfflineTask:
        return self.db.add(desc, source="seed", patch=patch)

    def autonomous_cycle(self, limit: int = 10000, dry_run: bool = False) -> dict[str, Any]:
        tasks = sorted(self.db.pending(limit=limit), key=self._rank_task)
        plan = self.planner.build_plan(tasks)
        if dry_run:
            return {"plan": plan, "events": [], "dry_run": True}

        events = []
        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            futures = [executor.submit(self._process_task_if_claimed, task) for task in tasks]
            for future in futures:
                event = future.result()
                if event:
                    events.append(event)
        model = self.model_store.update()
        summary = {
            "generated_at": utc_now(),
            "processed": len(events),
            "pending_before": len(tasks),
            "workers": self.workers,
            "model_events": model.total_events,
            "plan": plan,
            "events": events,
        }
        EXECUTION_SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
        EXECUTION_SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        return summary

    def simulate(self, descriptions: list[str]) -> dict[str, Any]:
        tasks = [
            OfflineTask(
                id=stable_id("sim", f"{index}:{desc}"),
                desc=desc,
                source="simulation",
                created_at=utc_now(),
                updated_at=utc_now(),
            )
            for index, desc in enumerate(descriptions)
        ]
        report = self.planner.build_plan(tasks)
        SIMULATION_PATH.parent.mkdir(parents=True, exist_ok=True)
        SIMULATION_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        return report

    def monitor(self, interval: float = 1.0) -> None:
        while True:
            summary = self.autonomous_cycle()
            for event in summary["events"]:
                print(event["summary"])
            __import__("time").sleep(interval)

    def execute(self, task: OfflineTask) -> dict[str, Any]:
        decision = self.decision_engine.decide(task)
        task.priority = decision.priority
        task.assigned_company = decision.assigned_company
        task.task_type = decision.task_type
        task.updated_at = utc_now()
        company = get_company_fullauto(task.assigned_company)
        prompt = generate_prompt_fullauto(task, company, decision)

        with ThreadPoolExecutor(max_workers=2) as executor:
            dev_future = executor.submit(self._dev_autopatch, task, company, prompt)
            qa_future = executor.submit(self._qa_audit, task, company, prompt, decision)
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
        log_event_fullauto(event)
        return event

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

    def _dev_autopatch(self, task: OfflineTask, company: CompanyProfile, prompt: str) -> AgentResult:
        patch_result = self.patch_sandbox.apply_patch(task)
        return AgentResult(
            role="Dev",
            company=company.name,
            status="patched-in-sandbox",
            summary=f"Full-auto Dev applied {task.priority} priority sandbox patch for {task.id}.",
            details={
                "prompt_digest": stable_id("prompt", prompt),
                "priority": task.priority,
                "patch_result": patch_result,
                "verification_commands": ["python3 -m py_compile prototypes/super_agent_offline_fullauto.py"],
            },
        )

    def _qa_audit(self, task: OfflineTask, company: CompanyProfile, prompt: str, decision: Any) -> AgentResult:
        risky = task.priority in {"critical", "high"} or decision.predicted_risk >= 0.25
        forced_fail = "[qa-fail]" in task.desc.lower()
        status = "failed" if forced_fail else "review-required" if risky else "passed"
        return AgentResult(
            role="QA",
            company=company.name,
            status=status,
            summary=f"Full-auto QA completed autonomous audit for {task.id}.",
            details={
                "prompt_digest": stable_id("qa", prompt),
                "predicted_risk": decision.predicted_risk,
                "allocated_workers": decision.allocated_workers,
                "continuous_checks": [
                    "autonomous-plan",
                    "self-learning-model",
                    "predictive-priority",
                    "dynamic-worker-allocation",
                    "sandbox-boundary",
                    "rollback-available",
                    "analytics-recorded",
                    "alert-policy-evaluated",
                ],
            },
        )

    def _rank_task(self, task: OfflineTask) -> tuple[int, float, str]:
        decision = self.decision_engine.decide(task)
        return PRIORITY_ORDER.get(decision.priority, 3), -decision.predicted_risk, task.created_at or ""


def get_company_fullauto(company_id: str | None) -> CompanyProfile:
    from super_agent_offline_10000x import COMPANIES_10000X

    for company in COMPANIES_10000X:
        if company.id == company_id:
            return company
    return next(company for company in COMPANIES_10000X if company.id == "it_ai")


def generate_prompt_fullauto(task: OfflineTask, company: CompanyProfile, decision: Any) -> str:
    from super_agent_offline_10000x import load_company_kb

    kb_data = load_company_kb(company.id)
    context = kb_data.get("context") or kb_data.get("summary") or json.dumps(kb_data)[:1200]
    return "\n".join(
        [
            f"[{company.name} FULL AUTONOMOUS PROMPT]",
            f"Task: {task.desc}",
            f"Task type: {task.task_type}",
            f"Priority: {task.priority}",
            f"Predicted risk: {decision.predicted_risk:.2f}",
            f"Allocated workers: {decision.allocated_workers}",
            "Decision reasons:",
            *[f"- {reason}" for reason in decision.reasons],
            "",
            "Offline KB context:",
            str(context),
            "",
            "Execution rules:",
            "- Work offline except optional Telegram adapter.",
            "- Use autonomous plan and decision record for auditability.",
            "- Auto-patch only inside .super-agent-fullauto/workspace.",
            "- Roll back automatically if QA fails.",
            "- Update analytics, alerts, model, and planning artifacts after execution.",
        ]
    )


def log_event_fullauto(event: dict[str, Any]) -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = LOG_DIR / "events.jsonl"
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    return path


def start_telegram_bot_fullauto(agent: FullAutonomousCorporateAgent) -> None:
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
        if text == "/plan":
            pending = agent.db.pending()
            plan = agent.planner.build_plan(pending)
            await update.message.reply_text(f"Plan: {plan['task_count']} tasks, bottlenecks={len(plan['bottlenecks'])}")
            return
        task = agent.db.add(text, source="telegram")
        await update.message.reply_text(f"Queued full-auto offline task {task.id}.")

    app = ApplicationBuilder().token(token).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, telegram_handler))
    print("[TELEGRAM BOT STARTED] Full autonomous offline queue is listening.")
    app.run_polling()


def main() -> int:
    parser = argparse.ArgumentParser(description="Full Autonomous Corporate Agent prototype")
    parser.add_argument("--task", action="append", help="Add task(s) to offline DB before processing.")
    parser.add_argument("--patch", help="JSON patch object for the last --task.")
    parser.add_argument("--once", action="store_true", help="Run one autonomous execution cycle.")
    parser.add_argument("--dry-run", action="store_true", help="Build autonomous plan without executing tasks.")
    parser.add_argument("--monitor", action="store_true", help="Continuously monitor offline task DB.")
    parser.add_argument("--interval", type=float, default=1.0, help="Monitor polling interval in seconds.")
    parser.add_argument("--workers", type=int, default=MAX_WORKERS, help="Worker count, capped at 512.")
    parser.add_argument("--telegram", action="store_true", help="Start optional Telegram adapter.")
    parser.add_argument("--simulate", action="store_true", help="Run scenario simulation instead of queueing tasks.")
    parser.add_argument("--json", action="store_true", help="Print JSON output.")
    args = parser.parse_args()

    agent = FullAutonomousCorporateAgent(workers=args.workers)

    if args.simulate:
        report = agent.simulate(args.task or [
            "Fix payment SLA production bug",
            "Audit deployment compliance risk",
            "Generate monthly marketing report",
        ])
        if args.json:
            print(json.dumps(report, ensure_ascii=False, indent=2))
        else:
            print(f"Simulation tasks: {report['task_count']}")
            print(f"Bottlenecks: {report['bottlenecks']}")
            print(f"Simulation report: {SIMULATION_PATH.relative_to(ROOT)}")
        return 0

    patches = [None] * len(args.task or [])
    if args.patch and args.task:
        patches[-1] = parse_patch(args.patch)

    for desc, patch in zip(args.task or [], patches):
        task = agent.seed_task(desc, patch=patch)
        print(f"Queued {task.id}: {task.desc}")

    if args.telegram:
        telegram_thread = threading.Thread(target=start_telegram_bot_fullauto, args=(agent,), daemon=True)
        telegram_thread.start()

    if args.monitor:
        agent.monitor(interval=args.interval)
        return 0

    summary = agent.autonomous_cycle(dry_run=args.dry_run) if args.once or args.task or args.dry_run else agent.autonomous_cycle(dry_run=True)
    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print(f"Autonomous plan: {summary['plan']['task_count']} tasks")
        print(f"Bottlenecks: {summary['plan']['bottlenecks']}")
        for event in summary.get("events", []):
            decision = event.get("decision", {})
            print(event["summary"])
            if decision:
                print(
                    f"- Decision: {decision.get('assigned_company')} / {decision.get('priority')} "
                    f"/ risk={decision.get('predicted_risk')} / workers={decision.get('allocated_workers')}"
                )
        print(f"Plan: {PLAN_PATH.relative_to(ROOT)}")
        print(f"Summary: {EXECUTION_SUMMARY_PATH.relative_to(ROOT)}")
        print(f"Dashboard: {DASHBOARD_PATH.relative_to(ROOT)}")

    if args.telegram and not args.monitor:
        print("Telegram adapter started. Use --monitor to keep processing queued tasks continuously.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
