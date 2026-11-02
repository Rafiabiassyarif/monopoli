@echo off
title Monopoli 3D - server (jangan ditutup selama main)
cd /d "%~dp0"
echo.
echo  ==== MONOPOLI 3D ====
echo.
where node >/dev/null 2>nul
if errorlevel 1 (
  echo  Node.js belum terpasang. Halaman unduhan Node.js akan dibuka.
  echo  Pasang versi LTS, lalu klik dua kali file ini lagi.
  start "" https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\concurrently" (
  echo  Memasang paket pertama kali, tunggu sebentar...
  call npm install
  if errorlevel 1 (
    echo  Gagal memasang paket. Kirim screenshot jendela ini.
    pause
    exit /b 1
  )
)
echo  Menyalakan game... browser akan terbuka otomatis di http://localhost:5180
echo  Biarkan jendela ini terbuka selama bermain. Tutup jendela ini untuk mematikan game.
echo.
start "" cmd /c "timeout /t 8 /nobreak >/dev/null & start http://localhost:5180"
call npm run dev
echo.
echo  Server berhenti. Kalau ada tulisan error di atas, kirim screenshot jendela ini.
pause
