// ============================================================
// 游戏管理器 —— 管理所有活跃的房间和游戏
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { Game } from './Game.js';
import { TruthGame } from './truth/TruthGame.js';
import { PHASES } from './constants.js';

export class GameManager {
  constructor() {
    this.games = new Map();     // roomId -> Game
    this.playerRooms = new Map(); // playerId -> roomId
    this.truthGames = new Map();      // roomId -> TruthGame（真相盘模式，独立于桌游）
    this.truthPlayerRooms = new Map(); // playerId -> roomId
    this.disconnectedPlayers = new Map(); // playerToken -> { roomCode, playerId, timeoutId }
    this._io = null;            // Socket.IO 实例（用于大厅广播）
    this.userManager = null;    // UserManager 引用（用于回放保存）
    // 真相盘房间活动清扫：每 5 分钟检查一次，清理超 30 分钟无活动的房间
    this._truthSweep = setInterval(() => this._sweepTruthRooms(), 5 * 60 * 1000);
    if (this._truthSweep.unref) this._truthSweep.unref();
  }

  // 设置 IO 实例用于全局广播
  setIO(io) {
    this._io = io;
  }

  // 推送大厅更新给所有连接的客户端
  broadcastLobbyUpdate() {
    if (this._io) {
      const list = this.getLobbyList();
      this._io.emit('lobby:updated', { rooms: list });
    }
  }

  // 生成短房间号（6位）- 改用 while 避免递归溢出
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let attempts = 0;
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;
      if (attempts > 100) break; // 极不可能但安全兜底
    } while (this.games.has(code) || this.truthGames.has(code));
    return code;
  }

  // 创建房间
  createRoom(hostId, hostName) {
    const roomCode = this.generateRoomCode();
    const game = new Game(roomCode, hostId, hostName);
    game.setGameManager(this);
    this.games.set(roomCode, game);
    this.playerRooms.set(hostId, roomCode);
    return game;
  }

  // 加入房间（支持密码验证）
  joinRoom(roomCode, playerId, playerName, password = null) {
    const game = this.games.get(roomCode);
    if (!game) return { error: '房间不存在' };
    if (game.phase !== PHASES.LOBBY) return { error: '游戏已开始' };
    if (game.players.length >= game.maxPlayers) return { error: '房间已满' };
    // 密码验证
    if (game.password && game.password !== password) {
      return { error: '密码错误' };
    }

    const player = game.addPlayer(playerId, playerName);
    if (!player) return { error: '加入失败（可能是名称重复）' };

    this.playerRooms.set(playerId, roomCode);
    return { game, player };
  }

  // 获取大厅列表（仅公开房间）
  getLobbyList() {
    const rooms = [];
    for (const [id, game] of this.games) {
      // 只展示公开的、在等待中的房间；私密房间不暴露
      if (game.phase === PHASES.LOBBY && !game.isPrivate) {
        rooms.push(game.getLobbySummary());
      }
    }
    return rooms;
  }

  // 获取所有房间（包括游戏中的，用于统计）
  getAllRooms() {
    const rooms = [];
    for (const [id, game] of this.games) {
      rooms.push(game.getLobbySummary());
    }
    return rooms;
  }

  // 离开房间
  leaveRoom(playerId) {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return;

    const game = this.games.get(roomCode);
    if (!game) return;

    game.removePlayer(playerId);
    this.playerRooms.delete(playerId);

    // 如果房间没人了，删除游戏
    if (game.players.length === 0) {
      this.games.delete(roomCode);
    }
    return game;
  }

  // 游戏结束后 5 分钟自动清理 (由 Game.endGame 调度; 此前是死代码, 房间从不 GC)
  scheduleGameCleanup(roomCode) {
    setTimeout(() => {
      const game = this.games.get(roomCode);
      if (!game) return;
      // 游戏已结束/已回大厅, 且没有任何在线的真人玩家 → 清理, 防止房间泄漏
      const hasLiveHuman = game.players.some(p => !p.isBot && !p.disconnected);
      if ((game.phase === 'GAME_OVER' || game.phase === 'LOBBY') && !hasLiveHuman) {
        for (const p of game.players) {
          this.playerRooms.delete(p.id);
          this.disconnectedPlayers.delete(p.id);
        }
        this.games.delete(roomCode);
        console.log(`[清理] 房间 ${roomCode} 已自动清理`);
      }
    }, 300000); // 5 分钟
  }

  // 获取玩家所在的游戏
  getGameByPlayer(playerId) {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return null;
    return this.games.get(roomCode) || null;
  }

  // 获取游戏
  getGame(roomCode) {
    return this.games.get(roomCode) || null;
  }

  // ==================== 真相盘房间 ====================

  isTruthRoom(roomCode) {
    return this.truthGames.has(roomCode);
  }

  createTruthRoom(hostId, hostName) {
    const roomCode = this.generateRoomCode();
    const game = new TruthGame(roomCode, hostId, hostName);
    this.truthGames.set(roomCode, game);
    this.truthPlayerRooms.set(hostId, roomCode);
    return game;
  }

  // 清理超时无活动的真相盘房间（由 _truthSweep 周期调用，只清理无活动房，不误杀进行中的对局）
  _sweepTruthRooms() {
    const now = Date.now();
    for (const [roomCode, g] of this.truthGames) {
      if (now - g.lastActivity > 30 * 60 * 1000) {
        g.destroy();
        this.truthGames.delete(roomCode);
        for (const [pid, rc] of this.truthPlayerRooms) {
          if (rc === roomCode) this.truthPlayerRooms.delete(pid);
        }
        console.log(`[清理] 真相盘房间 ${roomCode} 超时无活动清理`);
      }
    }
  }

  joinTruthRoom(roomCode, socketId, name) {
    const game = this.truthGames.get(roomCode);
    if (!game) return { error: '房间不存在' };
    const result = game.addPlayer(socketId, name);
    if (result.error) return { error: result.error };
    this.truthPlayerRooms.set(socketId, roomCode);
    return { game, player: result.player };
  }

  leaveTruthRoom(socketId) {
    const roomCode = this.truthPlayerRooms.get(socketId);
    if (!roomCode) return null;
    const game = this.truthGames.get(roomCode);
    if (!game) {
      this.truthPlayerRooms.delete(socketId);
      return null;
    }
    game.removePlayer(socketId);
    this.truthPlayerRooms.delete(socketId);
    if (game.players.length === 0) {
      game.destroy();
      this.truthGames.delete(roomCode);
    }
    return game;
  }

  getTruthGameByPlayer(socketId) {
    const roomCode = this.truthPlayerRooms.get(socketId);
    if (!roomCode) return null;
    return this.truthGames.get(roomCode) || null;
  }

  getTruthGame(roomCode) {
    return this.truthGames.get(roomCode) || null;
  }

  rejoinTruthPlayer(roomCode, seat, token, newSocketId) {
    const game = this.truthGames.get(roomCode);
    if (!game) return null;
    const oldSocket = game.seatToSocket[seat];
    if (!game.rebindSeat(seat, newSocketId, token)) return null;
    // 清理旧持有 socket 的映射，避免无座次孤儿
    if (oldSocket && oldSocket !== newSocketId) this.truthPlayerRooms.delete(oldSocket);
    this.truthPlayerRooms.set(newSocketId, roomCode);
    return game;
  }

  handleTruthDisconnect(socketId) {
    const game = this.getTruthGameByPlayer(socketId);
    if (!game) return null;
    if (game.phase === 'LOBBY' || game.phase === 'GAME_OVER') {
      const wasLobby = game.phase === 'LOBBY';
      this.leaveTruthRoom(socketId);
      return wasLobby ? game : null;
    }
    // PLAYING：座次保留等待重连（truth:rejoin），动作会因 socket 不存在而失败；
    // 清掉旧 socket 的 truthPlayerRooms 映射，避免重连后残留死映射
    this.truthPlayerRooms.delete(socketId);
    game.positionSync?.cleanupPlayer(socketId);
    return null;
  }

  // 断开连接处理 — 不立即删除，标记离线并设置超时
  handleDisconnect(playerId) {
    const game = this.getGameByPlayer(playerId);
    if (!game) return null;

    // 大厅中直接离开
    if (game.phase === PHASES.LOBBY) {
      return this.leaveRoom(playerId);
    }

    // v2.0: 选人阶段断线 → 自动随机分配身份，防止流程卡死
    if (game.phase === 'CHARACTER_SELECT') {
      const player = game.getPlayer(playerId);
      if (player && !game.characterSelections[playerId]) {
        const taken = new Set(Object.values(game.characterSelections));
        const remaining = (game.availableCharacters || []).filter(c => !taken.has(c));
        if (remaining.length > 0) {
          const pick = remaining[Math.floor(Math.random() * remaining.length)];
          game.characterSelections[playerId] = pick;
          game._applyCharacterToPlayer(player, pick);
        }
      }
    }

    // 游戏中：标记离线，不删除
    const player = game.getPlayer(playerId);
    if (player) {
      player.disconnected = true;
      // 120 秒未重连则移除
      const timeoutId = setTimeout(() => {
        const currentGame = this.games.get(game.id);
        if (currentGame) {
          const p = currentGame.getPlayer(playerId);
          if (p && p.disconnected) {
            // 超时未重连，将其标记为死亡（游戏平衡）
            if (currentGame.phase !== 'GAME_OVER') {
              p.alive = false;
              currentGame.nightLog.push({ type: 'death', player: playerId, reason: 'disconnect_timeout', msg: `${p.name} 断线超时，判定出局` });
              currentGame.checkWinCondition();
            }
            this.playerRooms.delete(playerId);
            this.disconnectedPlayers.delete(player.id);
            // 更新剩余玩家
            if (currentGame.phase !== 'GAME_OVER' && currentGame._io) {
              currentGame._io.to(game.id).emit('game:state', currentGame.getPublicState());
            }
          }
        }
      }, 120000);

      this.disconnectedPlayers.set(player.id, {
        roomCode: game.id,
        playerId: player.id,
        timeoutId,
      });
    }

    // 清理旧的 socket->room 映射
    this.playerRooms.delete(playerId);
    return game;
  }

  // 断线重连：将新 socketId 重新绑定到旧 player
  reconnectPlayer(newSocketId, oldPlayerId, oldRoomCode) {
    const info = this.disconnectedPlayers.get(oldPlayerId);
    if (!info) return null;

    const game = this.games.get(info.roomCode);
    if (!game || game.id !== oldRoomCode) return null;

    const player = game.getPlayer(oldPlayerId);
    if (!player) return null;

    // 清除超时
    if (info.timeoutId) clearTimeout(info.timeoutId);
    this.disconnectedPlayers.delete(oldPlayerId);

    // 重新绑定
    player.disconnected = false;
    this.playerRooms.set(newSocketId, info.roomCode);

    // 将玩家的 socketId 更新
    const oldId = player.id;
    player.id = newSocketId;

    // 迁移所有引用旧 ID 的状态
    // 1. 自己的 currentHouse
    if (player.currentHouse === oldId) {
      player.currentHouse = newSocketId;
    }

    // 2. 私密日志 key
    if (game.privateLogs[oldId]) {
      game.privateLogs[newSocketId] = game.privateLogs[oldId];
      delete game.privateLogs[oldId];
    }

    // 3. 其他玩家的 knownCorrupted 数组
    for (const p of game.players) {
      if (p.knownCorrupted && p.knownCorrupted.includes(oldId)) {
        const idx = p.knownCorrupted.indexOf(oldId);
        p.knownCorrupted[idx] = newSocketId;
      }
      // 守卫目标
      if (p.protectTarget === oldId) {
        p.protectTarget = newSocketId;
      }
      // 蚀者噬灵目标
      if (p.corruptedKillTarget === oldId) {
        p.corruptedKillTarget = newSocketId;
      }
    }

    // 4. nightLog 中的引用
    for (const entry of game.nightLog) {
      if (entry.player === oldId) entry.player = newSocketId;
      if (entry.target === oldId) entry.target = newSocketId;
      if (entry.corrupted && Array.isArray(entry.corrupted)) {
        entry.corrupted = entry.corrupted.map(w => w === oldId ? newSocketId : w);
      }
    }

    // 更新 game 中的引用
    this.playerRooms.delete(oldId);
    this.playerRooms.set(newSocketId, info.roomCode);

    // 更新 host（如果断线的是房主）
    if (game.hostId === oldId) {
      game.hostId = newSocketId;
    }

    // v2.0: 迁移 characterSelections
    if (game.characterSelections && game.characterSelections[oldId]) {
      game.characterSelections[newSocketId] = game.characterSelections[oldId];
      delete game.characterSelections[oldId];
    }

    // v2.0: 迁移 characterSelect 阶段相关引用
    // votes 迁移（如果还在投票阶段）
    if (game.votes && game.votes[oldId] !== undefined) {
      game.votes[newSocketId] = game.votes[oldId];
      delete game.votes[oldId];
    }
    // discussionOrder 迁移
    if (game.discussionOrder) {
      const discIdx = game.discussionOrder.indexOf(oldId);
      if (discIdx >= 0) game.discussionOrder[discIdx] = newSocketId;
    }
    if (game.currentSpeakerId === oldId) {
      game.currentSpeakerId = newSocketId;
    }
    // 其他玩家的 sacrificeTarget / revengeTarget / trapTarget
    for (const p of game.players) {
      if (p.sacrificeTarget === oldId) p.sacrificeTarget = newSocketId;
      if (p.revengeTarget === oldId) p.revengeTarget = newSocketId;
      if (p.trapTarget === oldId) p.trapTarget = newSocketId;
      if (p.herbalRemedyTarget === oldId) p.herbalRemedyTarget = newSocketId;
      if (p.diagnoseTarget === oldId) p.diagnoseTarget = newSocketId;
      if (p.fortifiedTarget === oldId) p.fortifiedTarget = newSocketId;
      // 同蚀者开眼列表
      if (p.corruptedOpenEyesTogether && p.corruptedOpenEyesTogether.includes(oldId)) {
        const weIdx = p.corruptedOpenEyesTogether.indexOf(oldId);
        p.corruptedOpenEyesTogether[weIdx] = newSocketId;
      }
    }

    return { game, player, oldId };
  }
}
