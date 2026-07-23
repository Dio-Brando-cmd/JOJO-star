#!/usr/bin/env bash
# ============================================================
# 帷幕之地 — 一键部署到云服务器
# 用法: ./deploy/deploy.sh <服务器IP>
# 示例: ./deploy/deploy.sh 123.456.789.0
# ============================================================
set -e

SERVER_IP="$1"
if [ -z "$SERVER_IP" ]; then
  echo "用法: ./deploy/deploy.sh <服务器IP>"
  exit 1
fi

echo "🌑 帷幕之地 — 部署到 $SERVER_IP"
echo ""

# 1. 构建前端
echo "📦 [1/5] 构建前端..."
cd "$(dirname "$0")/.."
npm run build:client

# 2. 打包部署文件
echo "📦 [2/5] 打包部署文件..."
tar -czf veilland-deploy.tar.gz \
  server/package.json \
  server/package-lock.json \
  server/src \
  client/dist \
  deploy/Dockerfile \
  deploy/docker-compose.yml

echo "   包大小: $(du -h veilland-deploy.tar.gz | cut -f1)"

# 3. 上传到服务器
echo "📦 [3/5] 上传到服务器..."
scp veilland-deploy.tar.gz "root@$SERVER_IP:/root/"

# 4. SSH 部署
echo "📦 [4/5] 服务器上部署..."
ssh "root@$SERVER_IP" << 'EOF'
set -e

# 解压
cd /root
mkdir -p /opt/werewolf
cd /opt/werewolf
tar -xzf /root/veilland-deploy.tar.gz
rm /root/veilland-deploy.tar.gz

# 确保端口开放
if command -v ufw >/dev/null 2>&1; then
  ufw allow 4000/tcp 2>/dev/null || true
fi

# 停止旧容器
docker stop werewolf 2>/dev/null || true
docker rm werewolf 2>/dev/null || true

# 构建并启动
docker build -t werewolf -f deploy/Dockerfile .
docker run -d \
  --name veilland \
  --restart=unless-stopped \
  -p 4000:4000 \
  -e PORT=4000 \
  werewolf

echo ""
echo "✅ 部署完成！"
docker ps --filter name=werewolf --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
EOF

# 5. 清理本地打包文件
rm veilland-deploy.tar.gz

echo ""
echo "════════════════════════════════════════════════"
echo "  🎉 狼人杀已部署！"
echo "  游戏地址: http://$SERVER_IP:4000"
echo "  把地址发给朋友，浏览器打开即可联机"
echo "════════════════════════════════════════════════"
echo ""
echo "日志查看: ssh root@$SERVER_IP 'docker logs -f werewolf'"
echo "重启服务: ssh root@$SERVER_IP 'docker restart werewolf'"
