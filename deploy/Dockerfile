# 狼人杀服务器 Docker 镜像
# 部署到任何支持 Docker 的云服务器即可

FROM node:20-alpine

WORKDIR /app

# 只复制服务端依赖
COPY server/package*.json ./server/
RUN cd server && npm install --production

# 复制服务端代码
COPY server/src ./server/src

# 复制客户端生产构建
COPY client/dist ./client/dist

ENV PORT=4000
EXPOSE 4000

CMD ["node", "server/src/index.js"]
