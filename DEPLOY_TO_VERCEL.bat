@echo off
setlocal
cd /d "%~dp0"

rem Use the bundled runtime when Node.js is not on the system PATH.
for /d %%D in ("%~dp0.runtime\node-*-win-x64") do if exist "%%D\node.exe" set "PATH=%%D;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required.
  echo Download it from https://nodejs.org/
  pause
  exit /b 1
)

echo Starting the Vercel production deployment...
echo Sign in, select your existing Vercel account, and link the existing project:
echo salesforecasting-business-analyzing
echo Do not create a new project when updating the existing website.
call npx vercel@latest --prod
pause
