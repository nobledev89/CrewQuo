#!/usr/bin/env pwsh
# Build Clean Script - Fixes EPERM errors on Windows

Write-Host "🧹 Cleaning build artifacts..." -ForegroundColor Cyan

# Stop any running Node processes
Write-Host "Stopping Node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Wait for processes to fully terminate
Start-Sleep -Seconds 2

# Remove .next directory
Write-Host "Removing .next directory..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Remove out directory
Write-Host "Removing out directory..." -ForegroundColor Yellow
if (Test-Path "out") {
    Remove-Item -Path "out" -Recurse -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Disable Next.js telemetry to reduce file locks
$env:NEXT_TELEMETRY_DISABLED = 1

Write-Host ""
Write-Host "✅ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🔨 Building Next.js app..." -ForegroundColor Cyan
Write-Host ""

# Build the app
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Build successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📁 Static files created in: out/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🚀 Next step: Run 'npm run deploy' to deploy to Firebase" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try these solutions:" -ForegroundColor Yellow
    Write-Host "1. Close VS Code completely and run this script again" -ForegroundColor White
    Write-Host "2. Restart your computer and try again" -ForegroundColor White
    Write-Host "3. Check BUILD_FIX.md for more solutions" -ForegroundColor White
}
