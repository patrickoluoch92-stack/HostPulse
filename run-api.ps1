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
    cmd = 'npx';
    args = ['ts-node', '--transpile-only', path.join(rootDir, 'api', 'src', 'main.ts')];
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
