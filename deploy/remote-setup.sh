#!/bin/bash
# 狼人杀 — 远程服务器部署脚本
set -e

echo "=== Docker 镜像源 ==="
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'DJSON'
{
  "registry-mirrors": ["https://docker.1ms.run", "https://docker.xuanyuan.me"]
}
DJSON
systemctl restart docker
sleep 3
systemctl is-active docker

echo "=== 解压代码包 ==="
cd /opt/werewolf
tar -xzf werewolf.tar.gz

echo "=== Dockerfile ==="
cat > /opt/werewolf/Dockerfile << 'DOCKERFILE'
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install --production
COPY server/src ./server/src
COPY client/dist ./client/dist
ENV PORT=4000
EXPOSE 4000
CMD ["node", "server/src/index.js"]
DOCKERFILE

echo "=== 拉取 Node 镜像 ==="
docker pull node:20-alpine 2>&1

echo "=== 构建狼人杀镜像 ==="
docker build -t werewolf /opt/werewolf 2>&1

echo "=== 启动服务 ==="
docker stop werewolf 2>/dev/null || true
docker rm werewolf 2>/dev/null || true
docker run -d --name werewolf --restart=unless-stopped -p 80:4000 -e PORT=4000 werewolf

echo "=== 部署完成 ==="
docker ps --filter name=werewolf
echo ""
echo "游戏地址: http://210.16.170.144"
