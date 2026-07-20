// ============================================================
// 服务器应用工厂 —— 可被独立运行或 Electron 导入
// ============================================================

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GameManager } from './game/GameManager.js';
import { UserManager } from './auth/UserManager.js';
import { registerHandlers } from './socket/handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer(options = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  app.use(cors());
  app.use(express.json());

  // 初始化用户管理器
  const userManager = new UserManager();

  // 初始化游戏管理器
  const gameManager = new GameManager();
  gameManager.setIO(io);  // 供全局大厅广播使用
  gameManager.userManager = userManager;  // 供回放保存使用

  // REST API: 获取大厅列表（仅公开房间）
  app.get('/api/lobby', (req, res) => {
    // getLobbyList 已过滤私密房间
    const rooms = gameManager.getLobbyList();
    // 移除敏感字段（仅保留大厅展示需要的信息）
    const safe = rooms.map(r => ({
      id: r.id,
      hostName: r.hostName,
      playerCount: r.playerCount,
      maxPlayers: r.maxPlayers,
    }));
    res.json({ success: true, rooms: safe });
  });

  // REST API: 服务器状态
  app.get('/api/status', (req, res) => {
    res.json({
      success: true,
      online: true,
      version: process.env.APP_VERSION || '2.9.0',
      rooms: gameManager.games.size,
      players: Array.from(gameManager.playerRooms.keys()).length,
      timestamp: Date.now(),
    });
  });

  // REST API: 版本信息
  app.get('/api/version', (req, res) => {
    res.json({
      version: process.env.APP_VERSION || '2.9.0',
      downloadUrl: '/download/狼人杀_Setup.exe',
      apkDownloadUrl: '/download/werewolf.apk',
      releaseDate: '2026-07-20',
      releaseNotes: 'v1.5.4 👂村民偷听改为基于屋内实际成员推断线索、🛡️夜晚行动白名单防作弊、💀遗言系统、🔒JSON写入保护',
      fileSize: 113 * 1024 * 1024, // ~113MB
    });
  });

  // 下载目录（安装包等）。开发环境在项目根 download/；生产环境在 app.js 同级 download/
  const downloadPath = process.env.DOWNLOAD_PATH
    || (fs.existsSync(path.join(__dirname, 'download')) ? path.join(__dirname, 'download') : path.join(__dirname, '..', '..', 'download'));
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }
  app.use('/download', express.static(downloadPath, {
    maxAge: 0,
    setHeaders: (res) => {
      res.set('Content-Disposition', 'attachment');
    },
  }));

  // 生产环境部署前端静态文件（多路径回退）
  let distPath = options.clientDist || null;
  if (!distPath || !fs.existsSync(distPath)) {
    // 优先尝试开发路径 (server/src/app.js → ../../client/dist)
    const devPath = path.join(__dirname, '..', '..', 'client', 'dist');
    // 其次尝试生产路径 (app.js 与 dist/ 平级)
    const prodPath = path.join(__dirname, 'dist');
    if (fs.existsSync(devPath)) {
      distPath = devPath;
    } else if (fs.existsSync(prodPath)) {
      distPath = prodPath;
    } else {
      distPath = null;
    }
  }
  if (distPath && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    // Express 5 兼容：捕获所有非 API 路由，返回 SPA 入口
    app.use((req, res, next) => {
      if (req.url.startsWith('/socket.io')) return next();
      if (req.url.startsWith('/api/')) return next();
      // 已由 static 中间件尝试处理，这里兜底返回 index.html
      if (req.method === 'GET' && !req.url.includes('.')) {
        res.sendFile(path.join(distPath, 'index.html'));
      } else {
        next();
      }
    });
  }

  // 注册Socket事件处理
  io.on('connection', (socket) => {
    console.log(`[连接] ${socket.id}`);
    registerHandlers(io, socket, gameManager, userManager);

    socket.on('disconnect', () => {
      console.log(`[断开] ${socket.id}`);
      const game = gameManager.handleDisconnect(socket.id);
      if (game) {
        game.setIO(io);
        // 游戏进行中发送公共状态保持其他客户端同步，而非 lobby 状态
        if (game.phase !== 'LOBBY') {
          io.to(game.id).emit('game:state', game.getPublicState());
        } else {
          io.to(game.id).emit('game:state', game.getLobbyState());
        }
      }
    });
  });

  return { app, server, io, gameManager };
}

export function startServer(port) {
  const PORT = port || process.env.PORT || 4000;
  const { server } = createServer();

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`🐺 狼人杀服务器运行在端口 ${PORT}`);
      console.log(`   客户端地址: http://localhost:${PORT}`);
      resolve({ server, port: PORT });
    });
  });
}
