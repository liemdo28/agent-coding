# Cài đặt Local LLM — Hướng dẫn nhanh

Trang **Chat** cần một mô hình AI chạy trên máy. Hệ thống hỗ trợ:
- **Ollama** (khuyến nghị — đơn giản nhất)
- LM Studio
- llama.cpp

---

## Cài Ollama (khuyến nghị)

### macOS / Windows
Tải tại: https://ollama.com → cài như app thường, Ollama tự chạy nền sau khi cài.

### Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
```

---

## Tải model

Model mặc định của hệ thống là **`qwen2.5-coder:7b`** — tối ưu cho lập trình và phân tích code.

```bash
# Model khuyến nghị (~4.7GB, phù hợp máy ≥16GB RAM)
ollama pull qwen2.5-coder:7b

# Model nhẹ (~1GB, máy RAM thấp / thử nhanh)
ollama pull qwen2.5-coder:1.5b
```

Sau khi tải xong, kiểm tra:
```bash
ollama list
# Phải thấy: qwen2.5-coder:7b (hoặc 1.5b)
```

---

## Kiểm tra Ollama đang chạy

```bash
curl http://localhost:11434/api/tags
# Kết quả: {"models":[...]} → OK
```

---

## Cấu hình trong hệ thống

File mặc định `local-agent/config/default.json` đã cấu hình sẵn — không cần thay đổi nếu dùng `qwen2.5-coder:7b`.

Nếu muốn dùng model nhẹ hơn, tạo `.local-agent/config.json`:

```json
{
  "llm": {
    "provider": "ollama",
    "baseUrl": "http://localhost:11434",
    "model": "qwen2.5-coder:1.5b"
  }
}
```

---

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| `Local LLM not reachable` | Ollama chưa chạy | Mở app Ollama / `ollama serve` |
| `model not found` | Chưa tải model | `ollama pull qwen2.5-coder:7b` |
| Chậm / treo | RAM không đủ | Dùng `ollama pull qwen2.5-coder:1.5b` |
| Dashboard vẫn lỗi sau khi fix | Cache trạng thái cũ | Tải lại trang Chat |

---

## LM Studio (thay thế)

1. Tải tại https://lmstudio.ai
2. Tải model trong app (tìm `qwen2.5-coder`)
3. Bật "Local Server" tab → Start Server (mặc định cổng `1234`)
4. Cập nhật config: `"baseUrl": "http://localhost:1234/v1", "provider": "lmstudio"`
