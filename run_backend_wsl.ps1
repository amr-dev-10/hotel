$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$WslProjectRoot = "/mnt/c/Users/Lenovo/Documents/Hotel Managment"
$LogDir = Join-Path $ProjectRoot "backend"
$OutLog = Join-Path $LogDir "uvicorn.out.log"
$ErrLog = Join-Path $LogDir "uvicorn.err.log"

Write-Host "Starting Arcadia backend in WSL..."
Write-Host "Project: $ProjectRoot"

$portCheck = netstat -ano | Select-String ":8000"
if ($portCheck) {
    Write-Host "Port 8000 already appears to be in use."
    Write-Host "Open: http://localhost:8000/health"
    exit 0
}

$command = @"
cd '$WslProjectRoot'
if [ ! -x .venv/bin/python ]; then
  echo 'Missing WSL virtualenv at .venv/bin/python. Create it before running this script.' >&2
  exit 1
fi
. .venv/bin/activate
exec uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
"@

$encodedCommand = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($command))

$process = Start-Process `
    -FilePath "wsl" `
    -ArgumentList @("bash", "-lc", "echo $encodedCommand | base64 -d | bash") `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -PassThru

Start-Sleep -Seconds 3

try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 8
    Write-Host "Backend started. Health: $($health | ConvertTo-Json -Compress)"
    Write-Host "Docs: http://localhost:8000/docs"
    Write-Host "Process ID: $($process.Id)"
    Write-Host "Logs: $OutLog"
} catch {
    Write-Host "Backend did not respond yet. Check logs:"
    Write-Host $OutLog
    Write-Host $ErrLog
    exit 1
}
