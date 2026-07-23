#!/usr/bin/env bash
# ============================================================
# 帷幕之地 — 无 Docker 部署（直接在服务器上运行）
# 在服务器上执行: bash setup-no-docker.sh
# ============================================================
set -e

echo "🌑 帷幕之地 — 安装 Node.js + 部署"

# 安装 Node.js 20.x（如果没有）
if ! command -v node >/dev/null 2>&1; then
  echo "安装 Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# 安装 PM2 进程管理
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

# 解压部署包
cd /opt/werewolf
tar -xzf /root/veilland-deploy.tar.gz 2>/dev/null || true

# 安装依赖
cd server && npm install --production && cd ..

# 用 PM2 启动
pm2 delete werewolf 2>/dev/null || true
pm2 start server/src/index.js \
  --name veilland \
  --env PORT=4000

pm2 save
pm2 startup

# 开放端口
if command -v ufw >/dev/null 2>&1; then
  ufw allow 4000/tcp 2>/dev/null || true
fi

echo "✅ 狼人杀已启动！端口 4000"
pm2 status
