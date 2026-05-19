#!/usr/bin/env python3
"""
Super Agent Offline 100x prototype.

This extends the base offline command center with:
- Offline task DB polling.
- Multi-company worker pool.
- Dev/QA parallel execution.
- Sandbox-only auto patching with snapshot rollback.
- Optional Telegram adapter.

The prototype intentionally patches only files under:
    .super-agent-100x/workspace/

That keeps auto-fix behavior demonstrable without mutating production source.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import queue
import re
import shutil
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows fallback
    fcntl = None


ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = ROOT / ".super-agent-100x"
WORKSPACE_DIR = STATE_DIR / "workspace"
SNAPSHOT_DIR = STATE_DIR / "snapshots"
TASK_DB_PATH = STATE_DIR / "task_db.json"
LOG_DIR = STATE_DIR / "logs"
KNOWLEDGE_BASE_PATH = ROOT / "kb"
MAX_WORKERS = 32


@dataclass(frozen=True)
class CompanyProfile:
    id: str
    name: str
    mission: str
    keywords: tuple[str, ...]
    scale_units: int = 100


@dataclass
class OfflineTask:
    id: str
    desc: str
    status: str = "pending"
    source: str = "db"
    priority: str = "normal"
    assigned_company: str | None = None
    task_type: str | None = None
    patch: dict[str, Any] | None = None
    attempts: int = 0
    created_at: str = ""
    updated_at: str = ""


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
        mission="Explore prototypes, experiments, benchmark design, and invention-heavy tasks.",
        keywords=("research", "prototype", "experiment", "benchmark", "innovation", "r&d"),
    ),
    CompanyProfile(
        id="engineering",
        name="Engineering",
        mission="Own implementation quality, build systems, production readiness, and reliability.",
        keywords=("engineering", "build", "fix", "bug", "test", "lint", "deploy", "module"),
    ),
    CompanyProfile(
        id="it_ai",
        name="IT_AI",
        mission="Own AI workflows, local agents, code automation, LLM routing, and Telegram bridge.",
        keywords=("ai", "agent", "code", "coding", "llm", "telegram", "visual studio", "vs", "parser"),
    ),
    CompanyProfile(
        id="finance_invest",
        name="Finance_Invest",
        mission="Own payment, ledger, accounting, investment, tax, and finance controls.",
        keywords=("finance", "payment", "invoice", "ledger", "accounting", "tax", "investment"),
    ),
    CompanyProfile(
        id="marketing",
        name="Marketing",
        mission="Own growth, reports, campaign work, positioning, SEO, and customer narratives.",
        keywords=("marketing", "sales", "report", "seo", "campaign", "brand", "customer"),
    ),
    CompanyProfile(
        id="logistics",
        name="Logistics",
        mission="Own operations, routing, delivery, resource planning, and incident movement.",
        keywords=("logistics", "supply", "routing", "delivery", "ops", "operation", "warehouse"),
    ),
    CompanyProfile(
        id="hr_culture",
        name="HR_Culture",
        mission="Own hiring, team design, culture, training, handbook, and internal standards.",
        keywords=("hr", "hiring", "jd", "people", "culture", "training", "handbook"),
    ),
    CompanyProfile(
        id="legal_compliance",
        name="Legal_Compliance",
        mission="Own legal, compliance, audit, policy, risk, and governance review.",
        keywords=("legal", "compliance", "audit", "policy", "risk", "contract", "governance"),
    ),
)


TASK_TYPE_KEYWORDS = {
    "build_fix": ("fix", "bug", "build", "error", "crash", "fail", "patch"),
    "audit": ("audit", "review", "qa", "security", "risk", "compliance"),
    "report": ("report", "summary", "status", "kpi", "baseline"),
    "plan": ("plan", "roadmap", "design", "architecture", "spec"),
}


class TaskDB:
    def __init__(self, path: Path = TASK_DB_PATH):
        self.path = path
        self.lock_path = self.path.with_suffix(".lock")
        self.lock = threading.RLock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._write([])

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

    def _read(self) -> list[dict[str, Any]]:
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _write(self, rows: list[dict[str, Any]]) -> None:
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, self.path)

    def list(self) -> list[OfflineTask]:
        with self.lock, self._file_lock():
            return [OfflineTask(**normalize_task_row(row)) for row in self._read()]

    def add(self, desc: str, *, source: str = "cli", patch: dict[str, Any] | None = None) -> OfflineTask:
        now = utc_now()
        task = OfflineTask(
            id=stable_id("task", f"{now}:{desc}"),
            desc=desc.strip(),
            source=source,
            patch=patch,
            created_at=now,
            updated_at=now,
        )
        with self.lock, self._file_lock():
            rows = self._read()
            rows.append(asdict(task))
            self._write(rows)
        return task

    def pending(self, limit: int = 100) -> list[OfflineTask]:
        with self.lock, self._file_lock():
            rows = self._read()
            pending = []
            for row in rows:
                task = OfflineTask(**normalize_task_row(row))
                if task.status == "pending":
                    pending.append(task)
                if len(pending) >= limit:
                    break
            return pending

    def claim(self, task_id: str) -> bool:
        with self.lock, self._file_lock():
            rows = self._read()
            claimed = False
            for row in rows:
                if row.get("id") == task_id and row.get("status", "pending") == "pending":
                    row["status"] = "running"
                    row["attempts"] = int(row.get("attempts", 0)) + 1
                    row["updated_at"] = utc_now()
                    claimed = True
                    break
            self._write(rows)
            return claimed

    def complete(self, task_id: str, status: str, event: dict[str, Any]) -> None:
        with self.lock, self._file_lock():
            rows = self._read()
            for row in rows:
                if row.get("id") == task_id:
                    row["status"] = status
                    row["result"] = event
                    row["updated_at"] = utc_now()
                    break
            self._write(rows)


class PatchSandbox:
    def __init__(self, workspace: Path = WORKSPACE_DIR, snapshots: Path = SNAPSHOT_DIR):
        self.workspace = workspace.resolve()
        self.snapshots = snapshots.resolve()
        self.workspace.mkdir(parents=True, exist_ok=True)
        self.snapshots.mkdir(parents=True, exist_ok=True)

    def apply_patch(self, task: OfflineTask) -> dict[str, Any]:
        patch = task.patch or self._default_patch(task)
        target = self._safe_target(patch.get("target", f"{task.id}.txt"))
        content = str(patch.get("content", self._default_content(task)))
        mode = str(patch.get("mode", "append"))

        snapshot = self._snapshot(target, task.id)
        before = target.read_text(encoding="utf-8") if target.exists() else ""

        if mode == "replace":
            target.write_text(content, encoding="utf-8")
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            existing = before
            separator = "" if existing.endswith("\n") or not existing else "\n"
            target.write_text(f"{existing}{separator}{content}\n", encoding="utf-8")

        return {
            "target": str(target.relative_to(ROOT)),
            "snapshot": str(snapshot.relative_to(ROOT)) if snapshot else None,
            "mode": mode,
            "changed": before != target.read_text(encoding="utf-8"),
        }

    def rollback(self, patch_result: dict[str, Any]) -> dict[str, Any]:
        target = (ROOT / patch_result["target"]).resolve()
        snapshot_rel = patch_result.get("snapshot")
        if not self._is_under(target, self.workspace):
            raise ValueError("Rollback target escaped sandbox workspace.")
        if not snapshot_rel:
            target.unlink(missing_ok=True)
            return {"rolled_back": True, "target": str(target.relative_to(ROOT)), "mode": "delete-created"}

        snapshot = (ROOT / snapshot_rel).resolve()
        if snapshot.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(snapshot, target)
            return {"rolled_back": True, "target": str(target.relative_to(ROOT)), "mode": "restore-snapshot"}
        return {"rolled_back": False, "target": str(target.relative_to(ROOT)), "reason": "snapshot-missing"}

    def _safe_target(self, target: str) -> Path:
        safe = (self.workspace / target).resolve()
        if not self._is_under(safe, self.workspace):
            raise ValueError("Patch target must stay under .super-agent-100x/workspace.")
        safe.parent.mkdir(parents=True, exist_ok=True)
        return safe

    def _snapshot(self, target: Path, task_id: str) -> Path | None:
        if not target.exists():
            return None
        snapshot = self.snapshots / task_id / target.relative_to(self.workspace)
        snapshot.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, snapshot)
        return snapshot

    def _default_patch(self, task: OfflineTask) -> dict[str, Any]:
        return {
            "target": f"{task.assigned_company or 'unassigned'}/{task.id}.md",
            "mode": "replace",
            "content": self._default_content(task),
        }

    @staticmethod
    def _default_content(task: OfflineTask) -> str:
        return "\n".join(
            [
                f"# Auto Patch Simulation: {task.id}",
                "",
                f"Task: {task.desc}",
                f"Status: generated by offline 100x prototype",
            ]
        )

    @staticmethod
    def _is_under(path: Path, parent: Path) -> bool:
        try:
            path.relative_to(parent)
            return True
        except ValueError:
            return False


class SuperAgent100x:
    def __init__(self, db: TaskDB | None = None, workers: int = MAX_WORKERS):
        self.db = db or TaskDB()
        self.workers = min(max(workers, 1), MAX_WORKERS)
        self.patch_sandbox = PatchSandbox()
        self.feedback: queue.Queue[dict[str, Any]] = queue.Queue()

    def seed_task(self, desc: str, patch: dict[str, Any] | None = None) -> OfflineTask:
        return self.db.add(desc, source="seed", patch=patch)

    def process_pending_once(self, limit: int = 100) -> list[dict[str, Any]]:
        tasks = self.db.pending(limit=limit)
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

    def monitor(self, interval: float = 5.0, once: bool = False) -> None:
        while True:
            events = self.process_pending_once()
            for event in events:
                print(event["summary"])
            if once:
                return
            time.sleep(interval)

    def _process_task_if_claimed(self, task: OfflineTask) -> dict[str, Any] | None:
        if not self.db.claim(task.id):
            return None
        try:
            event = self.execute(task)
            final_status = "done" if event["qa"]["status"] != "failed" else "failed"
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
            log_event(error_event)
            return error_event

    def execute(self, task: OfflineTask) -> dict[str, Any]:
        enriched = enrich_task(task)
        company = get_company(enriched.assigned_company or "it_ai")
        prompt = generate_prompt(enriched, company)

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
        log_event(event)
        return event

    def _dev_autopatch(self, task: OfflineTask, company: CompanyProfile, prompt: str) -> AgentResult:
        patch_result = self.patch_sandbox.apply_patch(task)
        return AgentResult(
            role="Dev",
            company=company.name,
            status="patched-in-sandbox",
            summary=f"Applied sandbox patch for {task.id}.",
            details={
                "prompt_digest": stable_id("prompt", prompt),
                "patch_result": patch_result,
                "verification_commands": ["python3 -m py_compile prototypes/super_agent_offline_100x.py"],
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
            summary=f"QA audit completed for {task.id}.",
            details={
                "prompt_digest": stable_id("qa", prompt),
                "risk_level": "medium" if risky else "low",
                "continuous_checks": [
                    "sandbox-boundary",
                    "snapshot-created",
                    "rollback-available",
                    "offline-policy",
                    "secret-scan-required-before-production-apply",
                ],
            },
        )


def normalize_task_row(row: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {
        "id": str(row.get("id") or stable_id("task", str(row))),
        "desc": str(row.get("desc") or row.get("task") or ""),
        "status": str(row.get("status") or "pending"),
        "source": str(row.get("source") or "db"),
        "priority": str(row.get("priority") or "normal"),
        "assigned_company": row.get("assigned_company"),
        "task_type": row.get("task_type"),
        "patch": row.get("patch"),
        "attempts": int(row.get("attempts") or 0),
        "created_at": str(row.get("created_at") or now),
        "updated_at": str(row.get("updated_at") or now),
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
    return scored[0][0] if scored[0][1] > 0 else get_company("it_ai")


def enrich_task(task: OfflineTask) -> OfflineTask:
    task_type = task.task_type or classify_task(task.desc)
    company = get_company(task.assigned_company) if task.assigned_company else select_company(task.desc, task_type)
    task.task_type = task_type
    task.assigned_company = company.id
    task.priority = "high" if re.search(r"\b(p0|urgent|critical|khẩn|gấp)\b", task.desc, re.I) else task.priority
    task.updated_at = utc_now()
    return task


def get_company(company_id: str | None) -> CompanyProfile:
    for company in COMPANIES:
        if company.id == company_id:
            return company
    return next(company for company in COMPANIES if company.id == "it_ai")


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


def generate_prompt(task: OfflineTask, company: CompanyProfile) -> str:
    kb_data = load_company_kb(company.id)
    context = kb_data.get("context") or kb_data.get("summary") or json.dumps(kb_data)[:1200]
    return "\n".join(
        [
            f"[{company.name} 100x PROMPT]",
            f"Mission: {company.mission}",
            f"Task: {task.desc}",
            f"Task type: {task.task_type}",
            f"Priority: {task.priority}",
            "",
            "Offline KB context:",
            str(context),
            "",
            "Execution rules:",
            "- Work offline except optional Telegram adapter.",
            "- Auto-patch only inside .super-agent-100x/workspace.",
            "- Create a snapshot before mutation.",
            "- Roll back automatically if QA fails.",
            "- Production source edits require explicit approval outside this prototype.",
        ]
    )


def format_summary(
    task: OfflineTask,
    company: CompanyProfile,
    dev: AgentResult,
    qa: AgentResult,
    rollback: dict[str, Any] | None,
) -> str:
    lines = [
        f"Task {task.id}: {task.desc}",
        f"Assigned company: {company.name}",
        f"Type/Priority: {task.task_type}/{task.priority}",
        f"- Dev: {dev.status} — {dev.summary}",
        f"- QA: {qa.status} — {qa.summary}",
    ]
    if rollback:
        lines.append(f"- Rollback: {rollback}")
    return "\n".join(lines)


def log_event(event: dict[str, Any]) -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = LOG_DIR / "events.jsonl"
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    return path


def start_telegram_bot(agent: SuperAgent100x) -> None:
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
        task = agent.db.add(update.message.text, source="telegram")
        await update.message.reply_text(f"Queued offline task {task.id}.")

    app = ApplicationBuilder().token(token).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, telegram_handler))
    print("[TELEGRAM BOT STARTED] 100x offline task queue is listening.")
    app.run_polling()


def parse_patch(raw: str | None) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        patch = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"--patch must be valid JSON: {exc}") from exc
    if not isinstance(patch, dict):
        raise SystemExit("--patch must decode to a JSON object.")
    return patch


def main() -> int:
    parser = argparse.ArgumentParser(description="Super Agent Offline 100x prototype")
    parser.add_argument("--task", action="append", help="Add task(s) to offline DB before processing.")
    parser.add_argument("--patch", help="JSON patch object for the last --task.")
    parser.add_argument("--once", action="store_true", help="Process pending DB tasks once and exit.")
    parser.add_argument("--monitor", action="store_true", help="Continuously monitor offline task DB.")
    parser.add_argument("--interval", type=float, default=5.0, help="Monitor polling interval in seconds.")
    parser.add_argument("--workers", type=int, default=MAX_WORKERS, help="Worker count, capped at 32.")
    parser.add_argument("--telegram", action="store_true", help="Start optional Telegram adapter.")
    parser.add_argument("--json", action="store_true", help="Print JSON for --once output.")
    args = parser.parse_args()

    agent = SuperAgent100x(workers=args.workers)

    patches = [None] * len(args.task or [])
    if args.patch and args.task:
        patches[-1] = parse_patch(args.patch)

    for desc, patch in zip(args.task or [], patches):
        task = agent.seed_task(desc, patch=patch)
        print(f"Queued {task.id}: {task.desc}")

    if args.telegram:
        telegram_thread = threading.Thread(target=start_telegram_bot, args=(agent,), daemon=True)
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

    if args.telegram and not args.monitor:
        print("Telegram adapter started. Use --monitor to keep processing queued tasks continuously.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
