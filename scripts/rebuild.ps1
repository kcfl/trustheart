# TrustHeart 3D - Full ML Artifact Rebuild Script
# Stops immediately if any step fails.

$ErrorActionPreference = "Stop"

# Use local .venv (Python 3.12) if available
$py = if (Test-Path ".\.venv\Scripts\python.exe") {
    ".\.venv\Scripts\python.exe"
} elseif (Test-Path "$PSScriptRoot\..\.venv\Scripts\python.exe") {
    "$PSScriptRoot\..\.venv\Scripts\python.exe"
} else {
    "python"
}

$pyt = if (Test-Path ".\.venv\Scripts\pytest.exe") {
    ".\.venv\Scripts\pytest.exe"
} elseif (Test-Path "$PSScriptRoot\..\.venv\Scripts\pytest.exe") {
    "$PSScriptRoot\..\.venv\Scripts\pytest.exe"
} else {
    "pytest"
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " TrustHeart 3D - Reproducible ML Artifact Rebuild Pipeline" -ForegroundColor Cyan
Write-Host " Using Python: $py" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$steps = @(
    @{ Name = "1. Nested CV & Calibration"; Module = "ml.nested" },
    @{ Name = "2. Final Model Fitting & Manifest"; Module = "ml.final_fit" },
    @{ Name = "3. Coherence Analysis & Report"; Module = "ml.coherence_report" },
    @{ Name = "4. Bootstrap Explanation Stability"; Module = "ml.stability" },
    @{ Name = "5. Trust Layer Statistics & Lift"; Module = "ml.trust_stats" }
)

$overallStart = [System.Diagnostics.Stopwatch]::StartNew()

foreach ($step in $steps) {
    $sName = $step["Name"]
    $sMod = $step["Module"]
    Write-Host ""
    Write-Host ">>> Running Step: $sName..." -ForegroundColor Yellow
    $stepStart = [System.Diagnostics.Stopwatch]::StartNew()
    
    & $py -m $sMod
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Step '$sName' failed with exit code $LASTEXITCODE."
        exit $LASTEXITCODE
    }
    
    $stepStart.Stop()
    $sSec = [Math]::Round($stepStart.Elapsed.TotalSeconds, 2)
    Write-Host "Completed $sName in $sSec s" -ForegroundColor Green
}

Write-Host ""
Write-Host ">>> Running Verification Tests: pytest -q..." -ForegroundColor Yellow
$testStart = [System.Diagnostics.Stopwatch]::StartNew()

& $pyt -q
if ($LASTEXITCODE -ne 0) {
    Write-Error "Test suite failed with exit code $LASTEXITCODE."
    exit $LASTEXITCODE
}

$testStart.Stop()
$tSec = [Math]::Round($testStart.Elapsed.TotalSeconds, 2)
Write-Host "Completed pytest in $tSec s" -ForegroundColor Green

$overallStart.Stop()
$totSec = [Math]::Round($overallStart.Elapsed.TotalSeconds, 2)
$totMin = [Math]::Round($overallStart.Elapsed.TotalMinutes, 2)

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " Rebuild Pipeline Finished Successfully!" -ForegroundColor Green
Write-Host " Total Elapsed Time: $totSec s ($totMin min)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
