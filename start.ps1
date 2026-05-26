# 荣耀战区 — 本地启动（Windows）
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "检查 Redis..." -ForegroundColor Cyan
$redisOk = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 6379)
    $tcp.Close()
    $redisOk = $true
} catch {
    Write-Host "  Redis 未运行。可先执行: redis-server" -ForegroundColor Yellow
}

Write-Host "启动 Web 服务..." -ForegroundColor Cyan
if (-not $redisOk) {
    Write-Host "  战力查询可用；排行榜需 Redis。" -ForegroundColor Yellow
}

python app.py
