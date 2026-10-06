// ============================================================
// TruthGame —— 真相盘模式的房间封装
//
// 把纯逻辑 TruthEngine 接进 Socket.IO：
//   1. 座次映射：加入顺序 → 引擎玩家 P1..Pn（阵营由种子决定，与加入顺序无关）
//   2. 公开/私有状态拆分：真神、碎片真伪、线索文本只在私有状态下发
//   3. 命运时钟计时：按 veilConsumeIntervalSec 周期推进帷幕吞噬
//   4. 动作路由：服务端注入 playerId，白名单校验 + 冷却防刷
//
// 关键安全约束：
//   - 真神、碎片 kind（真/伪）、线索文本在「对局进行中」绝不出现在公开状态
//   - 种子在开局保密（否则客户端可本地复现整个谜底），终局才公开供回放
//   - 阵营/角色仅终局公开；食神者之间通过私有状态相认
// ============================================================

import crypto from 'crypto';
import { createMatch, applyAction, computePersonalScores } from './TruthEngine.js';
import { GOD_MAP, TEAM_CORRUPTED, TEAM_SPIRIT } from './truth-data.js';
import { PositionSync } from '../PositionSync.js';

// 玩家可发起的动作白名单（其余一律拒绝，防止伪造引擎内部动作如 veilTick）
const ALLOWED_ACTIONS = new Set([
  'task', 'taskFail', 'sacrifice', 'blunderbuss', 'burnVeil',
  'guess', 'burnFalse', 'move', 'reveal', 'purify',
]);

export class TruthGame {
  constructor(roomCode, hostId, hostName) {
    this.id = roomCode;
    this.hostId = hostId;
    this.hostName = hostName;
    this.gameMode = 'TRUTH_DISC';
    this.phase = 'LOBBY';        // LOBBY -> PLAYING -> GAME_OVER
    this.maxPlayers = 8;
    this.minPlayers = 4;
    this._createdAt = Date.now();

    this.players = [];           // 大厅列表 { id: socketId, name, seat, alive, zone }
    this.seatToSocket = {};      // seat 'P1' -> socketId
    this.socketToSeat = {};      // socketId -> seat 'P1'

    this.match = null;           // TruthEngine 对局对象（startGame 时创建）
    this.seed = null;
    this._io = null;
    this._tickTimer = null;
    this.positionSync = new PositionSync(this);
    this._positionSyncInterval = null;

    this._actionCooldown = new Map(); // socketId -> lastActionTs
    this._actionCooldownMs = 1500;    // 每名玩家动作最小间隔（防连点刷灵焰）
    this._sacrificeCooldownMs = 30000; // 献祭全局冷却（防食神者 1.5s×3 连杀秒胜）
    this._lastSacrificeTs = 0;

    this.rejoinTokens = {};           // seat -> 重连凭证（防座次劫持）
    this.lastActivity = Date.now();   // 最近活动时间（用于超时清理）

    // 房主即首位玩家（开局后座次 P1），与桌游 Game 构造时把 host 加入一致
    this.players.push({ id: hostId, name: hostName, seat: null, alive: true, zone: null });
  }

  setIO(io) { this._io = io; }

  getPlayer(socketId) {
    return this.players.find((p) => p.id === socketId) || null;
  }

  addPlayer(socketId, name) {
    if (this.phase !== 'LOBBY') return { error: '游戏已开始' };
    if (this.players.length >= this.maxPlayers) return { error: '房间已满' };
    if (this.players.some((p) => p.name === name)) return { error: '加入失败（名称重复）' };
    this.players.push({ id: socketId, name, seat: null, alive: true, zone: null });
    return { player: this.players[this.players.length - 1] };
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex((p) => p.id === socketId);
    if (idx === -1) return null;
    const [p] = this.players.splice(idx, 1);
    if (p.seat) {
      delete this.seatToSocket[p.seat];
      delete this.socketToSeat[socketId];
    }
    return p;
  }

  startGame() {
    const n = this.players.length;
    if (n < this.minPlayers) return false;

    // 真实对局用密码学随机种子（不可预测）；回放靠赛后公开 seed + 动作序列逐帧复现
    this.seed = crypto.randomBytes(16).toString('hex');
    const corruptedCount = n >= 7 ? 2 : 1;
    this.match = createMatch(this.seed, { playerCount: n, corruptedCount });

    // 座次 = 加入顺序映射到引擎 P1..Pn；阵营/角色由种子决定，与加入顺序无关（公平）
    this.players.forEach((p, i) => {
      p.seat = `P${i + 1}`;
      p.alive = true;
      p.zone = null;
      this.seatToSocket[p.seat] = p.id;
      this.socketToSeat[p.id] = p.seat;
      this.rejoinTokens[p.seat] = crypto.randomBytes(16).toString('hex');
      const ep = this.match.players.find((x) => x.id === p.seat);
      if (ep) ep.name = p.name; // 用真实昵称覆盖引擎默认名（不影响确定性）
    });

    this.phase = 'PLAYING';
    this._startTicker();
    this._startPositionSync();
    return true;
  }

  // 断线重连：校验座次格式 + 重连凭证后，把新 socketId 重新绑定到旧座次
  rebindSeat(seat, newSocketId, token) {
    if (typeof seat !== 'string' || !/^P\d+$/.test(seat)) return false;
    if (!Object.hasOwn(this.seatToSocket, seat)) return false;
    if (this.rejoinTokens[seat] !== token) return false;
    const oldSocket = this.seatToSocket[seat];
    const lp = this.players.find((p) => p.seat === seat);
    if (lp) lp.id = newSocketId;
    if (oldSocket && oldSocket !== newSocketId) delete this.socketToSeat[oldSocket];
    this.seatToSocket[seat] = newSocketId;
    this.socketToSeat[newSocketId] = seat;
    if (oldSocket && oldSocket !== newSocketId) this.positionSync?.cleanupPlayer(oldSocket);
    this.lastActivity = Date.now();
    return true;
  }

  // ==================== 状态获取 ====================

  getLobbyState() {
    return {
      id: this.id,
      hostId: this.hostId,
      phase: this.phase,
      gameMode: this.gameMode,
      maxPlayers: this.maxPlayers,
      minPlayers: this.minPlayers,
      players: this.players.map((p) => ({ id: p.id, name: p.name, alive: true })),
    };
  }

  getPublicState() {
    const base = {
      id: this.id,
      hostId: this.hostId,
      phase: this.phase,
      gameMode: this.gameMode,
      maxPlayers: this.maxPlayers,
      minPlayers: this.minPlayers,
    };
    if (this.phase === 'LOBBY') {
      return this.getLobbyState();
    }
    const m = this.match;
    const gameOver = this.phase === 'GAME_OVER';
    const god = GOD_MAP[m.god];

    return {
      ...base,
      clocks: { ...m.clocks },
      enginePhase: m.phase,              // 命运时钟阶段 1/2/3（与房间 phase 区分）
      unlocks: m.unlocks,
      ebbWindow: m.ebbWindow,
      zones: m.zones.map((z) => ({ name: z.name, consumed: z.consumed })),
      purifyPoint: {
        // 灰烬之神隐藏净化点（zone=null，玩家须靠碎片线索定位）；否则公开当前位置。
        // 不下发 hidden/wandering 布尔（否则开局直接泄真神）。
        zone: god.mechanic.purifyPointHidden ? null : m.purifyPoint.zone,
      },
      tasks: m.tasks.map((t) => ({
        id: t.id, name: t.name, completed: t.completed, completedBy: t.completedBy, sabotaged: t.sabotaged,
      })),
      players: m.players.map((p) => {
        const out = { id: p.id, name: p.name, alive: p.alive, zone: p.zone };
        // 补 socketId 供 3D 客户端把位置广播(socketId)映射回座次(id)
        out.socketId = this.seatToSocket[p.id] || null;
        // 阵营/角色仅终局公开
        if (gameOver) { out.role = p.role; out.team = p.team; }
        return out;
      }),
      // 公开规则常量（时钟阈值透明，是竞技性来源）
      rules: {
        spiritMax: m.config.spiritMax,
        despairMax: m.config.despairMax,
        phase2Despair: m.config.phase2Despair,
        phase3Despair: m.config.phase3Despair,
        veilConsumeMax: m.config.veilConsumeMax,
        veilConsumeIntervalSec: m.config.veilConsumeIntervalSec,
        corruptedCount: m.config.corruptedCount,
        playerCount: m.config.playerCount,
      },
      // 公开叙事日志（只含不含私密碎片内容的事件，取最近 60 条）
      log: m.log.slice(-60),
      winner: m.winner || null,
      reason: m.reason || null,
      purifiedBy: m.purifiedBy || null,
      ...(gameOver ? {
        seed: m.seedRaw,                                   // 终局公开种子，供回放/裁判
        god: { id: god.id, name: god.name, icon: god.icon },
        scores: computePersonalScores(m),
      } : {}),
    };
  }

  getPrivateState(socketId) {
    if (this.phase === 'LOBBY') return null;
    const seat = this.socketToSeat[socketId];
    if (!seat || !this.match) return null;
    const p = this.match.players.find((x) => x.id === seat);
    if (!p) return null;

    const myShards = p.shards.map((s) => ({
      id: s.id,
      text: s.text,
      hintGod: { id: s.hintGod, name: GOD_MAP[s.hintGod].name, icon: GOD_MAP[s.hintGod].icon },
      // 注意：不下发 kind（真/伪）——玩家须自行判断碎片真伪
    }));

    const fellowCorrupted = p.team === TEAM_CORRUPTED
      ? this.match.players
          .filter((x) => x.team === TEAM_CORRUPTED && x.id !== seat)
          .map((x) => ({ seat: x.id, name: x.name }))
      : [];

    let guardTarget = null;
    if (p.contract?.id === 'guardian' && p.guardTargetId) {
      const t = this.match.players.find((x) => x.id === p.guardTargetId);
      guardTarget = t ? { seat: t.id, name: t.name } : null;
    }

    return {
      mySeat: seat,
      myRole: p.role,
      myTeam: p.team,
      myShards,
      myContract: p.contract
        ? { id: p.contract.id, name: p.contract.name, icon: p.contract.icon, desc: p.contract.desc, points: p.contract.points }
        : null,
      guardTarget,
      reincarnationOf: p.reincarnationOf
        ? { id: p.reincarnationOf, name: GOD_MAP[p.reincarnationOf].name }
        : null,
      fellowCorrupted,
      guessedGodId: p.guessedGodId || null,
      burnedFalse: p.burnedFalse,
      sacrificeCount: p.sacrificeCount,
      blunderbussUsed: !!p.blunderbussUsed,
      myRejoinToken: this.rejoinTokens[seat],
    };
  }

  // ==================== 动作路由 ====================

  handleAction(socketId, action) {
    if (this.phase !== 'PLAYING' || !this.match || this.match.winner) {
      return { ok: false, events: ['当前不在行动阶段'] };
    }
    this.lastActivity = Date.now();
    const seat = this.socketToSeat[socketId];
    if (!seat) return { ok: false, events: ['你不在本局中'] };
    const me = this.match.players.find((x) => x.id === seat);
    if (!me || !me.alive) return { ok: false, events: ['你已出局'] };

    // 冷却（防连点刷灵焰/刷动作）
    const now = Date.now();
    if (now - (this._actionCooldown.get(socketId) || 0) < this._actionCooldownMs) {
      return { ok: false, events: ['操作太频繁'] };
    }
    this._actionCooldown.set(socketId, now);

    if (!action || typeof action.type !== 'string' || !ALLOWED_ACTIONS.has(action.type)) {
      return { ok: false, events: ['非法动作类型'] };
    }

    // playerId 由服务端注入（客户端不可伪造座次）
    const engineAction = { type: action.type, playerId: seat };

    switch (action.type) {
      case 'task':
        if (me.team !== TEAM_SPIRIT) return { ok: false, events: ['只有灵焰方能完成任务'] };
        if (typeof action.taskId !== 'string') return { ok: false, events: ['缺少 taskId'] };
        engineAction.taskId = action.taskId;
        break;
      case 'taskFail':
        // 只有食神者能破坏任务拉高绝望（防灵焰方恶意刷绝望）
        if (me.team !== TEAM_CORRUPTED) return { ok: false, events: ['只有食神者能破坏任务'] };
        if (typeof action.taskId !== 'string') return { ok: false, events: ['缺少 taskId'] };
        engineAction.taskId = action.taskId;
        break;
      case 'sacrifice':
        // 全局献祭冷却，防食神者 1.5s×3 连杀秒胜
        if (now - this._lastSacrificeTs < this._sacrificeCooldownMs) {
          return { ok: false, events: [`献祭冷却中（每 ${this._sacrificeCooldownMs / 1000} 秒一次）`] };
        }
        if (typeof action.victimId !== 'string') return { ok: false, events: ['缺少 victimId'] };
        this._lastSacrificeTs = now;
        engineAction.victimId = action.victimId;
        engineAction.executorId = seat;
        break;
      case 'blunderbuss':
        if (typeof action.targetId !== 'string') return { ok: false, events: ['缺少 targetId'] };
        engineAction.targetId = action.targetId;
        break;
      case 'guess':
        if (typeof action.godId !== 'string') return { ok: false, events: ['缺少 godId'] };
        if (!GOD_MAP[action.godId]) return { ok: false, events: ['未知真神'] };
        engineAction.godId = action.godId;
        break;
      case 'move':
        if (typeof action.zone !== 'string') return { ok: false, events: ['缺少 zone'] };
        if (!this.match.zones.some((z) => z.name === action.zone)) return { ok: false, events: ['未知区域'] };
        engineAction.zone = action.zone;
        break;
      default:
        break; // burnVeil / burnFalse / reveal / purify 无需额外参数
    }

    return applyAction(this.match, engineAction);
  }

  // 动作后广播：公开状态 → 全员；私有状态 → 逐人下发；胜负 → 收尾
  broadcastAfterAction(result) {
    this._syncPlayerFlags();
    if (result?.winner) {
      this.phase = 'GAME_OVER';
      this._stopTicker();
      this._stopPositionSync();
    }
    if (!this._io) return;
    const state = this.getPublicState();
    this._io.to(this.id).emit('truth:state', state);
    // 逐人重发私有状态（覆盖 遗忘之神 全体丢碎片等全局影响）
    for (const p of this.players) {
      const priv = this.getPrivateState(p.id);
      if (priv) this._io.to(p.id).emit('truth:privateState', priv);
    }
    if (result?.winner) {
      const g = GOD_MAP[this.match.god];
      this._io.to(this.id).emit('truth:ended', {
        winner: this.match.winner,
        reason: this.match.reason,
        seed: this.match.seedRaw,
        god: { id: g.id, name: g.name, icon: g.icon },
        scores: computePersonalScores(this.match),
      });
    }
  }

  // 把引擎对局的最新 alive/zone 同步回大厅列表（PositionSync 依赖 getPlayer().alive 判定）
  _syncPlayerFlags() {
    if (!this.match) return;
    for (const lp of this.players) {
      const ep = this.match.players.find((x) => x.id === lp.seat);
      if (!ep) continue;
      const wasAlive = lp.alive;
      lp.alive = ep.alive;
      lp.zone = ep.zone;
      if (wasAlive && !ep.alive) this.positionSync?.cleanupPlayer(lp.id);
    }
  }

  _startPositionSync() {
    if (this._positionSyncInterval) clearInterval(this._positionSyncInterval);
    this._positionSyncInterval = setInterval(() => {
      if (this.positionSync) this.positionSync.broadcastIfNeeded();
    }, 100); // 10Hz
  }

  _stopPositionSync() {
    if (this._positionSyncInterval) {
      clearInterval(this._positionSyncInterval);
      this._positionSyncInterval = null;
    }
  }

  // ==================== 命运时钟 ====================

  _startTicker() {
    this._stopTicker();
    const intervalMs = ((this.match?.config?.veilConsumeIntervalSec) || 90) * 1000;
    this._tickTimer = setInterval(() => {
      if (this.phase !== 'PLAYING' || !this.match || this.match.winner) {
        this._stopTicker();
        return;
      }
      // 帷幕已吞噬到上限（地图只剩核心区）→ 停止计时，等待终局
      if (this.match.clocks.veil >= this.match.config.veilConsumeMax) {
        this._stopTicker();
        return;
      }
      this.lastActivity = Date.now();
      const result = applyAction(this.match, { type: 'veilTick' });
      this.broadcastAfterAction(result);
    }, intervalMs);
    if (this._tickTimer?.unref) this._tickTimer.unref();
  }

  _stopTicker() {
    if (this._tickTimer) {
      clearInterval(this._tickTimer);
      this._tickTimer = null;
    }
  }

  // 房间销毁（避免定时器悬挂）
  destroy() {
    this._stopTicker();
    this._stopPositionSync();
  }
}
