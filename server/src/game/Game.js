// ============================================================
// 游戏实例 —— 管理单局游戏的全部状态和逻辑
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { Player } from './Player.js';
import { NightResolver } from './NightResolver.js';
import {
  ROLES, ROLE_NAMES, TEAMS, ROLE_TEAM,
  PHASES, NIGHT_STEPS, NIGHT_STEPS_NIGHT1, NIGHT_STEPS_FULL,
  NIGHT_ACTIONS,
  getRoleConfig,
} from './constants.js';

export class Game {
  constructor(roomId, hostId, hostName) {
    this.id = roomId;
    this.hostId = hostId;
    this.players = [];
    this.phase = PHASES.LOBBY;
    this.round = 0;                  // 当前回合数
    this.nightStep = null;           // 当前夜晚子步骤
    this.nightStepIndex = 0;
    this.maxPlayers = 12;
    this.minPlayers = 5;

    // 房间隐私设置
    this.isPrivate = false;
    this.password = null;           // null = 无密码

    // 投票
    this.votes = {};                 // { voterId: targetId }
    this.voteResults = null;

    // 夜晚结算
    this.nightLog = [];
    this.privateLogs = {};           // { playerId: [log entries] }

    // 日间猎人开枪
    this.hunterDayShoot = null;
    this.dayLog = [];              // 白天日志（不会在夜晚被清除）

    // 计时器（防止玩家卡死）
    this.timer = null;
    this.timeLeft = 0;
    this._phaseTimeout = null;   // 阶段超时句柄
    this.NIGHT_STEP_TIMEOUT = 60000;  // 60s 每步骤
    this.DAY_TIMEOUT = 120000;        // 120s 讨论
    this.VOTE_TIMEOUT = 60000;        // 60s 投票

    // 自定义角色配置（房主可选）
    this.customRoleConfig = null;

    // 创建时间戳
    this._createdAt = Date.now();

    // 添加房主为第一个玩家
    this.addPlayer(hostId, hostName);
  }

  // ==================== 玩家管理 ====================

  addPlayer(id, name) {
    if (this.players.length >= this.maxPlayers) return null;
    if (this.players.find(p => p.id === id)) return null;
    const player = new Player(id, name, null);
    this.players.push(player);
    return player;
  }

  removePlayer(id) {
    const idx = this.players.findIndex(p => p.id === id);
    if (idx >= 0) {
      this.players.splice(idx, 1);
      // 如果房主离开，转移房主
      if (id === this.hostId && this.players.length > 0) {
        this.hostId = this.players[0].id;
      }
    }
  }

  getPlayer(id) {
    return this.players.find(p => p.id === id);
  }

  // ==================== 角色分配 ====================

  assignRoles() {
    const count = this.players.length;
    // 使用自定义角色配置覆盖默认配置
    const config = this.customRoleConfig && this.customRoleConfig.length === count
      ? [...this.customRoleConfig]
      : getRoleConfig(count);
    const shuffled = [...config];
    this.shuffleArray(shuffled);

    // 给每个村民编号以区分
    let villagerIdx = 1;
    this.players.forEach((player, i) => {
      player.role = shuffled[i];
      player.team = ROLE_TEAM[shuffled[i]];
      if (shuffled[i] === ROLES.VILLAGER) {
        player.villagerIndex = villagerIdx++;
      }
      // 初始化猎人：第二晚才能行动，携带全部武器
      if (shuffled[i] === ROLES.HUNTER) {
        player.canAct = false;
        player.hasRifle = true;
        player.hasBlunderbuss = true;
        player.rifleUsable = true;
        player.blunderbussUsable = true;
      }
      // 药巫有两瓶药
      if (shuffled[i] === ROLES.HEAL_WITCH) {
        player.hasPotion = true;
        player.hasPoison = true;
      }
      if (shuffled[i] === ROLES.POISON_WITCH) {
        player.hasPotion = true;
        player.hasPoison = true;
      }
    });

    // 不告知狼人彼此身份
  }

  // ==================== 计时器管理 ====================

  _clearPhaseTimeout() {
    if (this._phaseTimeout) {
      clearTimeout(this._phaseTimeout);
      this._phaseTimeout = null;
    }
    this.timeLeft = 0;
  }

  _startNightStepTimer() {
    this._clearPhaseTimeout();
    this.timeLeft = this.NIGHT_STEP_TIMEOUT / 1000;
    this._phaseTimeout = setTimeout(() => {
      if (this.phase !== PHASES.NIGHT) return;
      // 自动跳过当前步骤（未操作的玩家默认睡觉）
      for (const p of this.players) {
        if (p.alive && p.nightAction === null) {
          p.nightAction = 'SLEEP';
        }
      }
      this.advanceNightStep();
    }, this.NIGHT_STEP_TIMEOUT);
  }

  _startDayTimer() {
    this._clearPhaseTimeout();
    this.timeLeft = this.DAY_TIMEOUT / 1000;
    this._phaseTimeout = setTimeout(() => {
      if (this.phase === PHASES.DAY) {
        this.enterVote();
      }
    }, this.DAY_TIMEOUT);
  }

  _startVoteTimer() {
    this._clearPhaseTimeout();
    this.timeLeft = this.VOTE_TIMEOUT / 1000;
    this._phaseTimeout = setTimeout(() => {
      if (this.phase === PHASES.VOTE) {
        // 超时未投票的玩家计为弃权
        for (const p of this.players) {
          if (p.alive && this.votes[p.id] === undefined) {
            this.votes[p.id] = null;
          }
        }
        this.resolveVotes();
      }
    }, this.VOTE_TIMEOUT);
  }

  // ==================== 阶段转换 ====================

  startGame() {
    if (this.players.length < this.minPlayers) return false;
    this.assignRoles();
    this.round = 1;
    this.enterNight();
    return true;
  }

  enterNight() {
    this.phase = PHASES.NIGHT;
    this.votes = {};
    this.voteResults = null;
    this.nightLog = [];
    this.privateLogs = {};

    // 重置所有玩家当晚状态
    for (const p of this.players) {
      if (p.alive) p.resetNightState();
    }

    // 获取夜晚步骤列表
    const steps = this.getNightSteps();
    this.nightStepIndex = 0;
    this.nightStep = steps[0];

    this.broadcastPhaseChange();
    this._startNightStepTimer();
  }

  getNightSteps() {
    return this.round === 1 ? NIGHT_STEPS_NIGHT1 : NIGHT_STEPS_FULL;
  }

  // 进入下一个夜晚子步骤（带竞态保护）
  async advanceNightStep() {
    if (this._advancingNightStep) return;
    this._advancingNightStep = true;
    try {
      const steps = this.getNightSteps();
      this.nightStepIndex++;

      if (this.nightStepIndex >= steps.length) {
        // 夜晚结束，结算（await 确保结算完成前不会被重复调用）
        await this.resolveNight();
      } else {
        this.nightStep = steps[this.nightStepIndex];
        this.broadcastNightStepChange();
      }
    } finally {
      this._advancingNightStep = false;
    }
  }

  async resolveNight() {
    const resolver = new NightResolver(this);
    const result = await resolver.resolve();
    this.nightLog = result.log;

    // 分发私密日志
    for (const entry of result.privateLog) {
      if (entry.player) {
        if (!this.privateLogs[entry.player]) this.privateLogs[entry.player] = [];
        this.privateLogs[entry.player].push(entry);
      }
      // 狼人相认日志分发给相关狼人
      if (entry.type === 'wolves_united' && entry.wolves) {
        for (const wid of entry.wolves) {
          if (!this.privateLogs[wid]) this.privateLogs[wid] = [];
          this.privateLogs[wid].push(entry);
        }
      }
    }

    // 检查猎人第二晚起可以行动
    if (this.round >= 2) {
      const hunter = this.players.find(p => p.role === ROLES.HUNTER && p.alive);
      if (hunter) hunter.canAct = true;
    }

    // 进入白天
    if (this.phase !== PHASES.GAME_OVER) {
      this.enterDay();
    }
  }

  enterDay() {
    this.phase = PHASES.DAY;
    this.hunterDayShoot = null;
    this._clearPhaseTimeout();
    this.broadcastPhaseChange();
    this._startDayTimer();
  }

  enterVote() {
    this.phase = PHASES.VOTE;
    this.votes = {};
    this._clearPhaseTimeout();
    this.broadcastPhaseChange();
    this._startVoteTimer();
  }

  // ==================== 玩家行动提交 ====================

  submitNightAction(playerId, action, target, ability) {
    const player = this.getPlayer(playerId);
    if (!player || !player.alive) return false;

    player.nightAction = action;
    player.nightTarget = target || null;
    player.nightAbility = ability || null;

    // 如果睡觉，待在家里
    if (action === NIGHT_ACTIONS.SLEEP) {
      player.atHome = true;
      player.currentHouse = player.id;
      player.goingTo = null;
    }

    return true;
  }

  // ==================== 投票 ====================

  submitVote(voterId, targetId) {
    if (this.phase !== PHASES.VOTE) return false;
    const voter = this.getPlayer(voterId);
    if (!voter || !voter.alive) return false;
    // 弃权票：targetId 为 null 或等于自己
    if (!targetId || targetId === voterId) {
      this.votes[voterId] = null;
      return true;
    }
    const target = this.getPlayer(targetId);
    if (!target || !target.alive) return false;
    this.votes[voterId] = targetId;
    return true;
  }

  resolveVotes() {
    if (this._resolvingVotes) return; // 防止重复调用
    this._resolvingVotes = true;
    this._clearPhaseTimeout();
    try {
    const alivePlayers = this.players.filter(p => p.alive);
    const tally = {};
    let maxVotes = 0;
    let eliminated = null;

    for (const p of alivePlayers) {
      tally[p.id] = 0;
    }
    tally['ABSTAIN'] = 0;

    for (const [voterId, targetId] of Object.entries(this.votes)) {
      if (targetId && tally[targetId] !== undefined) {
        tally[targetId]++;
        if (tally[targetId] > maxVotes) {
          maxVotes = tally[targetId];
          eliminated = targetId;
        }
      } else {
        tally['ABSTAIN']++;
      }
    }

    // 检查平票
    const topCandidates = Object.entries(tally)
      .filter(([id, count]) => id !== 'ABSTAIN' && count === maxVotes)
      .map(([id]) => id);

    if (topCandidates.length === 1 && maxVotes > 0) {
      const target = this.getPlayer(eliminated);
      if (target) {
        target.alive = false;
        this.voteResults = { eliminated: eliminated, votes: tally, tie: false };
      }
    } else {
      this.voteResults = { eliminated: null, votes: tally, tie: true };
    }

    this.broadcastVoteResults();

    // 检查胜利条件
    this.checkWinCondition();

    if (this.phase !== PHASES.GAME_OVER) {
      this.round++;
      this.enterNight();
    }
    } finally {
      this._resolvingVotes = false;
    }
  }

  // ==================== 猎人白天开枪 ====================

  hunterDayShootTarget(targetId) {
    const hunter = this.players.find(p => p.role === ROLES.HUNTER && p.alive);
    if (!hunter || !hunter.hasRifle || !hunter.rifleUsable) return false;

    const target = this.getPlayer(targetId);
    if (!target || !target.alive) return false;

    target.alive = false;
    hunter.hasRifle = false;
    hunter.rifleUsable = false;
    this.hunterDayShoot = targetId;
    // 记录到 dayLog（不会在夜晚被清除）
    this.dayLog.push({ type: 'hunter_day_shoot', player: hunter.id, target: targetId, msg: `猎人开枪击杀了 ${target.name}` });

    this.checkWinCondition();
    return true;
  }

  // ==================== 胜利条件 ====================

  checkWinCondition() {
    const aliveWolves = this.players.filter(p =>
      p.alive && (p.role === ROLES.WEREWOLF ||
        (p.role === ROLES.ALPHA_WOLF && (p.isTransformed || p.hasUsedInfect)))
    );
    // 未变身/未感染种狼算作村方
    const aliveVillage = this.players.filter(p =>
      p.alive && (p.team === TEAMS.VILLAGE ||
        (p.role === ROLES.ALPHA_WOLF && !p.isTransformed && !p.hasUsedInfect))
    );

    if (aliveWolves.length === 0) {
      this.endGame(TEAMS.VILLAGE, '所有狼人已出局');
    } else if (aliveWolves.length >= aliveVillage.length) {
      this.endGame(TEAMS.WOLF, '狼人数量不少于好人，狼人获胜');
    }
  }

  endGame(winnerTeam, reason) {
    this.phase = PHASES.GAME_OVER;
    this.gameResult = { winner: winnerTeam, reason };
    this._clearPhaseTimeout();
    this.broadcastGameOver();
    // 5 分钟后自动清理房间
    this._gameManager?.scheduleGameCleanup(this.id);
  }

  setGameManager(manager) {
    this._gameManager = manager;
  }

  // ==================== 广播方法 ====================

  broadcastPhaseChange() {
    this.broadcast('game:phaseChange', {
      phase: this.phase,
      round: this.round,
      nightStep: this.nightStep,
      timeLeft: this.timeLeft,
    });
    this.broadcast('game:state', this.getPublicState());
  }

  broadcastNightStepChange() {
    this.broadcast('game:nightStep', {
      nightStep: this.nightStep,
      nightStepIndex: this.nightStepIndex,
    });
    this._startNightStepTimer();
  }

  broadcastVoteResults() {
    this.broadcast('game:voteResults', this.voteResults);
  }

  broadcastGameOver() {
    this.broadcast('game:over', {
      winner: this.gameResult.winner,
      reason: this.gameResult.reason,
      players: this.players.map(p => ({
        id: p.id, name: p.name, role: p.role, alive: p.alive,
      })),
    });
  }

  // 需要 io 实例来广播
  broadcast(event, data) {
    if (this._io) {
      this._io.to(this.id).emit(event, data);
    }
  }

  setIO(io) {
    this._io = io;
  }

  // ==================== 状态获取 ====================

  getPublicState() {
    return {
      id: this.id,
      hostId: this.hostId,
      phase: this.phase,
      round: this.round,
      nightStep: this.nightStep,
      isPrivate: this.isPrivate,
      maxPlayers: this.maxPlayers,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        alive: p.alive,
        // 公开状态不发送 role — 由 getPrivateState 按权限决定可见性
        role: !p.alive ? p.role : undefined,  // 只有死亡角色公开身份
        heavyInjury: p.heavyInjury,            // 重伤状态可见（所有人都能看到）
        isGuarding: p.isGuarding,              // 守护姿态可见
        villagerIndex: p.villagerIndex,
      })),
      votes: this.phase === PHASES.VOTE ? this.votes : {},
      voteResults: this.voteResults,
      nightLog: this.nightLog,
      dayLog: this.dayLog,
      hunterDayShoot: this.hunterDayShoot,
    };
  }

  getPrivateState(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return null;
    return {
      ...this.getPublicState(),
      myRole: player.role,
      myTeam: player.team,
      myPrivateState: player.toPrivateJSON(),
      privateLog: this.privateLogs[playerId] || [],
      // 只返回该玩家应看到的信息
      players: this.players.map(p => {
        const base = {
          id: p.id,
          name: p.name,
          alive: p.alive,
          heavyInjury: p.heavyInjury,
          isGuarding: p.isGuarding,
        };
        // 自己的信息
        if (p.id === playerId) {
          base.role = p.role;
          return base;
        }
        // 狼人相认后可以看到彼此的role
        if (player.knownWolves?.includes(p.id)) {
          base.role = p.role;
        }
        // 只有死亡后才公开role
        if (!p.alive) {
          base.role = p.role;
        }
        return base;
      }),
    };
  }

  getLobbyState() {
    return {
      id: this.id,
      hostId: this.hostId,
      phase: this.phase,
      isPrivate: this.isPrivate,
      hasPassword: !!this.password,
      maxPlayers: this.maxPlayers,
      customRoleConfig: this.customRoleConfig,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        alive: p.alive,
      })),
    };
  }

  // 获取用于大厅列表的摘要信息
  getLobbySummary() {
    return {
      id: this.id,
      hostId: this.hostId,
      hostName: this.players[0]?.name || '未知',
      phase: this.phase,
      isPrivate: this.isPrivate,
      hasPassword: !!this.password,
      playerCount: this.players.length,
      maxPlayers: this.maxPlayers,
      createdAt: this._createdAt || Date.now(),
    };
  }

  // 获取某玩家所在屋子的访客数量
  getHouseVisitorCount(houseId, requestingPlayerId) {
    const visitors = this.players.filter(p => {
      if (!p.alive || p.id === houseId) return false;
      return (p.currentHouse || p.id) === houseId;
    });
    const count = visitors.length;
    // 如果是村民因人多被赶回家，只告诉"很多人"
    const requestor = this.getPlayer(requestingPlayerId);
    if (requestor && requestor.role === 'VILLAGER' && count >= 3) {
      return { count: -1, desc: '很多人（≥3人）' }; // -1表示很多人
    }
    return { count, desc: `${count}人` };
  }

  // ==================== 工具方法 ====================

  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  log(msg) {
    this.nightLog.push({ type: 'info', msg });
  }
}
