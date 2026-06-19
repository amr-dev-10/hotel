@echo off

cd /d "C:\Users\Lenovo\Documents\Hotel Managment"

start "FastAPI" powershell -NoExit -Command ^
".\.venv-win\Scripts\activate;  uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000;"

timeout /t 5

start "Ngrok" powershell -NoExit -Command ^
"ngrok http 8000"


start "Next js" powershell -NoExit -Command ^
" pnpm dev:dashboard"
