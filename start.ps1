$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host 'Dashboard: http://127.0.0.1:8000'
python -m http.server 8000 --bind 127.0.0.1 --directory web
