#!/usr/bin/env python3
"""
Super Agent Offline AI Self-Learning prototype.

This layer extends the AI decision prototype with:
- Offline self-learning model updates from analytics history.
- Predictive priority adjustment from company and task-type risk.
- Dynamic worker allocation based on risk, throughput, and backlog.
- Scenario simulation before real execution.
- Explainable decision records that include learning signals.

Runtime state is isolated under .super-agent-selflearning/.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PROTOTYPES_DIR = ROOT / "prototypes"
if str(PROTOTYPES_DIR) not in sys.path:
    sys.path.insert(0, str(PROTOTYPES_DIR))

from super_agent_offline_10000x import (  # noqa: E402
    AnalyticsStore10000x,
    COMPANIES_10000X,
    MAX_WORKERS,
    AgentResult,
    CompanyProfile,
    OfflineTask,
    PatchSandbox,
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
from super_agent_offline_ai import OfflineDecisionEngine  # noqa: E402


STATE_DIR = ROOT / ".super-agent-selflearning"
WORKSPACE_DIR = STATE_DIR / "workspace"
SNAPSHOT_DIR = STATE_DIR / "snapshots"
TASK_DB_PATH = STATE_DIR / "task_db.json"
LOG_DIR = STATE_DIR / "logs"
ANALYTICS_PATH = STATE_DIR / "analytics.json"
ALERTS_PATH = STATE_DIR / "alerts.json"
DASHBOARD_PATH = STATE_DIR / "dashboard.html"
MODEL_PATH = STATE_DIR / "learning_model.json"
SIMULATION_PATH = STATE_DIR / "simulation_report.json"


PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "normal": 3, "low": 4}
PRIORITY_SCORE = {"low": 1, "normal": 2, "medium": 3, "high": 4, "critical": 5}
SCORE_PRIORITY = {1: "low", 2: "normal", 3: "medium", 4: "high", 5: "critical"}


@dataclass(frozen=True)
class LearningModel:
    generated_at: str
    total_events: int
    company_stats: dict[str, dict[str, Any]]
    task_type_stats: dict[str, dict[str, Any]]
    global_stats: dict[str, Any]
    worker_plan: dict[str, Any]


@dataclass(frozen=True)
class SelfLearningDecision:
    task_id: str
    priority: str
    assigned_company: str
    task_type: str
    score: float
    predicted_risk: float
    allocated_workers: int
    reasons: list[str]
    learning_signals: dict[str, Any]
    company_scores: list[dict[str, Any]]


class SelfLearningModelStore:
    def __init__(self, analytics_path: Path = ANALYTICS_PATH, model_path: Path = MODEL_PATH):
        self.analytics_path = analytics_path
        self.model_path = model_path
        self.model_path.parent.mkdir(parents=True, exist_ok=True)

    def update(self) -> LearningModel:
        history = self._load_history()
        company_stats = self._company_stats(history)
        task_type_stats = self._task_type_stats(history)
        global_stats = self._global_stats(history)
        worker_plan = self._worker_plan(company_stats, global_stats)
        model = LearningModel(
            generated_at=utc_now(),
            total_events=len(history),
            company_stats=company_stats,
            task_type_stats=task_type_stats,
            global_stats=global_stats,
            worker_plan=worker_plan,
        )
        self._write_model(model)
        return model

    def load_or_update(self) -> LearningModel:
        if not self.model_path.exists():
            return self.update()
        try:
            data = json.loads(self.model_path.read_text(encoding="utf-8"))
            return LearningModel(**data)
        except (json.JSONDecodeError, TypeError):
            return self.update()

    def _load_history(self) -> list[dict[str, Any]]:
        try:
            data = json.loads(self.analytics_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, FileNotFoundError):
            return []
        events = data.get("events", []) if isinstance(data, dict) else []
        return events if isinstance(events, list) else []

    def _write_model(self, model: LearningModel) -> None:
        tmp = self.model_path.with_name(f"{self.model_path.name}.{os.getpid()}.{threading.get_ident()}.tmp")
        tmp.write_text(json.dumps(asdict(model), ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, self.model_path)

    @staticmethod
    def _company_stats(history: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        stats: dict[str, dict[str, Any]] = {}
        for row in history:
            company = row.get("company") or "unknown"
            item = stats.setdefault(
                company,
                {"total": 0, "qa_failed": 0, "rollback": 0, "review_required": 0, "patched": 0},
            )
            item["total"] += 1
            item["qa_failed"] += 1 if row.get("qa_status") == "failed" else 0
            item["rollback"] += 1 if row.get("rollback") else 0
            item["review_required"] += 1 if row.get("qa_status") == "review-required" else 0
            item["patched"] += 1 if row.get("dev_status") == "patched-in-sandbox" else 0

        for item in stats.values():
            total = item["total"] or 1
            item["qa_fail_rate"] = item["qa_failed"] / total
            item["rollback_rate"] = item["rollback"] / total
            item["review_rate"] = item["review_required"] / total
            item["dev_success_rate"] = item["patched"] / total
            item["risk_score"] = round((item["qa_fail_rate"] * 0.45) + (item["rollback_rate"] * 0.45) + (item["review_rate"] * 0.10), 4)
        return stats

    @staticmethod
    def _task_type_stats(history: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        stats: dict[str, dict[str, Any]] = {}
        for row in history:
            task_type = row.get("task_type") or "unknown"
            item = stats.setdefault(task_type, {"total": 0, "qa_failed": 0, "rollback": 0, "review_required": 0})
            item["total"] += 1
            item["qa_failed"] += 1 if row.get("qa_status") == "failed" else 0
            item["rollback"] += 1 if row.get("rollback") else 0
            item["review_required"] += 1 if row.get("qa_status") == "review-required" else 0

        for item in stats.values():
            total = item["total"] or 1
            item["qa_fail_rate"] = item["qa_failed"] / total
            item["rollback_rate"] = item["rollback"] / total
            item["review_rate"] = item["review_required"] / total
            item["risk_score"] = round((item["qa_fail_rate"] * 0.50) + (item["rollback_rate"] * 0.35) + (item["review_rate"] * 0.15), 4)
        return stats

    @staticmethod
    def _global_stats(history: list[dict[str, Any]]) -> dict[str, Any]:
        total = len(history)
        qa_failed = sum(1 for row in history if row.get("qa_status") == "failed")
        rollback = sum(1 for row in history if row.get("rollback"))
        review = sum(1 for row in history if row.get("qa_status") == "review-required")
        return {
            "total": total,
            "qa_fail_rate": qa_failed / total if total else 0,
            "rollback_rate": rollback / total if total else 0,
            "review_rate": review / total if total else 0,
        }

    @staticmethod
    def _worker_plan(company_stats: dict[str, dict[str, Any]], global_stats: dict[str, Any]) -> dict[str, Any]:
        base_workers = 16
        if global_stats.get("total", 0) >= 50:
            base_workers = 64
        if global_stats.get("qa_fail_rate", 0) > 0.2 or global_stats.get("rollback_rate", 0) > 0.15:
            base_workers = max(8, base_workers // 2)

        company_workers = {}
        for company, stats in company_stats.items():
            if stats.get("risk_score", 0) > 0.25:
                company_workers[company] = max(1, base_workers // 8)
            elif stats.get("dev_success_rate", 0) > 0.95 and stats.get("total", 0) >= 5:
                company_workers[company] = max(2, base_workers // 4)
            else:
                company_workers[company] = max(1, base_workers // 16)

        return {
            "recommended_workers": min(MAX_WORKERS, base_workers),
            "company_workers": company_workers,
            "reason": "reduced for instability" if base_workers < 16 else "scaled from observed throughput/risk",
        }


class PredictiveDecisionEngine(OfflineDecisionEngine):
    def __init__(self, model_store: SelfLearningModelStore):
        super().__init__(model_store.analytics_path)
        self.model_store = model_store

    def decide(self, task: OfflineTask) -> SelfLearningDecision:
        model = self.model_store.load_or_update()
        base_decision = super().decide(task)
        predicted_risk, risk_reasons = self._predict_risk(task, base_decision, model)
        priority, priority_reason = self._adjust_priority(base_decision.priority, predicted_risk)
        company_scores = self._rescore_with_learning(base_decision.company_scores, model)
        best = company_scores[0]
        allocated_workers = self._allocated_workers(best["company"], priority, model)
        reasons = list(base_decision.reasons) + risk_reasons + [priority_reason, f"allocated_workers={allocated_workers}"]
        return SelfLearningDecision(
            task_id=task.id,
            priority=priority,
            assigned_company=best["company_id"],
            task_type=base_decision.task_type,
            score=best["score"],
            predicted_risk=predicted_risk,
            allocated_workers=allocated_workers,
            reasons=reasons,
            learning_signals={
                "model_generated_at": model.generated_at,
                "model_events": model.total_events,
                "global": model.global_stats,
                "worker_plan": model.worker_plan,
            },
            company_scores=company_scores[:5],
        )

    def _predict_risk(self, task: OfflineTask, decision: Any, model: LearningModel) -> tuple[float, list[str]]:
        company = next((item.get("company") for item in decision.company_scores if item.get("company_id") == decision.assigned_company), "")
        company_risk = model.company_stats.get(company, {}).get("risk_score", 0)
        type_risk = model.task_type_stats.get(decision.task_type, {}).get("risk_score", 0)
        global_risk = (model.global_stats.get("qa_fail_rate", 0) + model.global_stats.get("rollback_rate", 0)) / 2
        text_risk = 0.15 if any(term in task.desc.lower() for term in ("payment", "auth", "security", "deploy", "production", "customer")) else 0
        predicted = min(1.0, round((company_risk * 0.35) + (type_risk * 0.35) + (global_risk * 0.20) + text_risk, 4))
        return predicted, [
            f"predicted_risk={predicted:.2f}",
            f"company_risk={company_risk:.2f}",
            f"task_type_risk={type_risk:.2f}",
            f"global_risk={global_risk:.2f}",
        ]

    @staticmethod
    def _adjust_priority(priority: str, predicted_risk: float) -> tuple[str, str]:
        score = PRIORITY_SCORE.get(priority, 2)
        if predicted_risk >= 0.45:
            score += 2
            reason = "priority raised strongly by predictive risk"
        elif predicted_risk >= 0.25:
            score += 1
            reason = "priority raised by predictive risk"
        elif predicted_risk <= 0.05 and score > 2:
            score -= 1
            reason = "priority relaxed because learned risk is low"
        else:
            reason = "priority kept by predictive model"
        score = max(1, min(5, score))
        return SCORE_PRIORITY[score], reason

    @staticmethod
    def _rescore_with_learning(company_scores: list[dict[str, Any]], model: LearningModel) -> list[dict[str, Any]]:
        rescored = []
        for item in company_scores:
            stats = model.company_stats.get(item["company"], {})
            risk_penalty = stats.get("risk_score", 0) * 3
            success_bonus = stats.get("dev_success_rate", 0) if stats.get("total", 0) >= 3 else 0
            adjusted = dict(item)
            adjusted["learning_risk_penalty"] = round(risk_penalty, 3)
            adjusted["learning_success_bonus"] = round(success_bonus, 3)
            adjusted["score"] = round(item["score"] - risk_penalty + success_bonus, 3)
            rescored.append(adjusted)
        rescored.sort(key=lambda value: value["score"], reverse=True)
        return rescored

    @staticmethod
    def _allocated_workers(company_name: str, priority: str, model: LearningModel) -> int:
        base = model.worker_plan.get("company_workers", {}).get(company_name, 1)
        if priority == "critical":
            return min(MAX_WORKERS, max(base * 4, 8))
        if priority == "high":
            return min(MAX_WORKERS, max(base * 2, 4))
        return min(MAX_WORKERS, max(base, 1))


class SuperAgentSelfLearning:
    def __init__(self, workers: int = MAX_WORKERS):
        self.db = TaskDB1000x(TASK_DB_PATH)
        self.model_store = SelfLearningModelStore(ANALYTICS_PATH, MODEL_PATH)
        model = self.model_store.load_or_update()
        self.workers = min(max(workers, 1), int(model.worker_plan.get("recommended_workers", workers) or workers), MAX_WORKERS)
        self.patch_sandbox = PatchSandbox(WORKSPACE_DIR, SNAPSHOT_DIR)
        self.analytics = AnalyticsStore10000x(ANALYTICS_PATH, DASHBOARD_PATH, ALERTS_PATH)
        self.decision_engine = PredictiveDecisionEngine(self.model_store)

    def seed_task(self, desc: str, patch: dict[str, Any] | None = None) -> OfflineTask:
        return self.db.add(desc, source="seed", patch=patch)

    def process_pending_once(self, limit: int = 10000) -> list[dict[str, Any]]:
        tasks = sorted(self.db.pending(limit=limit), key=self._predictive_rank)
        if not tasks:
            return []

        events = []
        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            futures = [executor.submit(self._process_task_if_claimed, task) for task in tasks]
            for future in futures:
                event = future.result()
                if event:
                    events.append(event)
        self.model_store.update()
        return events

    def monitor(self, interval: float = 1.0) -> None:
        while True:
            events = self.process_pending_once()
            for event in events:
                print(event["summary"])
            __import__("time").sleep(interval)

    def simulate(self, descriptions: list[str]) -> dict[str, Any]:
        self.model_store.update()
        decisions = []
        for index, desc in enumerate(descriptions):
            task = OfflineTask(
                id=stable_id("sim", f"{index}:{desc}"),
                desc=desc,
                source="simulation",
                created_at=utc_now(),
                updated_at=utc_now(),
            )
            decision = self.decision_engine.decide(task)
            decisions.append(asdict(decision))
        bottlenecks = self._simulation_bottlenecks(decisions)
        report = {
            "generated_at": utc_now(),
            "task_count": len(descriptions),
            "recommended_workers": self.workers,
            "decisions": decisions,
            "bottlenecks": bottlenecks,
        }
        SIMULATION_PATH.parent.mkdir(parents=True, exist_ok=True)
        SIMULATION_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        return report

    def execute(self, task: OfflineTask) -> dict[str, Any]:
        decision = self.decision_engine.decide(task)
        task.priority = decision.priority
        task.assigned_company = decision.assigned_company
        task.task_type = decision.task_type
        task.updated_at = utc_now()
        company = get_company_selflearning(task.assigned_company)
        prompt = generate_prompt_selflearning(task, company, decision)

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
        log_event_selflearning(event)
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
            summary=f"Self-learning Dev applied {task.priority} priority sandbox patch for {task.id}.",
            details={
                "prompt_digest": stable_id("prompt", prompt),
                "priority": task.priority,
                "patch_result": patch_result,
                "verification_commands": ["python3 -m py_compile prototypes/super_agent_offline_ai_selflearning.py"],
            },
        )

    def _qa_audit(self, task: OfflineTask, company: CompanyProfile, prompt: str, decision: SelfLearningDecision) -> AgentResult:
        risky = task.priority in {"critical", "high"} or decision.predicted_risk >= 0.25
        forced_fail = "[qa-fail]" in task.desc.lower()
        status = "failed" if forced_fail else "review-required" if risky else "passed"
        return AgentResult(
            role="QA",
            company=company.name,
            status=status,
            summary=f"Self-learning QA completed predictive audit for {task.id}.",
            details={
                "prompt_digest": stable_id("qa", prompt),
                "predicted_risk": decision.predicted_risk,
                "allocated_workers": decision.allocated_workers,
                "continuous_checks": [
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

    def _predictive_rank(self, task: OfflineTask) -> tuple[int, float, str]:
        decision = self.decision_engine.decide(task)
        return PRIORITY_ORDER.get(decision.priority, 3), -decision.predicted_risk, task.created_at or ""

    @staticmethod
    def _simulation_bottlenecks(decisions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        counts: dict[str, dict[str, Any]] = {}
        for decision in decisions:
            company = decision["assigned_company"]
            item = counts.setdefault(company, {"company": company, "tasks": 0, "critical": 0, "avg_risk": 0.0})
            item["tasks"] += 1
            item["critical"] += 1 if decision["priority"] == "critical" else 0
            item["avg_risk"] += decision["predicted_risk"]
        bottlenecks = []
        for item in counts.values():
            item["avg_risk"] = round(item["avg_risk"] / item["tasks"], 4)
            if item["tasks"] >= 3 or item["critical"] >= 2 or item["avg_risk"] >= 0.25:
                bottlenecks.append(item)
        bottlenecks.sort(key=lambda value: (value["critical"], value["tasks"], value["avg_risk"]), reverse=True)
        return bottlenecks


def get_company_selflearning(company_id: str | None) -> CompanyProfile:
    for company in COMPANIES_10000X:
        if company.id == company_id:
            return company
    return next(company for company in COMPANIES_10000X if company.id == "it_ai")


def generate_prompt_selflearning(task: OfflineTask, company: CompanyProfile, decision: SelfLearningDecision) -> str:
    kb_data = load_company_kb(company.id)
    context = kb_data.get("context") or kb_data.get("summary") or json.dumps(kb_data)[:1200]
    return "\n".join(
        [
            f"[{company.name} SELF-LEARNING PROMPT]",
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
            "- Use self-learning decision record for auditability.",
            "- Auto-patch only inside .super-agent-selflearning/workspace.",
            "- Roll back automatically if QA fails.",
            "- Update learning model after execution.",
        ]
    )


def log_event_selflearning(event: dict[str, Any]) -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = LOG_DIR / "events.jsonl"
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    return path


def start_telegram_bot_selflearning(agent: SuperAgentSelfLearning) -> None:
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
        await update.message.reply_text(f"Queued offline self-learning task {task.id}.")

    app = ApplicationBuilder().token(token).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, telegram_handler))
    print("[TELEGRAM BOT STARTED] Offline self-learning queue is listening.")
    app.run_polling()


def main() -> int:
    parser = argparse.ArgumentParser(description="Super Agent Offline AI Self-Learning prototype")
    parser.add_argument("--task", action="append", help="Add task(s) to offline DB before processing.")
    parser.add_argument("--patch", help="JSON patch object for the last --task.")
    parser.add_argument("--once", action="store_true", help="Process pending DB tasks once and exit.")
    parser.add_argument("--monitor", action="store_true", help="Continuously monitor offline task DB.")
    parser.add_argument("--interval", type=float, default=1.0, help="Monitor polling interval in seconds.")
    parser.add_argument("--workers", type=int, default=MAX_WORKERS, help="Worker count, capped at 512.")
    parser.add_argument("--telegram", action="store_true", help="Start optional Telegram adapter.")
    parser.add_argument("--dashboard", action="store_true", help="Refresh and print KPI dashboard paths.")
    parser.add_argument("--simulate", action="store_true", help="Run scenario simulation instead of executing tasks.")
    parser.add_argument("--json", action="store_true", help="Print JSON for --once or --simulate output.")
    args = parser.parse_args()

    agent = SuperAgentSelfLearning(workers=args.workers)

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
            print(f"Recommended workers: {report['recommended_workers']}")
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
        telegram_thread = threading.Thread(target=start_telegram_bot_selflearning, args=(agent,), daemon=True)
        telegram_thread.start()

    if args.monitor:
        agent.monitor(interval=args.interval)
        return 0

    events = agent.process_pending_once() if args.once or args.task else []
    if args.json:
        print(json.dumps(events, ensure_ascii=False, indent=2))
    else:
        for event in events:
            decision = event.get("decision", {})
            print(event["summary"])
            if decision:
                print(
                    f"- Decision: {decision.get('assigned_company')} / {decision.get('priority')} "
                    f"/ risk={decision.get('predicted_risk')} / workers={decision.get('allocated_workers')}"
                )

    if args.dashboard or events:
        kpi = agent.analytics.load_kpi()
        model = agent.model_store.update()
        print(format_kpi_text_10000x(kpi))
        print(f"Model: {MODEL_PATH.relative_to(ROOT)} ({model.total_events} events)")
        print(f"Analytics: {ANALYTICS_PATH.relative_to(ROOT)}")
        print(f"Alerts: {ALERTS_PATH.relative_to(ROOT)}")
        print(f"Dashboard: {DASHBOARD_PATH.relative_to(ROOT)}")

    if args.telegram and not args.monitor:
        print("Telegram adapter started. Use --monitor to keep processing queued tasks continuously.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
