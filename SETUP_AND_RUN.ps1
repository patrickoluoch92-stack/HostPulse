# HostPulse Setup and Run Script
# This script checks prerequisites, installs dependencies, and sets up the database
# Run this from: C:\Users\DELL\HostPulse\HostPulse (inner workspace folder)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "HostPulse Setup and Verification Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Store original directory
$originalDir = Get-Location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

Write-Host "Script directory: $scriptDir" -ForegroundColor Gray
Write-Host "Repo root: $repoRoot" -ForegroundColor Gray
Write-Host ""

# Step 1: Check Node.js
Write-Host "[1/8] Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Node.js installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ Node.js not found. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Step 2: Check npm
Write-Host "[2/8] Checking npm..." -ForegroundColor Yellow
$npmVersion = npm --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ npm installed: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ npm not found" -ForegroundColor Red
    exit 1
}

# Step 3: Check PostgreSQL
Write-Host "[3/8] Checking PostgreSQL..." -ForegroundColor Yellow
$pgServices = Get-Service | Where-Object { $_.Name -like "*postgres*" -and $_.Status -eq "Running" }
$pgRunning = $false

if ($pgServices) {
    Write-Host "  ✓ PostgreSQL service is running" -ForegroundColor Green
    $pgServices | ForEach-Object { Write-Host "    - $($_.DisplayName)" -ForegroundColor Gray }
    $pgRunning = $true
} else {
    Write-Host "  ⚠ PostgreSQL service not detected via Windows services" -ForegroundColor Yellow
    Write-Host "    Checking if PostgreSQL is listening on port 5432..." -ForegroundColor Gray
    $portCheck = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
    if ($portCheck.TcpTestSucceeded) {
        Write-Host "  ✓ PostgreSQL is listening on port 5432" -ForegroundColor Green
        $pgRunning = $true
    } else {
        Write-Host "  ✗ PostgreSQL not accessible on port 5432" -ForegroundColor Red
        Write-Host "    Please start PostgreSQL service or install PostgreSQL" -ForegroundColor Yellow
    }
}

# Step 4: Check/Install Dependencies
Write-Host "[4/8] Checking dependencies..." -ForegroundColor Yellow
Set-Location $scriptDir
if (Test-Path "node_modules") {
    Write-Host "  ✓ node_modules exists" -ForegroundColor Green
} else {
    Write-Host "  ⚠ node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Dependencies installed successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to install dependencies" -ForegroundColor Red
        Set-Location $originalDir
        exit 1
    }
}

# Step 5: Check .env files (both locations)
Write-Host "[5/8] Checking .env files..." -ForegroundColor Yellow

# Check inner .env (for NestJS API)
$innerEnvPath = Join-Path $scriptDir ".env"
if (Test-Path $innerEnvPath) {
    Write-Host "  ✓ .env file exists in workspace folder" -ForegroundColor Green
    $envContent = Get-Content $innerEnvPath
    $hasDbUrl = $envContent | Select-String "DATABASE_URL"
    $hasJwt = $envContent | Select-String "JWT_ACCESS_SECRET"
    $hasPort = $envContent | Select-String "PORT"
    
    if ($hasDbUrl) { Write-Host "    ✓ DATABASE_URL configured" -ForegroundColor Gray }
    else { Write-Host "    ✗ DATABASE_URL missing" -ForegroundColor Red }
    
    if ($hasJwt) { Write-Host "    ✓ JWT_ACCESS_SECRET configured" -ForegroundColor Gray }
    else { Write-Host "    ✗ JWT_ACCESS_SECRET missing" -ForegroundColor Red }
    
    if ($hasPort) { Write-Host "    ✓ PORT configured" -ForegroundColor Gray }
    else { Write-Host "    ✗ PORT missing" -ForegroundColor Red }
} else {
    Write-Host "  ✗ .env file not found in workspace folder" -ForegroundColor Red
    Write-Host "    Creating .env file with default values..." -ForegroundColor Yellow
    $envContent = @'
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hostpulse?schema=public"
JWT_ACCESS_SECRET="dev-secret-change-me-in-production"
PORT=3000
'@
    $envContent | Out-File -FilePath $innerEnvPath -Encoding utf8
    Write-Host "  ✓ .env file created. PLEASE UPDATE DATABASE CREDENTIALS!" -ForegroundColor Yellow
}

# Check outer .env (for Prisma config)
$outerEnvPath = Join-Path $repoRoot ".env"
if (Test-Path $outerEnvPath) {
    Write-Host "  ✓ .env file exists in repo root (for Prisma)" -ForegroundColor Green
    $outerEnvContent = Get-Content $outerEnvPath
    $outerHasDbUrl = $outerEnvContent | Select-String "DATABASE_URL"
    if ($outerHasDbUrl) {
        Write-Host "    ✓ DATABASE_URL configured in repo root" -ForegroundColor Gray
    } else {
        Write-Host "    ⚠ DATABASE_URL missing in repo root .env" -ForegroundColor Yellow
        Write-Host "      Copying from workspace .env..." -ForegroundColor Gray
        if ($hasDbUrl) {
            $dbUrlLine = ($envContent | Select-String "DATABASE_URL").Line
            Add-Content -Path $outerEnvPath -Value "`n$dbUrlLine"
            Write-Host "      ✓ DATABASE_URL added to repo root .env" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  ⚠ .env file not found in repo root (needed for Prisma)" -ForegroundColor Yellow
    Write-Host "    Creating repo root .env file..." -ForegroundColor Gray
    $outerEnvContent = @'
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hostpulse?schema=public"
'@
    $outerEnvContent | Out-File -FilePath $outerEnvPath -Encoding utf8
    Write-Host "  ✓ Repo root .env file created" -ForegroundColor Green
}

# Step 6: Validate Prisma Schema
Write-Host "[6/8] Validating Prisma schema..." -ForegroundColor Yellow
Set-Location $repoRoot
$schemaPath = Join-Path $repoRoot "prisma\schema.prisma"
if (-not (Test-Path $schemaPath)) {
    Write-Host "  ✗ Prisma schema not found at: $schemaPath" -ForegroundColor Red
    Set-Location $originalDir
    exit 1
}

# Check for problematic Raw ops indexes
$schemaContent = Get-Content $schemaPath -Raw
if ($schemaContent -match 'Raw\("GIST"\)' -or $schemaContent -match 'Raw\("GIN"\)') {
    Write-Host "  ⚠ Schema contains Raw() index ops that may cause validation errors" -ForegroundColor Yellow
    Write-Host "    These should be commented out and added via manual SQL migrations" -ForegroundColor Gray
}

# Validate schema (from repo root where prisma.config.ts exists)
$validateOutput = npx prisma validate 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Prisma schema is valid" -ForegroundColor Green
} else {
    Write-Host "  ✗ Prisma schema validation failed" -ForegroundColor Red
    Write-Host "    Error: $validateOutput" -ForegroundColor Red
    Write-Host "    Fix schema errors before proceeding" -ForegroundColor Yellow
    Set-Location $originalDir
    exit 1
}

# Step 7: Generate Prisma Client
Write-Host "[7/8] Generating Prisma Client..." -ForegroundColor Yellow
Set-Location $repoRoot
$generateOutput = npx prisma generate 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Prisma Client generated successfully" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to generate Prisma Client" -ForegroundColor Red
    Write-Host "    Error: $generateOutput" -ForegroundColor Red
    Write-Host "    Check your .env DATABASE_URL configuration" -ForegroundColor Yellow
    Set-Location $originalDir
    exit 1
}

# Step 8: Check Database Connection and Migrations
Write-Host "[8/8] Checking database connection and migrations..." -ForegroundColor Yellow
Set-Location $repoRoot

if (-not $pgRunning) {
    Write-Host "  ⚠ Skipping database check (PostgreSQL not running)" -ForegroundColor Yellow
    Write-Host "    Start PostgreSQL and re-run this script to test connection" -ForegroundColor Gray
} else {
    # Try db push first (safer than migrate for initial setup)
    Write-Host "    Attempting to connect to database..." -ForegroundColor Gray
    $dbPushOutput = npx prisma db push --accept-data-loss --skip-generate 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Database connection successful" -ForegroundColor Green
        Write-Host "  ✓ Schema pushed to database" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Database connection or push failed" -ForegroundColor Red
        if ($dbPushOutput -match "Authentication failed" -or $dbPushOutput -match "password authentication failed") {
            Write-Host "    Error: Authentication failed" -ForegroundColor Red
            Write-Host "    Please check your PostgreSQL username and password in .env" -ForegroundColor Yellow
            Write-Host "    Default .env uses: postgres/postgres" -ForegroundColor Gray
            Write-Host "    Update DATABASE_URL in both .env files with your actual credentials" -ForegroundColor Yellow
        } elseif ($dbPushOutput -match "database.*does not exist" -or $dbPushOutput -match "does not exist") {
            Write-Host "    Error: Database 'hostpulse' does not exist" -ForegroundColor Red
            Write-Host "    Run this SQL command in psql or pgAdmin:" -ForegroundColor Yellow
            Write-Host "    CREATE DATABASE hostpulse;" -ForegroundColor Gray
        } elseif ($dbPushOutput -match "Can't reach database server" -or $dbPushOutput -match "connection refused") {
            Write-Host "    Error: Cannot connect to PostgreSQL server" -ForegroundColor Red
            Write-Host "    Ensure PostgreSQL is running and accessible on the configured port" -ForegroundColor Yellow
        } else {
            Write-Host "    Error details:" -ForegroundColor Red
            Write-Host $dbPushOutput -ForegroundColor Red
        }
    }
}

# Restore original directory
Set-Location $originalDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Check Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. If database connection failed, update .env files with correct PostgreSQL credentials" -ForegroundColor White
Write-Host "2. Create database if it doesn't exist: CREATE DATABASE hostpulse;" -ForegroundColor White
Write-Host "3. If schema push failed, fix errors and re-run this script" -ForegroundColor White
Write-Host "4. Start backend: cd HostPulse; npx nx serve api." -ForegroundColor White
Write-Host "5. Start frontend (new terminal): cd HostPulse; npx nx serve apps" -ForegroundColor White
Write-Host ""
