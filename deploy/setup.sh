#!/bin/bash
# ======================================================
# 狼人杀 VPS 一键部署脚本
# 使用方法：在云服务器上运行 bash setup.sh
# ======================================================

set -e

echo "🐺 狼人杀服务器 — 一键部署"
echo "================================================"

# 1. 安装 Docker（如果没有）
if ! command -v docker &> /dev/null; then
    echo "📦 安装 Docker..."
    curl -fsSL https://get.docker.com | sh
fi

# 2. 如果是从零开始，直接拉取预构建镜像
#    或者从本地构建

# 创建应用目录
mkdir -p /opt/werewolf
cd /opt/werewolf

# 3. 创建 docker-compose.yml
cat > docker-compose.yml << 'DOCKEREOF'
version: '3.8'
services:
  werewolf:
    image: node:20-alpine
    container_name: werewolf
    restart: unless-stopped
    ports:
      - "80:4000"
    environment:
      - PORT=4000
    working_dir: /app
    command: sh -c "node server/src/index.js"
    volumes:
      - ./server:/app/server
      - ./client/dist:/app/client/dist
      - ./package.json:/app/package.json
DOCKEREOF

# 4. 提示用户上传文件
echo ""
echo "================================================"
echo "  接下来请在你的电脑上执行："
echo ""
echo "  cd werewolf-online"
echo "  npm run build:client"
echo "  scp -r server package.json 用户名@$(hostname -I | awk '{print $1}'):/opt/werewolf/"
echo "  scp -r client/dist 用户名@$(hostname -I | awk '{print $1}'):/opt/werewolf/client/"
echo ""
echo "  然后回到这里继续..."
echo "================================================"
