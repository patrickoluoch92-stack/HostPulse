# Run API Server Script
# Workaround for Windows trailing dot directory issue

$ErrorActionPreference = "Stop"

Write-Host "Building API..." -ForegroundColor Cyan
node -e "const { execSync } = require('child_process'); execSync('npx nx run api:build --configuration=development', { stdio: 'inherit', cwd: process.cwd() });"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Trying direct NestJS build..." -ForegroundColor Yellow
    Push-Location (Join-Path $PSScriptRoot "api")
    try {
        npx nest build
    } finally {
        Pop-Location
    }
}

Write-Host "`nStarting API server..." -ForegroundColor Green
Write-Host "Server will be available at: http://localhost:3000/api" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Gray

# If a process is already listening on the preferred port and it belongs to this workspace, stop it first
try {
    $preferredPort = if ($env:PORT) { [int]$env:PORT } else { 5000 }
    $listeners = Get-NetTCPConnection -LocalPort $preferredPort -ErrorAction SilentlyContinue
    if ($listeners) {
        $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($pid in $pids) {
            $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$pid" -ErrorAction SilentlyContinue
            if ($proc) {
                $cmd = $proc.CommandLine
                if ($cmd -and $cmd.ToLower().Contains($PSScriptRoot.ToLower())) {
                    Write-Host "Found existing project process listening on port $preferredPort (PID $pid). Stopping it." -ForegroundColor Yellow
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                } else {
                    Write-Host "Port $preferredPort is in use by another process (PID $pid). Will not kill unrelated processes." -ForegroundColor Red
                    Write-Host "Change PORT or stop the process manually: $cmd" -ForegroundColor Red
                    exit 1
                }
            }
        }
    }
} catch {
    Write-Host "Warning: failed to probe existing listeners: $_" -ForegroundColor Yellow
}

# Use Node.js directly to avoid PowerShell path issues
# Load .env from project root so DATABASE_URL and other vars are available
node -e "
require('dotenv').config({ path: require('path').join(process.cwd(), '.env') });
const { spawn } = require('child_process');
const path = require('path');
const rootDir = process.cwd();
const mainFile = path.join(rootDir, 'api', 'dist', 'main.js');

const fs = require('fs');
let cmd = 'node';
let args = ['--inspect=0.0.0.0:9229', mainFile];

if (!fs.existsSync(mainFile)) {
    const localTsNode = path.join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'ts-node.cmd' : 'ts-node');
    if (fs.existsSync(localTsNode)) {
        cmd = localTsNode;
        args = ['--transpile-only', path.join(rootDir, 'api', 'src', 'main.ts')];
    } else {
        cmd = 'node';
        args = ['--require', 'ts-node/register/transpile-only', path.join(rootDir, 'api', 'src', 'main.ts')];
    }
}

const proc = spawn(cmd, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
});

proc.on('exit', (code) => {
    process.exit(code || 0);
});
"
