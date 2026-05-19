# Super Agent Offline Python Prototype

## Mục tiêu

Prototype này mô phỏng command center offline cho mô hình "tập đoàn siêu agent":

- 8 công ty chuyên môn: R&D, Engineering, IT/AI, Finance, Marketing, Logistics, HR, Legal.
- Task được parse, phân loại, chọn công ty phụ trách, rồi tạo prompt từ Knowledge Base local.
- Dev và QA chạy song song, độc lập, theo policy proposal-first.
- Telegram chỉ là adapter tùy chọn để nhận lệnh và gửi summary; core workflow không phụ thuộc internet.

## File chính

```txt
prototypes/super_agent_offline.py
logs/super-agent-offline/events.jsonl
kb/
```

## Chạy offline

```bash
python3 prototypes/super_agent_offline.py --task "Fix bug module payment"
```

Chạy nhiều task song song:

```bash
python3 prototypes/super_agent_offline.py \
  --task "Fix bug module payment" \
  --task "Audit deployment risk" \
  --task "Generate monthly marketing report"
```

Xuất JSON để dev/QA đọc bằng tool khác:

```bash
python3 prototypes/super_agent_offline.py --json --task "Audit HR policies"
```

## Telegram adapter

Telegram không bật mặc định. Khi cần thử adapter:

```bash
export TELEGRAM_BOT_TOKEN="..."
python3 prototypes/super_agent_offline.py --telegram
```

Dependency `python-telegram-bot` chỉ cần khi bật `--telegram`; simulation offline không cần package ngoài stdlib.

## Luồng xử lý

```txt
Telegram / CLI task
  -> parse_task()
  -> classify_task()
  -> select_company()
  -> generate_prompt() từ KB local
  -> run_parallel_dev_qa()
  -> log events.jsonl
  -> summary trả về Telegram / stdout
```

## Policy quan trọng

- Không hardcode Telegram token trong source.
- Không tự sửa file production trong prototype; Dev chỉ tạo kế hoạch và command đề xuất.
- QA luôn chạy song song và trả checklist rủi ro.
- Những việc có rủi ro cao như payment, auth, security, ledger, deploy sẽ bị đánh dấu `review-required`.

## Sync vào main

1. Chạy simulation offline.
2. Chạy `python3 -m py_compile prototypes/super_agent_offline.py`.
3. Chạy lại `npm test`, `npm run build`, `npm run lint`.
4. Commit prototype + docs.
5. Push `main` sau khi local branch sạch.

## Next steps

- Nối kết quả prototype vào UI Command Center.
- Thêm KB company-specific ở `kb/companies/*.json`.
- Thêm approval gate để Dev proposal có thể được apply có kiểm soát.
- Thêm scheduler đọc task từ SQLite/local DB.
- Thêm rollback snapshot trước khi cho phép patch thật.
