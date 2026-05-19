#!/bin/bash
cd "$(dirname "$0")"
echo "🚀 Khởi động Local Agent Dashboard..."
if ! command -v node &>/dev/null; then
  echo "❌ Node.js chưa cài. Tải tại: https://nodejs.org"; exit 1
fi
npm install --silent 2>/dev/null
npm run ui:server &
SERVER_PID=$!
sleep 3
xdg-open "http://localhost:4001" 2>/dev/null &
echo "✅ Dashboard đang chạy tại http://localhost:4001 — Ctrl+C để dừng."
wait $SERVER_PID
