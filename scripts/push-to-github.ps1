$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$Repo = "honor-zone"
$User = "aiyangdie"
$Token = $env:GITHUB_TOKEN

if (-not $Token) {
    Write-Host "Set GITHUB_TOKEN env first."
    exit 1
}

$headers = @{
    Authorization = "Bearer $Token"
    Accept        = "application/vnd.github+json"
}
$body = '{"name":"honor-zone","description":"Honor Zone Web","private":false}'

try {
    Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers $headers -Body $body -ContentType "application/json" | Out-Null
    Write-Host "Repo created."
} catch {
    Write-Host "Create repo skipped (may exist)."
}

git remote remove origin 2>$null
git remote add origin "https://github.com/$User/$Repo.git"
git push "https://${User}:${Token}@github.com/${User}/${Repo}.git" main
Write-Host "Done: https://github.com/$User/$Repo"
