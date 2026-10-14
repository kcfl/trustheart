# Run both TrustHeart 3D FastAPI backend and Vite frontend in dev mode
param (
    [switch]$PrintOnly
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot

if ($PrintOnly) {
    Write-Host "Terminal 1 (Backend API):" -ForegroundColor Cyan
    Write-Host "  cd `"$RepoRoot`""
    Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\run_api.ps1"
    Write-Host ""
    Write-Host "Terminal 2 (Frontend UI):" -ForegroundColor Cyan
    Write-Host "  cd `"$RepoRoot\frontend`""
    Write-Host "  npm run dev"
    exit 0
}

Write-Host "Starting TrustHeart 3D Development Servers..." -ForegroundColor Cyan

# 1. Start Backend API
$ApiScript = Join-Path $RepoRoot "scripts\run_api.ps1"
$ApiProc = Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$ApiScript`"" -PassThru -WindowStyle Hidden
Write-Host "Backend API started (PID: $($ApiProc.Id)) on http://127.0.0.1:8000" -ForegroundColor Green

# 2. Start Frontend Vite
$FrontendDir = Join-Path $RepoRoot "frontend"
$ViteProc = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory $FrontendDir -PassThru -WindowStyle Hidden
Write-Host "Frontend Dev Server started (PID: $($ViteProc.Id)) on http://localhost:5173" -ForegroundColor Green

Write-Host ""
Write-Host "Development environment is active." -ForegroundColor Cyan
Write-Host "To stop servers, run:" -ForegroundColor Yellow
Write-Host "  Stop-Process -Id $($ApiProc.Id), $($ViteProc.Id) -Force"
