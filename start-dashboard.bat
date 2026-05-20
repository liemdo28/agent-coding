@echo off
chcp 65001 >nul
echo Khoi dong Local Agent Dashboard...
cd /d "%~dp0"
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo Node.js chua cai. Tai tai: https://nodejs.org
  pause & exit /b 1
)
npm install --silent
start /b npm run ui
echo Dang khoi dong server...
timeout /t 4 /nobreak >nul
curl -s --connect-timeout 2 http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo ⚠️  Chat AI chua san sang - Ollama chua chay.
  echo    Xem huong dan: docs\setup\local-llm.md
  echo    Dashboard van mo binh thuong, chi trang Chat bi anh huong.
  echo.
)
start http://localhost:4001
echo Dashboard + API dang chay chung tai http://localhost:4001. Dong cua so nay de dung.
pause
