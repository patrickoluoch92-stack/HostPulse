# Script to update PostgreSQL password in .env file

Write-Host "🔐 Update PostgreSQL Password in .env" -ForegroundColor Cyan
Write-Host ""

$envFile = ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env file not found in current directory" -ForegroundColor Red
    exit 1
}

Write-Host "Current DATABASE_URL:" -ForegroundColor Yellow
Get-Content $envFile | Select-String "DATABASE_URL" | ForEach-Object {
    $current = $_.ToString()
    Write-Host "  $current" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Enter your PostgreSQL password:" -ForegroundColor Yellow
Write-Host "(The password will be hidden as you type)" -ForegroundColor Gray
$securePassword = Read-Host -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
)

if ([string]::IsNullOrWhiteSpace($password)) {
    Write-Host "❌ Password cannot be empty" -ForegroundColor Red
    exit 1
}

# Read current .env content
$content = Get-Content $envFile -Raw

# Update DATABASE_URL
$newDbUrl = "postgresql://postgres:$password@localhost:5432/hostpulse?schema=public"
$content = $content -replace 'DATABASE_URL="[^"]*"', "DATABASE_URL=`"$newDbUrl`""

# Write back to file
$content | Set-Content $envFile -NoNewline

Write-Host ""
Write-Host "✅ Password updated in .env file" -ForegroundColor Green
Write-Host ""
Write-Host "New DATABASE_URL:" -ForegroundColor Yellow
Write-Host "  DATABASE_URL=`"postgresql://postgres:****@localhost:5432/hostpulse?schema=public`"" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Next step: Run 'node verify-password.js' to test the new password" -ForegroundColor Cyan
