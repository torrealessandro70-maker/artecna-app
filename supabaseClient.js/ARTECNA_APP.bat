@echo off
cd /d C:\Users\torre\artecna-app
start cmd /k "npm run dev"
timeout /t 5 >nul
start http://localhost:3000