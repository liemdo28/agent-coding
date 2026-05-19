# Cài đặt Local LLM — Hướng dẫn nhanh

Trang **Chat** cần một mô hình AI chạy trên máy. Hệ thống hỗ trợ:
- **Ollama** (khuyến nghị — đơn giản nhất)
- LM Studio
- llama.cpp

---

## Cài Ollama (khuyến nghị)

### macOS / Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Windows
Tải tại: https://ollama.com/download

---

## Tải model và khởi động

```bash
# Tải model nhẹ (~2GB, phù hợp máy thường)
ollama pull llama3.2:3b

# Hoặc model mạnh hơn (~4GB)
ollama pull llama3.1:8b

# Khởi động (thường tự động sau khi cài)
ollama serve
```

Sau khi chạy, Ollama lắng nghe tại `http://localhost:11434`.

---

## Kiểm tra

```bash
curl http://localhost:11434/api/tags
# Kết quả: {"models":[...]} → OK
```

---

## Cấu hình trong hệ thống

Mở `.local-agent/config.json` (tạo nếu chưa có):

```json
{
  "llm": {
    "provider": "ollama",
    "baseUrl": "http://localhost:11434",
    "model": "llama3.2:3b"
  }
}
```

---

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| `Local LLM not reachable` | Ollama chưa chạy | `ollama serve` |
| `model not found` | Chưa tải model | `ollama pull llama3.2:3b` |
| Chậm / treo | RAM không đủ | Dùng model nhẹ hơn: `ollama pull tinyllama` |

---

## LM Studio (thay thế)

1. Tải tại https://lmstudio.ai
2. Tải model trong app
3. Bật "Local Server" tab → Start Server (mặc định cổng `1234`)
4. Cập nhật config: `"baseUrl": "http://localhost:1234/v1", "provider": "lmstudio"`
