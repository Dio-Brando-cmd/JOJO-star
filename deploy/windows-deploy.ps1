# ============================================================
# 狼人杀 — Windows Server 一键部署脚本
# 在服务器 PowerShell（管理员）中运行
# ============================================================

Write-Host "🐺 狼人杀 Windows Server 部署" -ForegroundColor Green
Write-Host ""

# 1. 开放 Windows 防火墙端口
Write-Host "[1/4] 配置防火墙..."
New-NetFirewallRule -DisplayName "Werewolf Game Port 4000" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "Werewolf HTTP Port 80"   -Direction Inbound -Protocol TCP -LocalPort 80   -Action Allow -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "SSH Port 22"             -Direction Inbound -Protocol TCP -LocalPort 22   -Action Allow -ErrorAction SilentlyContinue
Write-Host "  防火墙规则已添加"

# 2. 安装 Node.js（如果没有）
Write-Host "[2/4] 检查 Node.js..."
$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeInstalled) {
    Write-Host "  正在安装 Node.js..."
    $nodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip"
    Invoke-WebRequest -Uri $nodeUrl -OutFile "$env:TEMP\node.zip" -UseBasicParsing
    Expand-Archive -Path "$env:TEMP\node.zip" -DestinationPath "C:\nodejs" -Force
    $env:Path = "C:\nodejs\node-v20.18.0-win-x64;" + $env:Path
    [Environment]::SetEnvironmentVariable("Path", $env:Path, "Machine")
    Write-Host "  Node.js 安装完成"
} else {
    Write-Host "  Node.js 已安装: $(node -v)"
}

# 3. 下载并部署狼人杀
Write-Host "[3/4] 部署狼人杀服务端..."
$appDir = "C:\werewolf"
New-Item -ItemType Directory -Path $appDir -Force | Out-Null

# 创建 package.json
@'
{
  "name": "werewolf-server",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "socket.io": "^4.7.4",
    "uuid": "^9.0.0"
  }
}
'@ | Out-File -FilePath "$appDir\package.json" -Encoding UTF8

# 复制服务端代码（从同目录下的 server/src）
$serverSrc = Join-Path (Split-Path $PSCommandPath -Parent) "..\server\src"
$clientDist = Join-Path (Split-Path $PSCommandPath -Parent) "..\client\dist"

if (Test-Path $serverSrc) {
    Copy-Item -Path $serverSrc -Destination "$appDir\server\src" -Recurse -Force
}
if (Test-Path $clientDist) {
    Copy-Item -Path $clientDist -Destination "$appDir\client\dist" -Recurse -Force
}

Write-Host "  文件已部署到 $appDir"

# 4. 安装依赖并启动
Write-Host "[4/4] 安装依赖并启动..."
Set-Location $appDir
npm install --production

Write-Host ""
Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  🎉 狼人杀部署完成！" -ForegroundColor Green
Write-Host "  启动命令: cd C:\werewolf && node server/src/index.js" -ForegroundColor Yellow
Write-Host "  游戏地址: http://210.16.170.144:4000" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "现在启动服务器..."
node server/src/index.js
