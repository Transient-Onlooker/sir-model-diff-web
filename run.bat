@echo off
cd /d "%~dp0"

if not exist node_modules (
  echo [run.bat] node_modules not found. Running npm install first...
  call npm.cmd install
  if errorlevel 1 (
    echo [run.bat] npm install failed.
    exit /b 1
  )
)

echo [run.bat] Starting Vite dev server on http://localhost:5173
call npm.cmd run dev -- --host 0.0.0.0
