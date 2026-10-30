@echo off
cd /d "%~dp0"
set "NODE_EXE="
for /d %%D in ("%~dp0.runtime\node-*-win-x64") do set "NODE_EXE=%%D\node.exe"
if not defined NODE_EXE set "NODE_EXE=node"
start "" http://localhost:8765
"%NODE_EXE%" server.mjs
pause
