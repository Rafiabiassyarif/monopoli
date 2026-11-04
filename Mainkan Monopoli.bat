@echo off
title Monopoli 3D - server (jangan ditutup selama main)
cd /d "%~dp0"
echo.
echo  ==== MONOPOLI 3D ====
echo.
where node >nul 2>nul
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
rem buka browser setelah port 5180 benar-benar siap (maks 2 menit)
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 120;$i++){try{$c=New-Object Net.Sockets.TcpClient('localhost',5180);$c.Close();Start-Process 'http://localhost:5180';break}catch{Start-Sleep 1}}"
call npm run dev
echo.
echo  Server berhenti. Kalau ada tulisan error di atas, kirim screenshot jendela ini.
pause
