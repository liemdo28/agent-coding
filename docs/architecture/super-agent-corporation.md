# Super Agent Corporation — Offline Command Center

This document maps the Telegram + offline super-agent concept into the current Node ESM repo.

## Boundary

- The agent remains offline-first.
- Telegram is the only intended external command/report channel.
- The prototype does not call Telegram directly by default.
- Dev and QA produce proposals and audit results; they do not silently mutate source files.

## Runtime Flow

```txt
Telegram-style task
  -> parseTask()
  -> selectCompany()
  -> retrieveOfflineContext()
  -> generatePrompt()
  -> Promise.all(DevHandler, QAHandler)
  -> formatTelegramSummary()
```

## Divisions

The command center models 8 strategic divisions:

1. Nghiên cứu & Phát triển
2. Kỹ thuật sản xuất
3. Công nghệ thông tin & AI
4. Tài chính & Đầu tư
5. Marketing & Sales toàn cầu
6. Vận hành & Logistics
7. Quản trị nhân sự & Văn hóa doanh nghiệp
8. Pháp chế & Tuân thủ

## Files

- `local-agent/command-center/SuperAgentCorporation.js`
- `bin/super-agent-corp.js`

## Usage

```bash
npm run corp:simulate -- "Fix bug module payment"
npm run corp:simulate -- --json "Audit deployment risk"
npm run corp:simulate -- --save "Fix bug module payment"
```

`--save` writes a runtime report to `.local-agent/command-center/`, which remains ignored by git.

## Next Implementation Steps

- Add a Telegram adapter that is explicitly opt-in via environment variables.
- Add a persistent task queue for Telegram updates.
- Feed Dev proposals into the existing patch proposal system.
- Feed QA checks into the existing QA engine and security reporter.
- Add approval gates before any file-changing action.
