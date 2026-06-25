#!/bin/bash
set -e
echo "=== 狼人杀直接部署 ==="

# 安装 Node.js 20
if ! command -v node >/dev/null 2>&1; then
  echo "安装 Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js: $(node -v)"

# 安装 PM2
npm install -g pm2 2>/dev/null || true

# 解压部署
cd /opt/werewolf
tar -xzf werewolf.tar.gz

# 安装依赖
cd /opt/werewolf/server
npm install --production 2>&1

# 开放端口
ufw allow 22/tcp 2>/dev/null || true
ufw allow 80/tcp 2>/dev/null || true
ufw allow 4000/tcp 2>/dev/null || true

# 启动服务
pm2 delete werewolf 2>/dev/null || true
pm2 start src/index.js --name werewolf -- --port 4000
pm2 save
pm2 startup 2>/dev/null || true

echo ""
echo "=== 部署完成 ==="
pm2 status
echo "游戏地址: http://210.16.170.144"
curl -s http://localhost:4000 | head -5 || echo "(服务启动中...)"
