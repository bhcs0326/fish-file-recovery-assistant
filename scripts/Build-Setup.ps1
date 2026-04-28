$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not (Test-Path ".\node_modules")) {
  npm install
}

& (Join-Path $PSScriptRoot "Generate-IconAssets.ps1")

npm run dist:win
