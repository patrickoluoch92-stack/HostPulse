# Start API + Frontend, then open browser.
# Run from repo root: .\run-frontend.ps1
# Both servers must run for login/register to work (proxy needs API on port 3000).

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "HostPulse - Starting API + Frontend..."
Write-Host ""
Write-Host "1. Starting API (NestJS) on port 3000..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; Write-Host 'API Server'; npx nx run api:serve"

Write-Host "2. Waiting 10 seconds for API to be ready..."
Start-Sleep -Seconds 10

Write-Host "3. Starting Frontend (Next.js) on port 4200..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; Write-Host 'Frontend Server'; npx nx run apps:dev"

Write-Host "4. Waiting 15 seconds for frontend to be ready..."
Start-Sleep -Seconds 15

Write-Host "5. Opening browser at http://127.0.0.1:4200"
Start-Process "http://127.0.0.1:4200"
Write-Host ""
Write-Host "Done. If connection refused, wait 10 more seconds and refresh."
