# 帷幕之地 — 云端部署指南

## 方案 A：便宜 VPS 部署（推荐，永久可用）

### 1. 买一台最便宜的云服务器
- 阿里云轻量应用服务器（~68元/年）
- 腾讯云轻量应用服务器（~88元/年）
- 选 Linux（Ubuntu 22.04 或 CentOS 7），1核1G 足够

### 2. 连上服务器，安装 Docker
```bash
curl -fsSL https://get.docker.com | sh
```

### 3. 上传项目到服务器
```bash
# 在本地电脑打包
cd werewolf-online
npm run build:client
tar -czf veilland.tar.gz server/src package.json client/dist deploy/Dockerfile

# 上传到服务器（替换为你的服务器IP）
scp veilland.tar.gz root@你的服务器IP:/root/
```

### 4. 在服务器上启动
```bash
# SSH 连上服务器
ssh root@你的服务器IP

# 解压并构建
cd /root
tar -xzf veilland.tar.gz
docker build -t werewolf -f deploy/Dockerfile .
# 生产环境请修改盐值环境变量（务必修改默认值！）
docker run -d -p 80:4000 --restart=unless-stopped --name veilland \
  -e PORT=4000 \
  -e USER_PASSWORD_SALT="your-random-salt-here" \
  -e ROOM_PASSWORD_SALT="your-random-salt-here" \
  werewolf
```

### 5. 完成！
游戏地址：`http://你的服务器IP`
把它发给任何人，随时随地都能玩。

---

## 方案 B：免费隧道（临时测试用）

```bash
# 方式1：SSH 隧道（无需安装任何东西）
ssh -R 80:localhost:4000 serveo.net
# 启动后会显示公网地址

# 方式2：localtunnel
npm run public
```

---

## 方案 C：Railway 免费部署
1. 注册 https://railway.app
2. 用 GitHub 连接项目
3. 一键部署
