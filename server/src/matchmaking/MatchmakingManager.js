// ============================================================
// MatchmakingManager.js — 匹配系统
// 队列管理 + MMR区间匹配 + 接受确认
// ============================================================

import { MATCHMAKING } from '../game/constants.js';
import { Game } from '../game/Game.js';

export class MatchmakingManager {
  constructor(gameManager, dbManager) {
    this.gameManager = gameManager;
    this.db = dbManager;
    this.queue = new Map();          // userId → QueueEntry
    this.queueOrder = [];             // FIFO
    this.pendingMatches = new Map();  // roomCode → { players, timeoutId, acceptStatus }
    this._interval = null;
  }

  start() {
    this._restoreQueue();
    this._interval = setInterval(() => this._runCycle(), MATCHMAKING.CYCLE_MS);
  }

  stop() {
    if (this._interval) clearInterval(this._interval);
  }

  // ==================== 队列操作 ====================

  joinQueue(userId, socketId, username, mode, mmr, gamesPlayed) {
    if (this.queue.has(userId)) return { success: false, error: '已在队列中' };
    if (this.gameManager.getGameByPlayer(socketId)) return { success: false, error: '已在游戏中' };

    const entry = {
      userId, socketId, username, mode,
      mmr: mmr || 1000,
      gamesPlayed: gamesPlayed || 0,
      joinedAt: Date.now(),
      bracketExpansion: 0,
    };
    this.queue.set(userId, entry);
    this.queueOrder.push(userId);
    this._persistQueue();

    const position = this.queueOrder.indexOf(userId) + 1;
    return { success: true, position, estimatedWaitSeconds: position * 15 };
  }

  leaveQueue(userId) {
    this.queue.delete(userId);
    this.queueOrder = this.queueOrder.filter(id => id !== userId);
    this._persistQueue();
    return { success: true };
  }

  getStatus(userId) {
    const entry = this.queue.get(userId);
    if (!entry) return { inQueue: false };
    return {
      inQueue: true,
      mode: entry.mode,
      position: this.queueOrder.indexOf(userId) + 1,
      estimatedWaitSeconds: (this.queueOrder.indexOf(userId) + 1) * 15,
    };
  }

  // ==================== 匹配算法 ====================

  _runCycle() {
    if (this.queue.size === 0) return;

    const quickPlayers = [];
    const rankedPlayers = [];

    for (const id of this.queueOrder) {
      const entry = this.queue.get(id);
      if (!entry) continue;
      if (entry.mode === 'RANKED') rankedPlayers.push(entry);
      else quickPlayers.push(entry);
    }

    this._tryFormMatch(rankedPlayers, 'RANKED', MATCHMAKING.MIN_RANKED_PLAYERS);
    this._tryFormMatch(quickPlayers, 'QUICK', MATCHMAKING.MIN_QUICK_PLAYERS);

    // 扩大未匹配者的搜索区间
    for (const [id, entry] of this.queue) {
      entry.bracketExpansion = Math.min(
        (entry.bracketExpansion || 0) + 1,
        Math.floor(MATCHMAKING.MAX_BRACKET_RADIUS / MATCHMAKING.BRACKET_EXPANSION_RATE)
      );
    }
  }

  _tryFormMatch(players, mode, minPlayers) {
    if (players.length < minPlayers) return;

    // 按等待时间排序
    players.sort((a, b) => a.joinedAt - b.joinedAt);

    for (const seed of players) {
      const bracket = MATCHMAKING.INITIAL_BRACKET_RADIUS +
        (seed.bracketExpansion || 0) * MATCHMAKING.BRACKET_EXPANSION_RATE;

      const compatible = players.filter(p =>
        p.userId !== seed.userId &&
        Math.abs(p.mmr - seed.mmr) <= Math.min(bracket, MATCHMAKING.MAX_BRACKET_RADIUS)
      );

      const group = [seed, ...compatible].slice(0, MATCHMAKING.TARGET_PLAYERS);

      if (group.length >= minPlayers) {
        this._formMatch(group, mode);
        return;
      }
    }
  }

  _formMatch(group, mode) {
    const roomCode = this.gameManager.generateRoomCode();
    const game = new Game(roomCode, 'SYSTEM', '匹配系统');

    game.matchType = mode;
    game.isPrivate = true;
    game._isMatchRoom = true;
    game.matchAutoStart = true;
    game.enableBots = (mode !== 'RANKED');
    game.setGameManager(this.gameManager);

    this.gameManager.games.set(roomCode, game);

    const acceptStatus = {};
    for (const entry of group) {
      acceptStatus[entry.userId] = false;
      // 从队列移除
      this.queue.delete(entry.userId);
      this.queueOrder = this.queueOrder.filter(id => id !== entry.userId);
    }

    const timeoutId = setTimeout(() => {
      this._handleAcceptTimeout(roomCode);
    }, MATCHMAKING.ACCEPT_TIMEOUT_MS);

    this.pendingMatches.set(roomCode, {
      players: group,
      acceptStatus,
      timeoutId,
      game,
    });

    // 通知所有玩家
    const io = this.gameManager._io;
    if (io) {
      for (const entry of group) {
        io.to(entry.socketId).emit('matchmaking:found', {
          roomCode,
          players: group.map(p => ({ username: p.username, mmr: p.mmr })),
          matchType: mode,
          acceptTimeoutSeconds: MATCHMAKING.ACCEPT_TIMEOUT_MS / 1000,
        });
      }
    }

    this._persistQueue();
  }

  acceptMatch(userId, roomCode) {
    const pending = this.pendingMatches.get(roomCode);
    if (!pending) return { success: false, error: '匹配已过期' };

    pending.acceptStatus[userId] = true;

    const allAccepted = Object.values(pending.acceptStatus).every(s => s === true);
    if (allAccepted) {
      clearTimeout(pending.timeoutId);

      // 把所有玩家加入房间
      for (const entry of pending.players) {
        pending.game.addPlayer(entry.socketId, entry.username);
        this.gameManager.playerRooms.set(entry.socketId, roomCode);
      }

      const io = this.gameManager._io;
      if (io) {
        for (const entry of pending.players) {
          io.sockets.sockets.get(entry.socketId)?.join(roomCode);
          io.to(entry.socketId).emit('game:state', pending.game.getPublicState());
        }
      }

      // 自动开始游戏
      setTimeout(() => {
        pending.game.startGame();
        pending.game.setIO(io);
      }, 2000);

      this.pendingMatches.delete(roomCode);
      return { success: true, allAccepted: true };
    }

    return { success: true, allAccepted: false };
  }

  _handleAcceptTimeout(roomCode) {
    const pending = this.pendingMatches.get(roomCode);
    if (!pending) return;

    // 未接受的玩家返回队列前端
    for (const entry of pending.players) {
      if (!pending.acceptStatus[entry.userId]) {
        this.queue.set(entry.userId, entry);
        this.queueOrder.unshift(entry.userId);
      }
    }

    // 删除房间和pending
    this.gameManager.games.delete(roomCode);
    this.pendingMatches.delete(roomCode);
    this._persistQueue();
  }

  _persistQueue() {
    const data = [];
    for (const [id, entry] of this.queue) {
      data.push({ userId: id, mode: entry.mode, joinedAt: entry.joinedAt });
    }
    this.db.saveMatchmakingQueue(data);
  }

  _restoreQueue() {
    const data = this.db.getMatchmakingQueue();
    if (data?.queue) {
      for (const item of data.queue) {
        if (Date.now() - item.joinedAt < 1800000) { // 30分钟过期
          this.queue.set(item.userId, {
            userId: item.userId,
            mode: item.mode,
            joinedAt: item.joinedAt,
            bracketExpansion: 0,
            socketId: null,
            username: '',
            mmr: 1000,
            gamesPlayed: 0,
          });
        }
      }
    }
  }
}
