#!/usr/bin/env python3
"""
Offline Super Agent prototype.

This prototype models a multi-company command center where Telegram is an
optional input/output adapter and all planning, Dev, QA, KB lookup, and logging
stay local by default.

Run offline simulation:
    python3 prototypes/super_agent_offline.py --task "Fix bug module payment"

Run Telegram adapter, only when python-telegram-bot is installed:
    TELEGRAM_BOT_TOKEN=... python3 prototypes/super_agent_offline.py --telegram
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_BASE_PATH = ROOT / "kb"
LOG_DIR = ROOT / "logs" / "super-agent-offline"
MAX_WORKERS = 16


@dataclass(frozen=True)
class CompanyProfile:
    id: str
    name: str
    mission: str
    keywords: tuple[str, ...]


@dataclass(frozen=True)
class Task:
    id: str
    raw: str
    source: str
    assigned_company: str
    task_type: str
    priority: str
    created_at: str


@dataclass
class AgentResult:
    role: str
    company: str
    status: str
    summary: str
    details: dict[str, Any] = field(default_factory=dict)


COMPANIES: tuple[CompanyProfile, ...] = (
    CompanyProfile(
        id="rnd",
        name="R&D",
        mission="Prototype new capabilities, benchmark ideas, and explore research-heavy work.",
        keywords=("research", "prototype", "experiment", "benchmark", "innovation", "r&d"),
    ),
    CompanyProfile(
        id="engineering",
        name="Engineering",
        mission="Own production engineering, build systems, reliability, and implementation quality.",
        keywords=("engineering", "build", "fix", "bug", "test", "lint", "deploy", "module"),
    ),
    CompanyProfile(
        id="it_ai",
        name="IT_AI",
        mission="Own AI workflows, agent runtime, automation, coding tasks, and local model routing.",
        keywords=("ai", "agent", "code", "coding", "llm", "telegram", "visual studio", "vs", "parser"),
    ),
    CompanyProfile(
        id="finance_invest",
        name="Finance_Invest",
        mission="Own financial controls, accounting logic, investment analysis, and payment workflows.",
        keywords=("finance", "payment", "invoice", "ledger", "accounting", "tax", "investment"),
    ),
    CompanyProfile(
        id="marketing",
        name="Marketing",
        mission="Own growth, positioning, campaign planning, customer communication, and reports.",
        keywords=("marketing", "sales", "report", "seo", "campaign", "brand", "customer"),
    ),
    CompanyProfile(
        id="logistics",
        name="Logistics",
        mission="Own operational routing, resource allocation, incident flow, and delivery execution.",
        keywords=("logistics", "supply", "routing", "delivery", "ops", "operation", "warehouse"),
    ),
    CompanyProfile(
        id="hr_culture",
        name="HR_Culture",
        mission="Own hiring, training, culture, handbook, team design, and org learning.",
        keywords=("hr", "hiring", "jd", "people", "culture", "training", "handbook"),
    ),
    CompanyProfile(
        id="legal_compliance",
        name="Legal_Compliance",
        mission="Own audit, legal review, policy, compliance, governance, and risk controls.",
        keywords=("legal", "compliance", "audit", "policy", "risk", "contract", "governance"),
    ),
)


TASK_TYPE_KEYWORDS = {
    "build_fix": ("fix", "bug", "build", "error", "crash", "fail", "patch"),
    "audit": ("audit", "review", "qa", "security", "risk", "compliance"),
    "report": ("report", "summary", "status", "kpi", "baseline"),
    "plan": ("plan", "roadmap", "design", "architecture", "spec"),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def stable_id(prefix: str, text: str) -> str:
    value = 0
    for char in text:
        value = ((value << 5) - value + ord(char)) & 0xFFFFFFFF
    return f"{prefix}-{value:08x}"


def score_keywords(text: str, keywords: tuple[str, ...]) -> int:
    return sum(1 for keyword in keywords if keyword in text)


def classify_task(text: str) -> str:
    normalized = text.lower()
    scored = [
        (task_type, score_keywords(normalized, keywords))
        for task_type, keywords in TASK_TYPE_KEYWORDS.items()
    ]
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[0][0] if scored and scored[0][1] > 0 else "plan"


def select_company(task_text: str, task_type: str) -> CompanyProfile:
    normalized = f"{task_text} {task_type}".lower()
    scored = []
    for company in COMPANIES:
        score = score_keywords(normalized, company.keywords)
        if task_type == "build_fix" and company.id == "it_ai":
            score += 8
        if task_type == "build_fix" and company.id == "engineering":
            score += 1
        if task_type == "audit" and company.id == "legal_compliance":
            score += 2
        scored.append((company, score))
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[0][0] if scored[0][1] > 0 else next(c for c in COMPANIES if c.id == "it_ai")


def parse_task(message: str, source: str = "telegram") -> Task:
    raw = message.strip()
    task_type = classify_task(raw)
    company = select_company(raw, task_type)
    priority = "high" if re.search(r"\b(p0|urgent|critical|khẩn|gấp)\b", raw, re.I) else "normal"
    return Task(
        id=stable_id("task", raw or "empty"),
        raw=raw,
        source=source,
        assigned_company=company.id,
        task_type=task_type,
        priority=priority,
        created_at=utc_now(),
    )


def load_company_kb(company_id: str) -> dict[str, Any]:
    candidates = [
        KNOWLEDGE_BASE_PATH / "companies" / f"{company_id}.json",
        KNOWLEDGE_BASE_PATH / f"{company_id}.json",
        KNOWLEDGE_BASE_PATH / "stats.json",
    ]
    for path in candidates:
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                return {"source": str(path), "warning": "Invalid JSON; skipped structured context."}
    return {"context": "No company-specific KB data yet.", "source": "default"}


def generate_prompt(task: Task, company: CompanyProfile) -> str:
    kb_data = load_company_kb(company.id)
    context = kb_data.get("context") or kb_data.get("summary") or json.dumps(kb_data)[:1200]
    return "\n".join(
        [
            f"[{company.name} PROMPT]",
            f"Mission: {company.mission}",
            f"Task: {task.raw}",
            f"Task type: {task.task_type}",
            f"Priority: {task.priority}",
            "",
            "Offline KB context:",
            str(context),
            "",
            "Execution rules:",
            "- Work offline; Telegram is only an adapter for input/output.",
            "- Dev proposes build/fix steps and patches before mutation.",
            "- QA runs independently in parallel and reports risks.",
            "- High-risk or destructive operations require human approval.",
        ]
    )


def dev_handler(task: Task, company: CompanyProfile, prompt: str) -> AgentResult:
    time.sleep(0.05)
    commands = ["npm run build", "npm test"]
    if task.task_type == "build_fix":
        commands.append("npm run test:integration")
    return AgentResult(
        role="Dev",
        company=company.name,
        status="proposal-ready",
        summary=f"Dev prepared an offline build/fix plan for: {task.raw}",
        details={
            "prompt_digest": stable_id("prompt", prompt),
            "proposed_commands": commands,
            "patch_policy": "proposal-only",
        },
    )


def qa_handler(task: Task, company: CompanyProfile, prompt: str) -> AgentResult:
    time.sleep(0.05)
    risk_terms = ("payment", "auth", "security", "ledger", "deploy", "token", "secret")
    risk_level = "medium" if any(term in task.raw.lower() for term in risk_terms) else "low"
    return AgentResult(
        role="QA",
        company=company.name,
        status="review-required" if risk_level == "medium" else "provisionally-approved",
        summary=f"QA prepared an independent audit plan for: {task.raw}",
        details={
            "prompt_digest": stable_id("qa", prompt),
            "risk_level": risk_level,
            "checklist": [
                "offline-policy",
                "command-policy",
                "build-test-lint",
                "rollback-path",
                "secret-scan",
            ],
        },
    )


def run_parallel_dev_qa(task: Task, company: CompanyProfile, prompt: str) -> list[AgentResult]:
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(dev_handler, task, company, prompt),
            executor.submit(qa_handler, task, company, prompt),
        ]
        return [future.result() for future in futures]


def log_event(event: dict[str, Any]) -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = LOG_DIR / "events.jsonl"
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    return path


def format_telegram_summary(task: Task, company: CompanyProfile, results: list[AgentResult]) -> str:
    lines = [
        f"Task {task.id}: {task.raw}",
        f"Assigned company: {company.name}",
        f"Type/Priority: {task.task_type}/{task.priority}",
    ]
    for result in results:
        lines.append(f"- {result.role}: {result.status} — {result.summary}")
    return "\n".join(lines)


def execute_task(message: str, source: str = "telegram") -> dict[str, Any]:
    task = parse_task(message, source=source)
    company = next(c for c in COMPANIES if c.id == task.assigned_company)
    prompt = generate_prompt(task, company)
    results = run_parallel_dev_qa(task, company, prompt)
    summary = format_telegram_summary(task, company, results)
    event = {
        "task": asdict(task),
        "company": asdict(company),
        "results": [asdict(result) for result in results],
        "summary": summary,
        "logged_at": utc_now(),
    }
    log_event(event)
    return event


class OfflineTaskDispatcher:
    def __init__(self, output: Callable[[str], None] = print, workers: int = MAX_WORKERS):
        self.output = output
        self.tasks: queue.Queue[str | None] = queue.Queue()
        self.workers = max(1, workers)
        self.threads: list[threading.Thread] = []

    def start(self) -> None:
        for index in range(self.workers):
            thread = threading.Thread(target=self._worker, name=f"super-agent-worker-{index}", daemon=True)
            thread.start()
            self.threads.append(thread)

    def stop(self) -> None:
        for _ in self.threads:
            self.tasks.put(None)
        for thread in self.threads:
            thread.join(timeout=2)

    def submit(self, message: str) -> None:
        self.tasks.put(message)

    def _worker(self) -> None:
        while True:
            message = self.tasks.get()
            if message is None:
                self.tasks.task_done()
                return
            try:
                event = execute_task(message, source="dispatcher")
                self.output(event["summary"])
            finally:
                self.tasks.task_done()


def start_telegram_bot() -> None:
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
        event = execute_task(update.message.text, source="telegram")
        await update.message.reply_text(event["summary"])

    app = ApplicationBuilder().token(token).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, telegram_handler))
    print("[TELEGRAM BOT STARTED] Offline command center is listening.")
    app.run_polling()


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline Super Agent prototype")
    parser.add_argument("--task", action="append", help="Task to execute in offline simulation mode.")
    parser.add_argument("--telegram", action="store_true", help="Start Telegram adapter.")
    parser.add_argument("--workers", type=int, default=MAX_WORKERS, help="Dispatcher worker count for --task batch mode.")
    parser.add_argument("--json", action="store_true", help="Print JSON event output instead of Telegram-style summary.")
    args = parser.parse_args()

    if args.telegram:
        start_telegram_bot()
        return 0

    tasks = args.task or ["Fix bug module payment"]
    dispatcher = OfflineTaskDispatcher(
        output=lambda text: None if args.json else print(text),
        workers=min(max(args.workers, 1), MAX_WORKERS),
    )

    if args.json:
        events = [execute_task(task, source="cli") for task in tasks]
        print(json.dumps(events, ensure_ascii=False, indent=2))
        return 0

    dispatcher.start()
    for task in tasks:
        dispatcher.submit(task)
    dispatcher.tasks.join()
    dispatcher.stop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
