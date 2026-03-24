@echo off
:: Voir CLI launcher for Windows
:: Usage: voir.cmd README.md

setlocal

:: Try common installation paths
set "VOIR_EXE="

if exist "%LOCALAPPDATA%\Voir\Voir.exe" (
    set "VOIR_EXE=%LOCALAPPDATA%\Voir\Voir.exe"
) else if exist "%ProgramFiles%\Voir\Voir.exe" (
    set "VOIR_EXE=%ProgramFiles%\Voir\Voir.exe"
) else (
    where Voir.exe >nul 2>&1
    if %errorlevel% equ 0 (
        for /f "tokens=*" %%i in ('where Voir.exe') do set "VOIR_EXE=%%i"
    )
)

if "%VOIR_EXE%"=="" (
    echo Error: Voir executable not found.
    echo Please install Voir or add it to PATH.
    exit /b 1
)

:: Pass all arguments to Voir
start "" "%VOIR_EXE%" %*
