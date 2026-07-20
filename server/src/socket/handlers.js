// ============================================================
// Socket.IO 事件处理
// ============================================================

import { PHASES, ROLES, getRoleConfig } from '../game/constants.js';

// ===== 输入校验 =====
function sanitizeName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 12) return null;
  // 移除 HTML/脚本标签，替换危险字符
  return trimmed.replace(/[<>"'&/\\]/g, '').substring(0, 12);
}

function sanitizeMessage(msg) {
  if (typeof msg !== 'string') return '';
  // 去除 HTML/脚本标签，防止 XSS（纵深防御）
  return msg.replace(/[<>]/g, '').trim().substring(0, 500);
}

// ===== 简易密码哈希 =====
import crypto from 'crypto';
const PASSWORD_SALT = process.env.ROOM_PASSWORD_SALT || 'werewolf-server-salt-2024';

function hashPassword(password) {
  if (!password || typeof password !== 'string') return null;
  return crypto.createHmac('sha256', PASSWORD_SALT).update(password).digest('hex');
}

// ===== 速率限制 =====
const rateLimits = new Map(); // key -> { count, resetAt }

function checkRateLimit(key, maxPerMinute = 30) {
  const now = Date.now();
  let entry = rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + 60000 };
    rateLimits.set(key, entry);
    return true;
  }
  entry.count++;
  if (entry.count > maxPerMinute) return false;
  return true;
}

// 定期清理过期条目
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now > entry.resetAt) rateLimits.delete(key);
  }
}, 120000);

// ===== 安全错误消息 =====
function safeError(err) {
  console.error('[Server Error]', err);
  return '服务器内部错误，请稍后重试';
}

export function registerHandlers(io, socket, gameManager, userManager) {
  // ==================== 用户认证 ====================

  // 注册
  socket.on('auth:register', ({ username, password }, callback) => {
    const result = userManager.register(username, password);
    callback?.(result);
  });

  // 登录
  socket.on('auth:login', ({ username, password }, callback) => {
    const result = userManager.login(username, password);
    if (result.success) {
      userManager.setSession(socket.id, result.user.username);
    }
    callback?.(result);
  });

  // 获取用户信息（含回放）
  socket.on('auth:profile', (callback) => {
    const user = userManager.getUserBySocket(socket.id);
    if (!user) {
      callback?.({ error: '未登录' });
      return;
    }
    const profile = userManager.getProfile(user.username);
    callback?.({
      success: true,
      ...profile,
    });
  });

  // 登出
  socket.on('auth:logout', () => {
    userManager.clearSession(socket.id);
  });

  // 更新游戏统计
  socket.on('auth:updateStats', ({ won }) => {
    const user = userManager.getUserBySocket(socket.id);
    if (user) {
      userManager.updateStats(user.username, won);
    }
  });

  // ==================== 版本检查（自动更新） ====================

  socket.on('app:checkVersion', (callback) => {
    const currentVersion = process.env.APP_VERSION || '1.5.4';
    const downloadUrl = '/download/狼人杀_Setup.exe';
    const apkDownloadUrl = '/download/werewolf.apk';
    callback?.({
      version: currentVersion,
      downloadUrl,
      apkDownloadUrl,
      releaseDate: '2026-06-26',
      releaseNotes: 'v1.5.4 👂村民偷听改为基于屋内实际成员推断线索、🛡️夜晚行动白名单防作弊、💀遗言系统、🔒JSON写入保护',
      fileSize: 113 * 1024 * 1024,
    });
  });

  // ==================== 房间操作 ====================

  // ===== 断线重连 =====
  socket.on('room:rejoin', ({ roomCode, oldPlayerId }, callback) => {
    try {
      if (!oldPlayerId || !roomCode) {
        callback?.({ success: false, error: '缺少重连参数' });
        return;
      }
      const result = gameManager.reconnectPlayer(socket.id, oldPlayerId, roomCode);
      if (!result) {
        callback?.({ success: false, error: '重连失败：房间不存在或已超时' });
        return;
      }
      const { game, oldId } = result;
      game.setIO(io);
      socket.join(game.id);

      // 更新投票记录中的旧 playerId
      if (game.votes[oldId] !== undefined) {
        game.votes[socket.id] = game.votes[oldId];
        delete game.votes[oldId];
      }

      // 通知其他玩家
      io.to(game.id).emit('chat:message', {
        playerId: 'system',
        playerName: '系统',
        message: `${game.getPlayer(socket.id)?.name || '玩家'} 已重新连接`,
        timestamp: Date.now(),
      });

      console.log(`[重连] ${oldId} → ${socket.id} (房间 ${game.id})`);
      callback?.({ success: true, gameState: game.getPublicState() });

      // 发送私有状态
      const privateState = game.getPrivateState(socket.id);
      if (privateState) {
        socket.emit('game:privateState', privateState);
      }
    } catch (err) {
      callback?.({ success: false, error: safeError(err) });
    }
  });

  // 创建房间（可传入自定义角色配置、隐私设置）
  socket.on('room:create', ({ playerName, roleConfig, isPrivate, password, maxPlayers, gameMode }, callback) => {
    try {
      // 速率限制
      if (!checkRateLimit(`create:${socket.id}`, 5)) {
        callback({ success: false, error: '操作太频繁，请稍后再试' });
        return;
      }

      const name = sanitizeName(playerName);
      if (!name) {
        callback({ success: false, error: '昵称格式不合法（1-12字符，不含特殊符号）' });
        return;
      }
      const game = gameManager.createRoom(socket.id, name);
      game.setIO(io);
      socket.join(game.id);

      // 隐私设置
      if (isPrivate !== undefined) game.isPrivate = !!isPrivate;
      if (password && typeof password === 'string' && password.trim()) {
        game.password = hashPassword(password.trim());  // 哈希存储密码
      }
      // 最大人数（5-18）
      if (maxPlayers && typeof maxPlayers === 'number' && maxPlayers >= 5 && maxPlayers <= 18) {
        game.maxPlayers = maxPlayers;
      }
      // 游戏模式（2.11.0: 桌游 vs 3D追逃）
      if (gameMode === 'THIRD_PERSON' || gameMode === 'BOARD_GAME') {
        game.gameMode = gameMode;
      }

      // 存储房主的角色配置选择
      if (roleConfig && game.hostId === socket.id) {
        game.customRoleConfig = validateRoleConfig(roleConfig, game.maxPlayers);
        if (!game.customRoleConfig) {
          callback({ success: false, error: '角色配置不合法：必须包含至少1狼人、至少1好人，且不能全狼人' });
          return;
        }
      }

      console.log(`[房间] ${playerName} 创建了房间 ${game.id} ${game.isPrivate ? '(私密)' : '(公开)'}`);
      gameManager.broadcastLobbyUpdate();  // 推送大厅更新
      callback({ success: true, roomCode: game.id, gameState: game.getLobbyState() });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // 加入房间（支持密码）
  socket.on('room:join', ({ roomCode, playerName, password }, callback) => {
    try {
      // 速率限制（防止暴力破解密码）
      if (!checkRateLimit(`join:${socket.id}`, 10)) {
        callback({ success: false, error: '尝试次数过多，请稍后再试' });
        return;
      }

      const name = sanitizeName(playerName);
      if (!name) {
        callback({ success: false, error: '昵称格式不合法（1-12字符，不含特殊符号）' });
        return;
      }
      // 密码哈希比对
      const hashedPwd = password ? hashPassword(password) : null;
      const result = gameManager.joinRoom(roomCode, socket.id, name, hashedPwd);
      if (result.error) {
        callback({ success: false, error: result.error });
        return;
      }
      socket.join(roomCode);
      result.game.setIO(io);
      console.log(`[房间] ${playerName} 加入了房间 ${roomCode}`);
      io.to(roomCode).emit('game:state', result.game.getLobbyState());
      gameManager.broadcastLobbyUpdate();  // 人数变化
      callback({ success: true, gameState: result.game.getLobbyState() });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // 离开房间
  socket.on('room:leave', () => {
    const game = gameManager.leaveRoom(socket.id);
    if (game) {
      game.setIO(io);
      socket.leave(game.id);
      io.to(game.id).emit('game:state', game.getLobbyState());
      gameManager.broadcastLobbyUpdate();  // 人数变化或房间消失
    }
  });

  // 返回大厅（游戏中退出）
  socket.on('room:backToLobby', () => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) return;

    // v2.0: 游戏中只允许房主在大厅阶段返回（非房主或游戏已开始则拒绝）
    if (game.phase !== PHASES.LOBBY && game.hostId !== socket.id) {
      console.log(`[安全] 非房主 ${socket.id} 试图在游戏中途返回大厅，已拒绝`);
      return;
    }

    game.removePlayer(socket.id);
    gameManager.playerRooms.delete(socket.id);
    socket.leave(game.id);
    if (game.players.length === 0) {
      gameManager.games.delete(game.id);
      gameManager.broadcastLobbyUpdate();
    } else {
      game.setIO(io);
      io.to(game.id).emit('game:state', game.getLobbyState());
    }
  });

  // 游戏结束 → 返回大厅保留房间（房主操作或自动触发）
  socket.on('room:returnToLobby', () => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) return;
    // 只有房主可以主动触发（或游戏已结束可自动）
    if (game.phase !== PHASES.GAME_OVER && game.hostId !== socket.id) return;
    game.cancelReturnToLobby();
    game.returnToLobby();
  });

  // 获取回放列表
  socket.on('auth:replays', (callback) => {
    const user = userManager.getUserBySocket(socket.id);
    if (!user) {
      callback?.({ error: '未登录' });
      return;
    }
    const replays = userManager.getReplays(user.username);
    callback?.({ success: true, replays });
  });

  // 房主更新角色配置
  socket.on('room:updateRoleConfig', ({ roleConfig }, callback) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.hostId !== socket.id) {
      callback?.({ success: false, error: '仅房主可修改角色配置' });
      return;
    }
    if (game.phase !== PHASES.LOBBY) {
      callback?.({ success: false, error: '游戏已开始，无法修改配置' });
      return;
    }

    const validated = validateRoleConfig(roleConfig, game.maxPlayers);
    if (!validated) {
      callback?.({ success: false, error: '角色配置不合法：必须包含至少1狼人、至少1好人，且不能全狼人' });
      return;
    }

    game.customRoleConfig = validated;
    game.setIO(io);
    io.to(game.id).emit('game:state', game.getLobbyState());
    io.to(game.id).emit('room:roleConfigUpdated', { roleConfig: validated });
    callback?.({ success: true });
  });

  // ==================== 大厅列表 ====================

  // 获取大厅房间列表
  socket.on('lobby:list', (callback) => {
    const list = gameManager.getLobbyList();
    callback?.({ success: true, rooms: list });
  });

  // ==================== 房间管理（房主特权） ====================

  // 切换房间公开/私密
  socket.on('room:togglePrivacy', ({ isPrivate, password }, callback) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.hostId !== socket.id) {
      callback?.({ success: false, error: '仅房主可修改隐私设置' });
      return;
    }
    if (game.phase !== 'LOBBY') {
      callback?.({ success: false, error: '游戏已开始，无法修改' });
      return;
    }
    game.isPrivate = !!isPrivate;
    if (password !== undefined) {
      game.password = (password && typeof password === 'string' && password.trim())
        ? hashPassword(password.trim()) : null;
    }
    game.setIO(io);
    io.to(game.id).emit('game:state', game.getLobbyState());
    gameManager.broadcastLobbyUpdate();  // 隐私变更影响大厅
    callback?.({ success: true, isPrivate: game.isPrivate, hasPassword: !!game.password });
  });

  // 修改房间密码
  socket.on('room:setPassword', ({ password }, callback) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.hostId !== socket.id) {
      callback?.({ success: false, error: '仅房主可修改密码' });
      return;
    }
    game.password = (password && typeof password === 'string' && password.trim())
      ? hashPassword(password.trim()) : null;
    game.setIO(io);
    io.to(game.id).emit('game:state', game.getLobbyState());
    callback?.({ success: true });
  });

  // 修改最大人数
  socket.on('room:updateMaxPlayers', ({ maxPlayers }, callback) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.hostId !== socket.id) {
      callback?.({ success: false, error: '仅房主可修改人数上限' });
      return;
    }
    if (game.phase !== 'LOBBY') {
      callback?.({ success: false, error: '游戏已开始，无法修改' });
      return;
    }
    if (typeof maxPlayers !== 'number' || maxPlayers < game.players.length || maxPlayers > 18) {
      callback?.({ success: false, error: `人数上限需在${game.players.length}-18之间` });
      return;
    }
    game.maxPlayers = maxPlayers;
    game.setIO(io);
    io.to(game.id).emit('game:state', game.getLobbyState());
    callback?.({ success: true });
  });

  // 获取屋子访客数量
  socket.on('room:houseVisitors', ({ houseId }, callback) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) {
      callback?.({ success: false, error: '不在游戏中' });
      return;
    }
    const info = game.getHouseVisitorCount(houseId, socket.id);
    callback?.({ success: true, ...info });
  });

  // 房主切换人机模式
  socket.on('room:toggleBots', ({ enabled }, callback) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.hostId !== socket.id) {
      callback?.({ success: false, error: '仅房主可修改' });
      return;
    }
    if (game.phase !== PHASES.LOBBY) {
      callback?.({ success: false, error: '游戏已开始，无法修改' });
      return;
    }
    game.enableBots = !!enabled;
    game.setIO(io);
    io.to(game.id).emit('game:state', game.getLobbyState());
    callback?.({ success: true, enableBots: game.enableBots });
  });

  // 房主设置人机数量
  socket.on('room:setBotCount', ({ count }, callback) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.hostId !== socket.id) {
      callback?.({ success: false, error: '仅房主可修改' });
      return;
    }
    if (game.phase !== PHASES.LOBBY) {
      callback?.({ success: false, error: '游戏已开始，无法修改' });
      return;
    }
    if (typeof count !== 'number' || count < 0 || count > 12) {
      callback?.({ success: false, error: '人机数量需在0-12之间' });
      return;
    }
    game.botCount = count;
    game.enableBots = count > 0; // 设置数量>0时自动开启人机
    game.setIO(io);
    io.to(game.id).emit('game:state', game.getLobbyState());
    callback?.({ success: true, botCount: game.botCount, enableBots: game.enableBots });
  });

  // ==================== 游戏操作 ====================

  // v2.0: 选择表层身份
  socket.on('character:select', ({ characterId } = {}, callback) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) {
      callback?.({ success: false, error: '你不在任何房间中' });
      return;
    }
    const result = game.selectCharacter(socket.id, characterId);
    callback?.(result);
  });

  // 开始游戏（仅房主）—— 支持自定义角色配置
  socket.on('game:start', ({ roleConfig } = {}, callback) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) {
      callback?.({ success: false, error: '你不在任何房间中' });
      return;
    }
    // 房主校验：优先匹配 hostId，回退检查是否是首位玩家（位置0）
    const isHostById = game.hostId === socket.id;
    const isFirstPlayer = game.players.length > 0 && game.players[0].id === socket.id;
    if (!isHostById && !isFirstPlayer) {
      callback?.({ success: false, error: '只有房主可以开始游戏' });
      return;
    }
    // 如果 hostId 不匹配但确实是首位玩家，自动修复 hostId
    if (!isHostById && isFirstPlayer) {
      console.log(`[修复] 房间 ${game.id} hostId 从 ${game.hostId} 修正为 ${socket.id}`);
      game.hostId = socket.id;
    }
    if (game.players.length < game.minPlayers) {
      callback?.({ success: false, error: `至少需要${game.minPlayers}名玩家才能开始游戏 (当前${game.players.length})` });
      return;
    }

    // 应用最终角色配置
    if (roleConfig) {
      const validated = validateRoleConfig(roleConfig, game.players.length);
      if (validated) {
        game.customRoleConfig = validated;
      }
    }

    const success = game.startGame();
    if (success) {
      game.setIO(io);
      console.log(`[游戏] 房间 ${game.id} 游戏开始`);

      // 向每个玩家发送其私有状态
      for (const player of game.players) {
        const privateState = game.getPrivateState(player.id);
        io.to(player.id).emit('game:privateState', privateState);
      }

      io.to(game.id).emit('game:started', { round: game.round });
      gameManager.broadcastLobbyUpdate();  // 游戏开始，房间从大厅移除
      callback?.({ success: true });
    } else {
      callback?.({ success: false, error: '游戏启动失败，请检查玩家数量' });
    }
  });

  // 提交夜晚行动（含服务端白名单校验）
  socket.on('night:action', ({ action, target, ability }) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.phase !== PHASES.NIGHT) return;

    const player = game.getPlayer(socket.id);
    if (!player || !player.alive || player.halfAlive) return; // v2.0: halfAlive不能行动

    const currentStep = game.nightStep;
    if (!currentStep || game._advancingNightStep) return;

    // === v2.0: 按角色+步骤白名单校验 ===
    if (!_validateNightAction(player, currentStep, action, target, ability, game)) return;

    // 目标校验：target 必须是房间内存活玩家或 null
    if (target && !game.players.some(p => p.alive && p.id === target)) return;

    game.submitNightAction(socket.id, action, target, ability);

    if (game.nightStep !== currentStep) return;

    const playersForStep = game._getPlayersForStep(currentStep);
    const allSubmitted = playersForStep.length > 0 && playersForStep.every(p => p.nightAction !== null);

    if (allSubmitted) {
      game.advanceNightStep();
    }
  });

  // 跳过当前夜晚步骤（仅当前步骤的参与者可跳过）
  socket.on('night:skip', () => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.phase !== PHASES.NIGHT) return;

    // 只有当前步骤的参与者可以跳过（防止恶意玩家跳过他人回合）
    const currentStep = game.nightStep;
    const participants = game._getPlayersForStep(currentStep);
    const isParticipant = participants.some(p => p.id === socket.id);

    // 如果不是参与者，检查是否是无关角色的等待者（如村民在夜晚只是等待）
    // 非参与者不能跳过，防止跳过他人回合
    if (!isParticipant && participants.length > 0) {
      // 当前步骤有参与者但不是我 — 拒绝跳过
      return;
    }

    // 如果当前步骤没有参与者（所有相关角色已死），允许任何人跳过
    game.advanceNightStep();
  });

  // 房主手动推进：白天→讨论→投票
  socket.on('day:startVote', () => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.phase !== PHASES.DAY) return;
    game.enterDiscussion();
  });

  // 提交投票
  socket.on('vote:submit', ({ targetId }) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.phase !== PHASES.VOTE) return;

    game.submitVote(socket.id, targetId);

    // 防止竞态：如果已经进入结算，不要再检查
    if (game._resolvingVotes || game.phase !== PHASES.VOTE) return;

    const alivePlayers = game.players.filter(p => p.alive && !p.disconnected);
    const allVoted = alivePlayers.length > 0 && alivePlayers.every(p => game.votes[p.id] !== undefined);

    if (allVoted) {
      game.resolveVotes();
    } else {
      game.setIO(io);
      io.to(game.id).emit('game:state', game.getPublicState());
    }
  });

  // 猎人在讨论阶段开枪
  socket.on('hunter:dayShoot', ({ targetId }) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.phase !== PHASES.DAY) return;

    const player = game.getPlayer(socket.id);
    // P0修复: 必须存活 + 必须是猎人 + 必须尚未开过枪
    if (!player || !player.alive || player.role !== ROLES.HUNTER) return;
    if (game.hunterDayShoot) return; // 已经开过枪，拒绝第二次

    game.hunterDayShootTarget(targetId);
    game.setIO(io);
    io.to(game.id).emit('game:state', game.getPublicState());
  });

  // 讨论阶段：跳过当前发言者（仅发言人自己可按Q跳过）
  socket.on('discussion:skip', () => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.phase !== PHASES.DISCUSSION) return;
    game.skipDiscussionSpeaker(socket.id);
    game.setIO(io);
    io.to(game.id).emit('game:state', game.getPublicState());
  });

  // 种狼告知被感染者
  socket.on('alpha:notifyInfected', () => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.phase !== PHASES.NIGHT) return;
    const player = game.getPlayer(socket.id);
    if (!player || player.role !== ROLES.ALPHA_WOLF) return;

    // 找到所有被种狼感染的存活玩家
    const infected = game.players.filter(p => p.alive && p.infectedByAlpha);
    for (const p of infected) {
      if (!game.privateLogs[p.id]) game.privateLogs[p.id] = [];
      const msg = p.role === ROLES.SEER
        ? { type: 'alpha_revealed', player: p.id, alphaId: player.id, alphaName: player.name, msg: `种狼 ${player.name} 告知：你已被感染！种狼是 ${player.name}。你的预言结果已被反转。` }
        : { type: 'infected_notified', player: p.id, alphaId: player.id, alphaName: player.name, msg: `种狼 ${player.name} 告知：你已被感染，下个夜晚将变为狼人。` };
      game.privateLogs[p.id].push(msg);
      io.to(p.id).emit('game:privateState', game.getPrivateState(p.id));
    }
    game.setIO(io);
    io.to(game.id).emit('game:state', game.getPublicState());
  });

  // ==================== 遗言 ====================

  socket.on('player:lastWords', ({ message }) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) return;
    const player = game.getPlayer(socket.id);
    if (!player || !player.hasLastWords || player.alive) return;

    const safeMsg = sanitizeMessage(message);
    if (!safeMsg) return;

    player.hasLastWords = false; // 遗言只能用一次
    io.to(game.id).emit('chat:message', {
      playerId: socket.id,
      playerName: player.name,
      message: `💀 [遗言] ${safeMsg}`,
      timestamp: Date.now(),
    });
    console.log(`[遗言] ${player.name}: ${safeMsg}`);
  });

  // ==================== 聊天 ====================

  socket.on('chat:message', ({ message }) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) return;
    const player = game.getPlayer(socket.id);
    if (!player) return;

    // 速率限制聊天
    if (!checkRateLimit(`chat:${socket.id}`, 20)) return;

    const safeMsg = sanitizeMessage(message);
    if (!safeMsg) return;

    io.to(game.id).emit('chat:message', {
      playerId: socket.id,
      playerName: player.name,
      message: safeMsg,
      timestamp: Date.now(),
    });
  });

  // ==================== 3D位置同步 ====================

  socket.on('player:position', ({ x, y, z, rotY, isMoving, isSprinting }) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || !game.positionSync) return;
    game.positionSync.updatePosition(socket.id, { x, y, z, rotY, isMoving, isSprinting });
  });

  // ==================== 3D追逃模式专用事件 ====================

  // 狼人攻击
  socket.on('3d:attack', ({ targetId }, callback) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.gameMode !== 'THIRD_PERSON') {
      callback?.({ success: false, error: 'NOT_3D_MODE' });
      return;
    }
    const result = game.submit3DAttack(socket.id, targetId);
    callback?.(result || { success: false });
  });

  // 藏匿
  socket.on('3d:hide', ({ hideSpotId }, callback) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.gameMode !== 'THIRD_PERSON') return;
    const ok = game.submit3DHide(socket.id, hideSpotId);
    callback?.({ success: ok });
  });

  // 脱离藏匿
  socket.on('3d:unhide', () => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) return;
    const player = game.getPlayer(socket.id);
    if (player) { player.isHidden = false; player._hideSpot = null; }
  });

  // 3D模式强制结束夜晚（管理员/房主）
  socket.on('3d:endNight', () => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game || game.gameMode !== 'THIRD_PERSON') return;
    if (game.hostId !== socket.id) return;
    game._end3DNight();
  });

  // ==================== WebRTC 语音信令 ====================

  // 加入语音频道
  socket.on('voice:join', () => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) return;
    const player = game.getPlayer(socket.id);
    if (!player) return;

    // 通知房间内其他玩家有新语音参与者
    socket.to(game.id).emit('voice:peerJoined', {
      peerId: socket.id,
      peerName: player.name,
    });

    console.log(`[语音] ${player.name} 加入语音 (房间 ${game.id})`);
  });

  // 离开语音频道
  socket.on('voice:leave', () => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) return;

    // 通知房间内其他玩家
    socket.to(game.id).emit('voice:peerLeft', {
      peerId: socket.id,
    });
  });

  // WebRTC Offer 转发（验证双方在同一房间）
  socket.on('voice:offer', ({ targetId, offer }) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) return;
    const targetPlayer = game.getPlayer(targetId);
    if (!targetPlayer) return; // 目标不在同一房间，拒绝
    io.to(targetId).emit('voice:offer', {
      peerId: socket.id,
      offer,
    });
  });

  // WebRTC Answer 转发（验证双方在同一房间）
  socket.on('voice:answer', ({ targetId, answer }) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) return;
    const targetPlayer = game.getPlayer(targetId);
    if (!targetPlayer) return;
    io.to(targetId).emit('voice:answer', {
      peerId: socket.id,
      answer,
    });
  });

  // ICE Candidate 转发（验证双方在同一房间）
  socket.on('voice:iceCandidate', ({ targetId, candidate }) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) return;
    const targetPlayer = game.getPlayer(targetId);
    if (!targetPlayer) return;
    io.to(targetId).emit('voice:iceCandidate', {
      peerId: socket.id,
      candidate,
    });
  });

  // 语音活动状态广播（用于说话指示灯，节流去重）
  const speakingStates = new Map(); // socket.id → boolean
  socket.on('voice:speaking', ({ isSpeaking }) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) return;
    const lastState = speakingStates.get(socket.id);
    if (lastState === isSpeaking) return; // 状态未变化，跳过
    speakingStates.set(socket.id, isSpeaking);
    socket.to(game.id).emit('voice:speaking', {
      peerId: socket.id,
      isSpeaking,
    });
  });

  // ==================== 音效广播 ====================

  // 广播游戏音效事件
  socket.on('sfx:play', ({ soundId }) => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) return;
    // 转发给房间内其他人
    socket.to(game.id).emit('sfx:play', { soundId });
  });

  // ==================== 状态请求 ====================

  socket.on('game:requestState', () => {
    const game = gameManager.getGameByPlayer(socket.id);
    if (!game) return;

    socket.emit('game:state', game.getPublicState());
    const privateState = game.getPrivateState(socket.id);
    if (privateState) {
      socket.emit('game:privateState', privateState);
    }
  });
}

// ==================== 角色配置验证 ====================

/**
 * 验证自定义角色配置是否合法
 * 规则：
 *  - 至少包含1个狼人阵营角色（ALPHA_WOLF 或 WEREWOLF）
 *  - 不能全是狼人
 *  - 至少1个好人阵营角色
 *  - 总数不能超过最大玩家数
 */
function validateRoleConfig(roleConfig, maxPlayers) {
  if (!roleConfig || !Array.isArray(roleConfig) || roleConfig.length === 0) {
    return null;
  }
  if (roleConfig.length > maxPlayers) {
    return null;
  }

  const hasWolf = roleConfig.some(r => r === ROLES.ALPHA_WOLF || r === ROLES.WEREWOLF);
  const hasVillage = roleConfig.some(r =>
    [ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.VILLAGER, ROLES.GUARD, ROLES.HUNTER].includes(r)
  );
  const allWolves = roleConfig.every(r => r === ROLES.ALPHA_WOLF || r === ROLES.WEREWOLF);

  if (!hasWolf || !hasVillage || allWolves) {
    return null;
  }

  // 去除非角色字符串，只保留有效角色
  return roleConfig;
}

// ==================== 辅助函数 ====================

/**
 * v2.0: 夜晚行动按角色+步骤白名单校验
 * 防止客户端伪造不属于自己角色/步骤的行动
 */
function _validateNightAction(player, currentStep, action, target, ability, game) {
  // 基础校验
  if (!action || !currentStep) return false;
  if (player.halfAlive) return false; // 半条命状态不能行动

  // 检查当前步骤是否是该玩家的步骤
  const isParticipant = game._getPlayersForStep(currentStep).some(p => p.id === player.id);
  if (!isParticipant) return false;

  // 按步骤+角色校验合法行动
  const stepActionMap = {
    HUNTER: {
      roles: ['HUNTER'],
      actions: ['SLEEP', 'GO_OUT', 'USE_ABILITY'],
      allowedAbilities: ['useRifle', 'rifleTarget', 'hasRifle', 'hasBlunderbuss', 'observeTarget', 'useTrap', 'trapTarget', 'markRevenge'],
    },
    ALPHA_WOLF: {
      roles: ['ALPHA_WOLF'],
      actions: ['SLEEP', 'GO_OUT', 'USE_ABILITY'],
      allowedAbilities: ['transform', 'infect', 'kill', 'killTarget', 'fakeIdentity', 'fakeIdentityRole'],
    },
    GUARD: {
      roles: ['GUARD'],
      actions: ['SLEEP', 'GO_OUT', 'USE_ABILITY', 'PATROL', 'FORTIFY', 'SACRIFICE'],
      allowedAbilities: ['guard', 'fortify', 'patrol', 'sacrifice'],
    },
    WEREWOLF: {
      roles: ['WEREWOLF', 'ALPHA_WOLF'],
      actions: ['SLEEP', 'GO_OUT', 'USE_ABILITY', 'HOWL', 'DISGUISE'],
      allowedAbilities: ['kill', 'trackScent', 'howl', 'disguise'],
    },
    SEER: {
      roles: ['SEER'],
      actions: ['SLEEP', 'GO_OUT', 'USE_ABILITY'],
      allowedAbilities: ['check', 'dreamFragment', 'spiritVision', 'spiritVisionTarget'],
    },
    POISON_WITCH: {
      roles: ['POISON_WITCH'],
      actions: ['SLEEP', 'GO_OUT', 'USE_ABILITY'],
      allowedAbilities: ['lethalPoison', 'lethalPoisonTarget', 'potion', 'potionTarget', 'poisonFog', 'poisonFogTarget', 'singlePoison'],
    },
    HEAL_WITCH: {
      roles: ['HEAL_WITCH'],
      actions: ['SLEEP', 'GO_OUT', 'USE_ABILITY', 'BATTLEFIELD_AID', 'DIAGNOSE'],
      allowedAbilities: ['heal', 'healTarget', 'poison', 'poisonTarget', 'battlefieldAid', 'plantHerbGarden', 'diagnose'],
    },
    VILLAGER: {
      roles: ['VILLAGER'],
      actions: ['SLEEP', 'GO_OUT', 'EAVESDROP', 'TRAP_SET', 'NIGHT_WATCH', 'FORTIFY_DOOR', 'HERBAL_REMEDY', 'TRADE_INFO'],
      allowedAbilities: ['secondVisit', 'secondTarget'],
    },
  };

  const stepRules = stepActionMap[currentStep];
  if (!stepRules) return true; // RESOLUTION等无规则步骤放行

  // 角色检查
  if (!stepRules.roles.includes(player.role)) return false;

  // 行动类型检查
  if (!stepRules.actions.includes(action)) return false;

  // 能力白名单检查
  if (ability && stepRules.allowedAbilities) {
    const abilityKeys = Object.keys(ability).filter(k => ability[k] !== null && ability[k] !== false);
    for (const key of abilityKeys) {
      if (!stepRules.allowedAbilities.includes(key)) {
        console.log(`[安全] 非法ability key: ${key} from ${player.role} in step ${currentStep}`);
        return false;
      }
    }
  }

  // 特殊限制：狼人嚎叫和伪装不能同时刀人
  if ((action === 'HOWL' || action === 'DISGUISE') && ability?.kill) return false;

  // 特殊限制：毒巫药水不能自己用自己（毒巫不能自救）
  if (action === 'USE_ABILITY' && ability?.potion && ability?.potionTarget === player.id) return false;

  // 特殊限制：村民的某些行动需要特定villagerType
  if (player.role === 'VILLAGER') {
    if (action === 'TRAP_SET' && player.villagerType !== 'OLD_HUNTER') return false;
    if (action === 'NIGHT_WATCH' && player.villagerType !== 'NIGHT_WATCHER') return false;
    if (action === 'FORTIFY_DOOR' && player.villagerType !== 'BLACKSMITH') return false;
    if (action === 'HERBAL_REMEDY' && player.villagerType !== 'HERBALIST') return false;
    if (action === 'TRADE_INFO' && player.villagerType !== 'MERCHANT') return false;
  }

  return true;
}
