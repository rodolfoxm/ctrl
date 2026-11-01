@echo off
rem Gera a interface (se precisar) e abre o ctrl como administrador (pede UAC).
setlocal
cd /d "%~dp0"
if not exist "dist\index.html" (
  echo Gerando a interface...
  call npx vite build || goto :erro
)
powershell -NoProfile -Command "Start-Process -FilePath '%~dp0node_modules\electron\dist\electron.exe' -ArgumentList '\"%~dp0.\"' -WorkingDirectory '%~dp0' -Verb RunAs"
exit /b 0

:erro
echo Falha ao gerar a interface. Rode "npm install" nesta pasta e tente de novo.
pause
exit /b 1
