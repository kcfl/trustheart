# A4 HTTP Smoke Test Script

# Abort if port 8000 is already in use BEFORE starting
$existing = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Error "ABORT: Port 8000 is already in use by PID $($existing.OwningProcess[0]). Cannot run smoke test."
    exit 1
}

$proc = Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File scripts\run_api.ps1" -PassThru -WindowStyle Hidden
Write-Host "Started API process with PID: $($proc.Id)"

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $h = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get -TimeoutSec 2
        if ($h.status -eq "ok") { $ready = $true; break }
    } catch {}
}

if (-not $ready) {
    Write-Error "Server did not start within 15 seconds"
    taskkill /PID $proc.Id /T /F 2>$null | Out-Null
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

try {
    Write-Host "--- A4.1 GET /api/health ---"
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get
    $health | ConvertTo-Json

    Write-Host "`n--- A4.2 Features count in /api/meta ---"
    $meta = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/meta" -Method Get
    Write-Host "Number of features in /api/meta: $($meta.features.Count)"

    Write-Host "`n--- A4.3 POST /api/predict (quick, sample p10) ---"
    $samples = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/samples" -Method Get
    $p10 = $samples.samples | Where-Object { $_.label -eq "p10" }
    $body = @{
        mode = "quick"
        inputs = $p10.inputs
        case_id = $p10.case_id
    } | ConvertTo-Json -Depth 5
    $pred = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/predict" -Method Post -Body $body -ContentType "application/json"
    $pred | ConvertTo-Json -Depth 5

    Write-Host "`n--- A4.4 Response headers for Origin: http://evil.example ---"
    $evilReq = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health" -Method Get -Headers @{ "Origin" = "http://evil.example" } -UseBasicParsing
    foreach ($entry in $evilReq.Headers.GetEnumerator()) {
        Write-Host "$($entry.Key): $($entry.Value)"
    }
    $hasAcao = $evilReq.Headers["access-control-allow-origin"]
    Write-Host "access-control-allow-origin header: $(if ($hasAcao) { $hasAcao } else { '<NONE>' })"
}
finally {
    Write-Host "`n--- A4.5 Stopping started process tree and confirming port free ---"
    if ($proc -and -not $proc.HasExited) {
        # Stop ONLY the process and child processes started by this script (never kill by port)
        taskkill /PID $proc.Id /T /F 2>$null | Out-Null
        Start-Sleep -Milliseconds 500
        if (-not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 1
    $conn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "WARNING: Port 8000 is still listening by PID $($conn.OwningProcess[0])"
    } else {
        Write-Host "Port 8000 is free: CONFIRMED"
    }
}

