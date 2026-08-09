@echo off
setlocal
cd /d "%~dp0"
title Comunidade Santa Luzia

echo ===============================================
echo Comunidade Santa Luzia - Inicializacao segura
echo ===============================================
echo.
echo Encerrando servidores Next.js antigos...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -match 'node.exe') -and ($_.CommandLine -match 'next') } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }"

timeout /t 2 /nobreak >nul

echo Limpando cache .next...
if exist ".next" rmdir /S /Q ".next"

echo.
echo Iniciando o site...
echo Abra no navegador: http://localhost:3000
echo.
npm run dev

endlocal
