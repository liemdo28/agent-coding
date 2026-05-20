#!/bin/bash
cd "$(dirname "$0")"
echo "🚀 Khởi động Local Agent Dashboard..."
if ! command -v node &>/dev/null; then
  echo "❌ Node.js chưa cài. Tải tại: https://nodejs.org"; read -p "Nhấn Enter để thoát"; exit 1
fi
npm install --silent 2>/dev/null
npm run ui &
SERVER_PID=$!
echo "⏳ Đang khởi động server..."
sleep 3
# Check Ollama / LLM
if ! curl -s --connect-timeout 2 http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo ""
  echo "⚠️  Chat AI chưa sẵn sàng — Ollama chưa chạy."
  echo "   Xem hướng dẫn: docs/setup/local-llm.md"
  echo "   (Dashboard vẫn mở bình thường, chỉ trang Chat bị ảnh hưởng)"
  echo ""
fi
# open browser
open "http://localhost:4001" 2>/dev/null || xdg-open "http://localhost:4001" 2>/dev/null
echo "✅ Dashboard + API đang chạy chung tại http://localhost:4001"
echo "   Nhấn Ctrl+C để dừng."
wait $SERVER_PID
