Param(
    [Parameter(Mandatory=$true)]
    [string]$Token
)

$ErrorActionPreference = 'Stop'

# PR body file
$prBodyPath = Join-Path $PSScriptRoot '..\PR_BODY.md'
if (-not (Test-Path $prBodyPath)) {
    Write-Error "PR body file not found: $prBodyPath"
    exit 1
}

$prBody = Get-Content -Raw $prBodyPath

$payload = @{
    title = 'fix(auth,bookings): validation, docs sanitization, and dev-ex tooling'
    head  = 'fix/deps-url-parse'
    base  = 'main'
    body  = $prBody
} | ConvertTo-Json -Depth 20

$headers = @{ Authorization = "token $Token"; 'User-Agent' = 'hostpulse-bot' }

try {
    $resp = Invoke-RestMethod -Uri 'https://api.github.com/repos/patrickoluoch92-stack/HostPulse/pulls' -Method Post -Headers $headers -Body $payload -ContentType 'application/json'
    $resp | ConvertTo-Json -Depth 20 | Out-File -FilePath (Join-Path $PSScriptRoot '..\pr_response.json') -Encoding utf8
    Write-Output "PR_CREATED:$($resp.number)"
} catch {
    Write-Error "Failed to create PR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $text = $reader.ReadToEnd()
            Write-Error $text
        } catch {}
    }
    exit 1
}
