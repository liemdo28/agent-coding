#!/bin/bash
cd "$(dirname "$0")"
echo "🚀 Khởi động Local Agent Dashboard..."
if ! command -v node &>/dev/null; then
  echo "❌ Node.js chưa cài. Tải tại: https://nodejs.org"; read -p "Nhấn Enter để thoát"; exit 1
fi
npm install --silent 2>/dev/null
npm run ui:server &
SERVER_PID=$!
echo "⏳ Đang khởi động server..."
sleep 3
# open browser
open "http://localhost:4001" 2>/dev/null || xdg-open "http://localhost:4001" 2>/dev/null
echo "✅ Dashboard đang chạy tại http://localhost:4001"
echo "   Nhấn Ctrl+C để dừng."
wait $SERVER_PID
