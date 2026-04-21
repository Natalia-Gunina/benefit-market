@echo off
REM Clear inherited bad OPENSSL_CONF (system-level points to a missing file on this box)
set "OPENSSL_CONF="

REM Prefer fnm's managed Node if it exists — system Node may be < 20
if exist "%APPDATA%\fnm\node-versions\v22.22.2\installation\npm.cmd" (
    "%APPDATA%\fnm\node-versions\v22.22.2\installation\npm.cmd" run dev
    exit /b %ERRORLEVEL%
)

npm run dev
exit /b %ERRORLEVEL%
