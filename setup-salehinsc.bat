@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  SalehinSc - Windows setup
 echo -------------------------

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git was not found. Install Git for Windows first:
  echo         https://git-scm.com/download/win
  goto :failed
)
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install the current LTS release:
  echo         https://nodejs.org/
  goto :failed
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js with npm included.
  goto :failed
)
if not exist "package.json" (
  echo [ERROR] package.json is missing. Run this script from the SalehinSc project folder.
  goto :failed
)
if not exist "index.html" (
  echo [ERROR] index.html is missing. This does not look like the project root.
  goto :failed
)
if not exist "wrangler.toml" (
  echo [ERROR] wrangler.toml is missing. The Worker configuration cannot be prepared.
  goto :failed
)

node "scripts\setup-salehinsc.cjs"
if errorlevel 1 goto :failed

echo.
echo [SUCCESS] Setup completed. No Git history was deleted and no push was performed.
echo Review the changed files, then follow INSTALL.txt for Cloudflare and Pages deployment.
echo.
pause
exit /b 0

:failed
echo.
echo [FAILED] Setup did not complete. No force-push was attempted.
echo Review the message above and correct the reported issue.
echo.
pause
exit /b 1
