# Run TrustHeart 3D FastAPI server from repo root
param (
    [int]$Port = 8000,
    [string]$HostAddress = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

# Use local virtual environment uvicorn if present, otherwise system uvicorn
$UvicornPath = ".\.venv\Scripts\uvicorn.exe"
if (-not (Test-Path $UvicornPath)) {
    $UvicornPath = "uvicorn"
}

Write-Host "Starting TrustHeart 3D FastAPI backend on http://${HostAddress}:${Port} ..." -ForegroundColor Cyan
& $UvicornPath backend.app.main:app --host $HostAddress --port $Port
