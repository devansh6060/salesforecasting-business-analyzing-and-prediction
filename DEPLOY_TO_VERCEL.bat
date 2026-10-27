@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required.
  echo Download it from https://nodejs.org/
  pause
  exit /b 1
)

echo Starting the Vercel production deployment...
echo Sign in and accept the detected project settings when prompted.
call npx vercel@latest --prod
pause
