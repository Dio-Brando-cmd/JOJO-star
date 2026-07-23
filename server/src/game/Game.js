// ============================================================
// 游戏实例 —— 管理单局游戏的全部状态和逻辑
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { Player } from './Player.js';
import { NightResolver } from './NightResolver.js';
import { BotManager } from './BotManager.js';
import { TraitSystem } from './TraitSystem.js';
import { StoryManager } from './StoryManager.js';
import { Character } from './Character.js';
import { matchCharacterToRole } from './Character.js';
import { PositionSync } from './PositionSync.js';
import {
  ROLES, ROLE_NAMES, TEAMS, ROLE_TEAM,
  PHASES, NIGHT_STEPS, NIGHT_STEPS_NIGHT1, NIGHT_STEPS_FULL,
  NIGHT_ACTIONS,
  getRoleConfig, getWeaverName, CHARACTER_IDENTITIES,
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
    this.minPlayers = 2;

    // 房间隐私设置
    this.isPrivate = false;
    this.password = null;           // null = 无密码

    // 投票
    this.votes = {};                 // { voterId: targetId }
    this.voteResults = null;

    // 夜晚结算
    this.nightLog = [];
    this.privateLogs = {};           // { playerId: [log entries] }

    // 日间追猎者射击
    this.hunterDayShoot = null;
    this.dayLog = [];              // 白天日志（不会在夜晚被清除）

    // 计时器（防止玩家卡死）
    this.timer = null;
    this.timeLeft = 0;
    this._phaseTimeout = null;   // 阶段超时句柄
    this.NIGHT_STEP_TIMEOUT = 20000;  // 20s 每步骤（优化结算速度）
    this.DAY_TIMEOUT = 60000;         // 60s 讨论
    this.VOTE_TIMEOUT = 40000;        // 40s 投票
    this.DISCUSSION_PER_SPEAKER = 30; // 每人30秒发言

    // 讨论阶段状态
    this.discussionOrder = [];        // 发言顺序 (playerIds)
    this.currentSpeakerIndex = 0;
    this.currentSpeakerId = null;
    this.discussionTimeLeft = 0;

    // 人机管理
    this.botManager = new BotManager(this);
    this.enableBots = true;           // 默认开启人机
    this.minBots = 6;                 // 自动补足至6人
    this.botCount = 0;                // 房主指定人机数量（0=自动补足至minBots）
    this._botIdCounter = 0;

    // 自定义角色配置（房主可选）
    this.customRoleConfig = null;

    // ---- v2.0: 表层身份选择 ----
    this.traitSystem = new TraitSystem(this);
    this.storyManager = new StoryManager(this);
    this.characterSelections = {};
    this.availableCharacters = null;
    this.CHARACTER_SELECT_TIMEOUT = 30000;

    // ---- 3D模式: 位置同步 ----
    this.positionSync = new PositionSync(this);
    this._positionSyncInterval = null;

    // ---- 游戏模式 (2.11.0) ----
    this.gameMode = 'BOARD_GAME';      // BOARD_GAME | THIRD_PERSON

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
      if (shuffled[i] === ROLES.SPIRIT_WEAVER) {
        player.weaverIndex = villagerIdx++;
      }
      // 初始化猎人：第二晚才能行动，携带全部武器
      if (shuffled[i] === ROLES.FLAME_TRACKER) {
        player.canAct = false;
        player.hasRifle = true;
        player.hasBlunderbuss = true;
        player.rifleUsable = true;
        player.blunderbussUsable = true;
      }
      // 药巫有两瓶药
      if (shuffled[i] === ROLES.SPIRIT_MENDER) {
        player.hasHealTalisman = true;
        player.hasSealTalisman = true;
      }
      if (shuffled[i] === ROLES.HERBAL_SAGE) {
        player.hasHealTalisman = true;
        player.hasSealTalisman = true;
      }
    });

    // 不告知蚀者彼此身份
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
    // RESOLUTION 步骤不需要等待，直接推进结算
    if (this.nightStep === NIGHT_STEPS.RESOLUTION) {
      this._phaseTimeout = setTimeout(() => {
        if (this.phase !== PHASES.NIGHT) return;
        this.advanceNightStep();
      }, 500); // 短暂延迟让客户端渲染
      return;
    }
    // 检查当前步骤是否有存活且符合条件的玩家
    const playersForStep = this._getPlayersForStep(this.nightStep);
    if (playersForStep.length === 0) {
      // 当前角色全部出局 → 随机 3-7 秒模拟决策延迟后自动推进
      const delay = 3000 + Math.floor(Math.random() * 4001);
      this.timeLeft = Math.round(delay / 1000);
      console.log(`[游戏] ${this.id} 步骤 ${this.nightStep} 无存活角色，${this.timeLeft}s 后自动推进`);
      this._phaseTimeout = setTimeout(() => {
        if (this.phase !== PHASES.NIGHT) return;
        this.advanceNightStep();
      }, delay);
    } else {
      this.timeLeft = this.NIGHT_STEP_TIMEOUT / 1000;
      // 人机自动行动
      this.botManager.autoActForStep(this.nightStep);
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
  }

  // 获取当前夜晚步骤的存活参与者
  _getPlayersForStep(step) {
    const alive = this.players.filter(p => p.alive && !p.disconnected);
    switch (step) {
      case NIGHT_STEPS.FLAME_TRACKER:
        return alive.filter(p => p.role === ROLES.FLAME_TRACKER && p.canAct);
      case NIGHT_STEPS.NETHER_MONK:
        return alive.filter(p => p.role === ROLES.NETHER_MONK);
      case NIGHT_STEPS.VEIL_GUARDIAN:
        return alive.filter(p => p.role === ROLES.VEIL_GUARDIAN);
      case NIGHT_STEPS.CORRUPTED:
        return alive.filter(p => p.role === ROLES.CORRUPTED ||
          (p.role === ROLES.NETHER_MONK && (p.isTransformed || p.hasUsedInfect)));
      case NIGHT_STEPS.VEIL_SCHOLAR:
        return alive.filter(p => p.role === ROLES.VEIL_SCHOLAR);
      case NIGHT_STEPS.HERBAL_SAGE:
        return alive.filter(p => p.role === ROLES.HERBAL_SAGE);
      case NIGHT_STEPS.SPIRIT_MENDER:
        return alive.filter(p => p.role === ROLES.SPIRIT_MENDER);
      case NIGHT_STEPS.SPIRIT_WEAVER:
        return alive.filter(p => p.role === ROLES.SPIRIT_WEAVER);
      default:
        return [];
    }
  }

  _startDayTimer() {
    this._clearPhaseTimeout();
    this.timeLeft = this.DAY_TIMEOUT / 1000;
    this._phaseTimeout = setTimeout(() => {
      if (this.phase === PHASES.DAY) {
        this.enterDiscussion(); // 讨论阶段在投票之前
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

  // ---- v2.0: 开始游戏 → 先选表层身份 ----
  startGame() {
    if (this.enableBots) {
      this._autoFillBots();
    }
    if (this.players.length < this.minPlayers) return false;

    // 准备可用的表层身份池（数量=玩家数，随机抽取）
    const allChars = Object.keys(CHARACTER_IDENTITIES);
    this.shuffleArray(allChars);
    this.availableCharacters = allChars.slice(0, this.players.length);
    this.characterSelections = {};

    // AI玩家自动随机选
    for (const p of this.players) {
      if (p.isBot) {
        const pick = this.availableCharacters[Math.floor(Math.random() * this.availableCharacters.length)];
        this.characterSelections[p.id] = pick;
        this._applyCharacterToPlayer(p, pick);
      }
    }

    // 进入选人阶段
    this.phase = PHASES.CHARACTER_SELECT;
    this._broadcastState();
    this._startCharacterSelectTimer();
    return true;
  }

  /** 玩家选择表层身份 */
  selectCharacter(playerId, characterId) {
    if (this.phase !== PHASES.CHARACTER_SELECT) return { success: false, error: '不在选人阶段' };
    if (!this.availableCharacters.includes(characterId)) {
      return { success: false, error: '该身份不可用' };
    }
    // 检查是否已被别人选走
    const taken = Object.values(this.characterSelections).includes(characterId);
    if (taken && this.characterSelections[playerId] !== characterId) {
      return { success: false, error: '该身份已被其他玩家选择' };
    }

    this.characterSelections[playerId] = characterId;
    const player = this.getPlayer(playerId);
    if (player) this._applyCharacterToPlayer(player, characterId);

    this._broadcastState();

    // 检查是否所有人都选完了
    const allSelected = this.players.every(p => this.characterSelections[p.id]);
    if (allSelected) {
      this._finalizeCharacterSelection();
    }
    return { success: true };
  }

  /** 将表层身份应用到玩家 */
  _applyCharacterToPlayer(player, characterId) {
    const charDef = CHARACTER_IDENTITIES[characterId];
    if (!charDef) return;
    player.characterId = characterId;
    player.characterTraits = charDef.externalTraits.map(t => ({
      ...t,
      active: true,
      usedThisRound: false,
    }));
  }

  /** 选人超时——未选者随机分配 */
  _startCharacterSelectTimer() {
    this._clearPhaseTimeout();
    this.timeLeft = Math.round(this.CHARACTER_SELECT_TIMEOUT / 1000);
    this._phaseTimeout = setTimeout(() => {
      if (this.phase !== PHASES.CHARACTER_SELECT) return;
      // 未选者随机分配剩余身份
      const taken = new Set(Object.values(this.characterSelections));
      const remaining = this.availableCharacters.filter(c => !taken.has(c));
      for (const p of this.players) {
        if (!this.characterSelections[p.id] && remaining.length > 0) {
          const pick = remaining.shift();
          this.characterSelections[p.id] = pick;
          this._applyCharacterToPlayer(p, pick);
        }
      }
      this._finalizeCharacterSelection();
    }, this.CHARACTER_SELECT_TIMEOUT);
  }

  /** 选人完成 → 根据表层身份分配隐藏职业 */
  _finalizeCharacterSelection() {
    this._clearPhaseTimeout();

    // 分配隐藏职业：基于表层身份的推荐职业，加入随机因素
    this._assignRolesByCharacter();

    // 告知玩家各自的隐藏身份（仅自己可见）
    if (this._io) {
      for (const p of this.players) {
        const privateState = this.getPrivateState(p.id);
        this._io.to(p.id).emit('game:privateState', privateState);
      }
    }

    // 进入序幕阶段
    this.phase = PHASES.PROLOGUE;
    if (this._io) {
      const prologue = this.storyManager.generatePrologue();
      this._io.to(this.id).emit('game:prologue', prologue);
    }
    this._broadcastState();

    // 启动位置同步广播
    this._startPositionSync();

    // 序幕后进入游戏
    setTimeout(() => {
      this.round = 1;
      this.enterNight();
      if (this._io) {
        this._io.to(this.id).emit('game:started', { round: this.round });
      }
    }, 8000);
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

  /** v2.12: 角色选择影响职业 — 优先匹配recommendedHiddenRoles，保留随机性 */
  _assignRolesByCharacter() {
    const count = this.players.length;
    const config = this.customRoleConfig && this.customRoleConfig.length === count
      ? [...this.customRoleConfig]
      : getRoleConfig(count);

    const roles = [...config];
    const players = [...this.players];
    const assignments = [];
    const usedRoles = new Set();

    // Pass 1: 优先匹配 — 为每个角色找推荐该角色的玩家
    const roleList = [...roles];
    this.shuffleArray(roleList);
    for (const role of roleList) {
      if (usedRoles.has(role)) continue;
      // 找推荐此角色的未分配玩家
      const candidates = players.filter(p =>
        !assignments.some(a => a.player === p) &&
        CHARACTER_IDENTITIES[p.characterId]?.recommendedHiddenRoles?.includes(role)
      );
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        assignments.push({ player: pick, role });
        usedRoles.add(role);
      }
    }

    // Pass 2: 剩余角色随机分配给剩余玩家
    const remainingRoles = roles.filter(r => !usedRoles.has(r));
    const remainingPlayers = players.filter(p => !assignments.some(a => a.player === p));
    this.shuffleArray(remainingRoles);

    for (let i = 0; i < remainingPlayers.length; i++) {
      assignments.push({ player: remainingPlayers[i], role: remainingRoles[i] || remainingRoles[0] });
    }

    // 应用分配
    let villagerIdx = 1;
    for (const { player, role } of assignments) {
      player.role = role;
      player.team = ROLE_TEAM[role];

      if (role === ROLES.SPIRIT_WEAVER) {
        player.weaverIndex = villagerIdx;
        const nameData = getWeaverName(villagerIdx);
        player.weaverName = nameData.name;
        player.weaverTitle = nameData.title;
        player.weaverType = nameData.weaverType;
        villagerIdx++;
      }

      if (role === ROLES.FLAME_TRACKER) {
        player.canAct = false; player.hasRifle = true; player.hasBlunderbuss = true;
        player.rifleUsable = true; player.blunderbussUsable = true;
      }
      if (role === ROLES.SPIRIT_MENDER || role === ROLES.HERBAL_SAGE) {
        player.hasHealTalisman = true; player.hasSealTalisman = true;
      }

      this.storyManager.recordNarrativeEvent(player.id, 'role_assigned', {
        characterId: player.characterId, role,
      });
    }
  }

  // 自动补足人机
  _autoFillBots() {
    // 房主指定了具体数量则用指定数量，否则自动补足至 minBots
    const target = this.botCount > 0 ? this.botCount : Math.max(0, this.minBots - this.players.length);
    const need = Math.max(0, target);
    for (let i = 0; i < need; i++) {
      this._botIdCounter++;
      const botName = `人机${this._botIdCounter}`;
      const botId = `bot_${this.id}_${this._botIdCounter}`;
      const bot = new Player(botId, botName, null);
      bot.isBot = true;
      this.players.push(bot);
    }
  }

  // 移除所有人机
  _removeBots() {
    this.botManager.cleanup();
    this.players = this.players.filter(p => !p.isBot);
    this._botIdCounter = 0;
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

    if (this.gameMode === 'THIRD_PERSON') {
      this._enter3DNight();
    } else {
      this._enterBoardGameNight();
    }
  }

  /** 桌游模式: 回合制夜晚步骤 */
  _enterBoardGameNight() {
    const steps = this.getNightSteps();
    this.nightStepIndex = 0;
    this.nightStep = steps[0];

    this.broadcastPhaseChange();
    this._startNightStepTimer();
  }

  /** 3D追逃模式: 自由移动夜晚 */
  _enter3DNight() {
    this.nightStep = 'FREE_ROAM';
    this._clearPhaseTimeout();

    // 设置120秒夜晚自由时间
    this.timeLeft = 120;
    this.broadcastPhaseChange();

    if (this._io) {
      this._io.to(this.id).emit('game:3dNightStart', {
        timeLeft: this.timeLeft,
        nightStep: 'FREE_ROAM',
        players: this.players.filter(p => p.alive).map(p => p.toJSON()),
      });
    }

    // 120秒后强制天亮
    this._phaseTimeout = setTimeout(() => {
      if (this.phase !== PHASES.NIGHT) return;
      this._end3DNight();
    }, 120000);

    // 人机AI在3D模式下随机移动
    for (const bot of this.getAliveBots?.() || []) {
      if (bot.isWolf()) {
        bot._3dAction = 'HUNT'; // AI蚀者自动噬灵
      } else {
        bot._3dAction = Math.random() < 0.4 ? 'HIDE' : 'ROAM';
      }
    }
  }

  /** 3D模式夜晚结束 → 结算 */
  _end3DNight() {
    this._clearPhaseTimeout();
    if (this.phase !== PHASES.NIGHT) return;

    // 统计3D模式的击杀
    const kills = [];
    for (const p of this.players) {
      if (!p.alive && p._killedBy) {
        kills.push({ victim: p.id, killer: p._killedBy });
      }
    }

    // 用NightResolver做标准结算
    const resolver = new NightResolver(this);
    resolver.resolve().then(() => {
      this.nightLog = resolver.log;
      this.privateLogs = resolver.privateLogs;

      if (this.phase !== PHASES.GAME_OVER) {
        this.enterDay();
      }
    });
  }

  /** 3D模式: 蚀者噬灵目标 */
  submit3DAttack(wolfId, targetId) {
    if (this.phase !== PHASES.NIGHT || this.gameMode !== 'THIRD_PERSON') return null;

    const wolf = this.getPlayer(wolfId);
    const target = this.getPlayer(targetId);
    if (!wolf || !target || !wolf.alive || !target.alive) return null;
    if (!wolf.isWolf()) return null; // 只有狼人能攻击

    // 检查是否在攻击冷却中
    const now = Date.now();
    if (wolf._lastAttackTime && now - wolf._lastAttackTime < 8000) {
      return { success: false, reason: 'COOLDOWN' };
    }

    wolf._lastAttackTime = now;

    // 检查目标是否有短铳反击
    if (target.role === 'FLAME_TRACKER' && target.blunderbussUsable) {
      wolf.alive = false;
      wolf._killedBy = targetId;
      target.blunderbussUsable = false;
      return { success: true, result: 'COUNTERED', victim: wolfId, killer: targetId };
    }

    // 检查逃脱: 30%基础 + 特质加成
    let escapeChance = 0.30;
    if (target.characterId === 'ORIC') escapeChance += 0.15;
    if (target.characterId === 'SKADI') escapeChance += 0.10;
    if (target.isHidden) escapeChance += 0.25;

    if (Math.random() < escapeChance) {
      return { success: true, result: 'ESCAPED', target: targetId };
    }

    // 击杀
    target.alive = false;
    target._killedBy = wolfId;
    return { success: true, result: 'KILLED', victim: targetId, killer: wolfId };
  }

  /** 3D模式: 玩家尝试藏匿 */
  submit3DHide(playerId, hideSpotId) {
    if (this.phase !== PHASES.NIGHT || this.gameMode !== 'THIRD_PERSON') return false;
    const player = this.getPlayer(playerId);
    if (!player || !player.alive) return false;
    player.isHidden = true;
    player._hideSpot = hideSpotId;
    return true;
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
    this._clearPhaseTimeout(); // 清除夜晚步骤计时器
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
      const hunter = this.players.find(p => p.role === ROLES.FLAME_TRACKER && p.alive);
      if (hunter) hunter.canAct = true;
    }

    // 推送每个玩家的私有状态（确保察灵家等角色看到夜间反馈）
    for (const player of this.players) {
      if (player.alive) {
        const privateState = this.getPrivateState(player.id);
        if (privateState && this._io) {
          this._io.to(player.id).emit('game:privateState', privateState);
        }
      }
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
    // 人机自动投票（延迟1-3秒模拟思考）
    const bots = this.players.filter(p => p.alive && p.isBot);
    for (const bot of bots) {
      const delay = 1000 + Math.floor(Math.random() * 3000);
      setTimeout(() => {
        if (this.phase === PHASES.VOTE) {
          this.botManager.submitBotVote(bot);
          if (this._io) this._io.to(this.id).emit('game:state', this.getPublicState());
        }
      }, delay);
    }
    this._startVoteTimer();
  }

  // ==================== 讨论阶段（投票后轮流发言） ====================

  enterDiscussion() {
    // 按存活玩家顺序排列发言顺序
    this.discussionOrder = this.players.filter(p => p.alive && !p.disconnected).map(p => p.id);
    this.currentSpeakerIndex = 0;
    this.currentSpeakerId = this.discussionOrder[0] || null;
    this.phase = PHASES.DISCUSSION;
    this._clearPhaseTimeout();
    this.broadcastPhaseChange();
    if (this.currentSpeakerId) {
      this._startDiscussionSpeakerTimer();
    } else {
      this._endDiscussion();
    }
  }

  _startDiscussionSpeakerTimer() {
    this._clearPhaseTimeout();
    this.discussionTimeLeft = this.DISCUSSION_PER_SPEAKER;
    // 人机发言者自动跳过
    const speaker = this.getPlayer(this.currentSpeakerId);
    if (speaker?.isBot) {
      this.botManager.skipBotDiscussion(speaker);
      return;
    }
    this._phaseTimeout = setTimeout(() => {
      this._nextDiscussionSpeaker();
    }, this.DISCUSSION_PER_SPEAKER * 1000);
    this.broadcast('game:state', this.getPublicState());
  }

  _nextDiscussionSpeaker() {
    this.currentSpeakerIndex++;
    if (this.currentSpeakerIndex >= this.discussionOrder.length) {
      this._endDiscussion();
      return;
    }
    this.currentSpeakerId = this.discussionOrder[this.currentSpeakerIndex];
    this._startDiscussionSpeakerTimer();
    this.broadcast('discussion:nextSpeaker', {
      speakerId: this.currentSpeakerId,
      speakerIndex: this.currentSpeakerIndex,
      totalSpeakers: this.discussionOrder.length,
    });
    this.broadcast('game:state', this.getPublicState());
  }

  skipDiscussionSpeaker(playerId) {
    if (this.phase !== PHASES.DISCUSSION) return;
    if (playerId !== this.currentSpeakerId) return; // 只有当前发言人可跳过自己
    this._clearPhaseTimeout();
    this._nextDiscussionSpeaker();
  }

  _endDiscussion() {
    this._clearPhaseTimeout();
    this.currentSpeakerId = null;
    this.discussionOrder = [];
    // 讨论结束后进入投票阶段
    this.enterVote();
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

    // 投票生效门槛：需要 >50% 存活玩家参与投票，且最高票 > 1（防止单人票秒杀）
    const totalVotes = Object.values(tally).reduce((a, b) => a + b, 0);
    const minRequired = Math.ceil(alivePlayers.length / 2);

    if (topCandidates.length === 1 && maxVotes > 0 && maxVotes >= minRequired) {
      const target = this.getPlayer(eliminated);
      if (target) {
        target.alive = false;
        this.voteResults = { eliminated: eliminated, votes: tally, tie: false, totalVotes };
      }
    } else if (topCandidates.length === 1 && maxVotes > 0 && maxVotes < minRequired) {
      // 票数不足，无人出局
      this.voteResults = { eliminated: null, votes: tally, tie: false, totalVotes, reason: '票数不足半数，无人出局' };
    } else {
      this.voteResults = { eliminated: null, votes: tally, tie: true, totalVotes };
    }

    // 先发送投票结果状态（保持 VOTE 阶段 + 投票结果）
    this.broadcast('game:state', this.getPublicState());

    // 短暂延迟让客户端先渲染投票结果，再进入下一夜
    setTimeout(() => {
      // 检查胜利条件
      this.checkWinCondition();

      if (this.phase !== PHASES.GAME_OVER) {
        this.round++;
        this.enterNight();
      }
    }, 2000);
    } finally {
      this._resolvingVotes = false;
    }
  }

  // ==================== 猎人白天开枪 ====================

  hunterDayShootTarget(targetId) {
    // P0修复: 只能在DAY阶段开枪 + 猎人必须在世 + 未开过枪
    if (this.phase !== PHASES.DAY) return false;
    if (this.hunterDayShoot) return false; // 已开过枪
    const hunter = this.players.find(p => p.role === ROLES.FLAME_TRACKER && p.alive);
    if (!hunter || !hunter.hasRifle || !hunter.rifleUsable) return false;

    const target = this.getPlayer(targetId);
    if (!target || !target.alive) return false;

    target.alive = false;
    hunter.hasRifle = false;
    hunter.rifleUsable = false;
    this.hunterDayShoot = targetId;
    // 记录到 dayLog（不会在夜晚被清除）
    this.dayLog.push({ type: 'hunter_day_shoot', player: hunter.id, target: targetId, msg: `追猎者射击击杀了 ${target.name}` });

    this.checkWinCondition();
    return true;
  }

  // ==================== 胜利条件 ====================

  checkWinCondition() {
    const aliveWolves = this.players.filter(p =>
      p.alive && (p.role === ROLES.CORRUPTED ||
        (p.role === ROLES.NETHER_MONK && (p.isTransformed || p.hasUsedInfect)))
    );
    // 未变身/未感染种狼算作村方
    const aliveVillage = this.players.filter(p =>
      p.alive && (p.team === TEAMS.VEIL_KEEPERS ||
        (p.role === ROLES.NETHER_MONK && !p.isTransformed && !p.hasUsedInfect))
    );

    if (aliveWolves.length === 0) {
      this.endGame(TEAMS.VEIL_KEEPERS, '所有蚀者已出局');
    } else if (aliveWolves.length >= aliveVillage.length) {
      this.endGame(TEAMS.CORRUPTED, '蚀者数量不少于守幕者，蚀者获胜');
    }
  }

  endGame(winnerTeam, reason) {
    this.phase = PHASES.GAME_OVER;
    this.gameResult = { winner: winnerTeam, reason };
    this._clearPhaseTimeout();
    this.broadcastGameOver();

    // 保存游戏回放
    this._saveReplay(winnerTeam, reason);

    // v2.0: 服务端自动更新战绩（替代客户端触发的不可信上报）
    this._updatePlayerStats(winnerTeam);

    // 30 秒后自动返回大厅（保留房间）
    this._returnTimeout = setTimeout(() => {
      this.returnToLobby();
    }, 30000);
  }

  /** 服务端根据胜负自动更新每个玩家的战绩 */
  _updatePlayerStats(winnerTeam) {
    if (!this._gameManager?.userManager) return;
    for (const p of this.players) {
      if (p.isBot) continue;
      const won = p.team === winnerTeam;
      try {
        this._gameManager.userManager.updateStats(p.name || p.id, won);
      } catch (e) {
        console.error(`[统计] 更新 ${p.name || p.id} 失败:`, e.message);
      }
    }
  }

  // 保存回放数据
  _saveReplay(winnerTeam, reason) {
    try {
      const replayData = {
        roomId: this.id,
        winner: winnerTeam,
        reason,
        round: this.round,
        players: this.players.map(p => ({
          name: p.name,
          role: p.role,
          team: p.team,
          alive: p.alive,
        })),
        date: Date.now(),
      };
      // 通过 GameManager 访问 UserManager
      if (this._gameManager?.userManager) {
        this._gameManager.userManager.saveGameReplay(replayData);
      }
    } catch (e) {
      console.error('[回放] 保存失败:', e.message);
    }
  }

  // 返回大厅（保留房间，重置游戏状态）
  returnToLobby() {
    if (this._returnTimeout) {
      clearTimeout(this._returnTimeout);
      this._returnTimeout = null;
    }

    // 停止位置同步
    this._stopPositionSync();

    // 清理人机
    this._removeBots();

    // 重置所有玩家状态
    for (const p of this.players) {
      p.alive = true;
      p.role = null;
      p.team = null;
      p.disconnected = false;
      // 重置所有角色状态
      p.isTransformed = false;
      p.hasUsedInfect = false;
      p.hasKilled = false;
      p.infectedByAlpha = false;
      p.willBecomeWolf = false;
      p.guardingTarget = null;
      p.isGuarding = false;
      p.heavyInjury = false;
      p.whoKnowsGuardHeavyInjury = [];
      p.knownWolves = [];
      p.wolvesOpenEyesTogether = [];
      p.wolfKillTarget = null;
      p.hasRifle = false;
      p.hasBlunderbuss = false;
      p.rifleUsable = false;
      p.blunderbussUsable = false;
      p.observedTarget = null;
      p.observedTargetWentOut = false;
      p.canShootNextNight = null;
      p.hasHealTalisman = true;
      p.hasSealTalisman = true;
      p.talismanTarget = null;
      p.poisonTarget = null;
      p.checkTarget = null;
      p.checkResult = null;
      p.currentHouse = p.id;
      p.atHome = true;
      p.goingTo = null;
      p.nightAction = null;
      p.nightTarget = null;
      p.nightAbility = null;
    }

    // 重置游戏状态
    this.phase = PHASES.LOBBY;
    this.round = 0;
    this.votes = {};
    this.voteResults = null;
    this.nightLog = [];
    this.privateLogs = {};
    this.nightStep = null;
    this.nightStepIndex = 0;
    this.hunterDayShoot = null;
    this.dayLog = [];
    this.gameResult = null;
    this.customRoleConfig = null;

    this._clearPhaseTimeout();

    // 广播回大厅
    if (this._io) {
      this._io.to(this.id).emit('game:returnToLobby', { roomId: this.id });
      this._io.to(this.id).emit('game:state', this.getLobbyState());
    }

    // 推送大厅更新
    if (this._gameManager) {
      this._gameManager.broadcastLobbyUpdate();
    }

    console.log(`[房间] ${this.id} 返回大厅（保留房间）`);
  }

  // 取消返回大厅定时器
  cancelReturnToLobby() {
    if (this._returnTimeout) {
      clearTimeout(this._returnTimeout);
      this._returnTimeout = null;
    }
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
      discussionTimeLeft: this.discussionTimeLeft,
      currentSpeakerId: this.currentSpeakerId,
    });
    this.broadcast('game:state', this.getPublicState());
  }

  broadcastNightStepChange() {
    this.broadcast('game:nightStep', {
      nightStep: this.nightStep,
      nightStepIndex: this.nightStepIndex,
      timeLeft: this.timeLeft,
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
        id: p.id, name: p.name, role: p.role, team: p.team, alive: p.alive,
      })),
    });
  }

  // 需要 io 实例来广播
  broadcast(event, data) {
    if (this._io) {
      this._io.to(this.id).emit(event, data);
    }
  }

  _broadcastState() {
    if (this._io) {
      this._io.to(this.id).emit('game:state', this.getPublicState());
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
      gameMode: this.gameMode,
      round: this.round,
      nightStep: this.nightStep,
      isPrivate: this.isPrivate,
      maxPlayers: this.maxPlayers,
      // v2.0: 选人阶段信息
      characterSelect: this.phase === PHASES.CHARACTER_SELECT ? {
        availableCharacters: this.availableCharacters,
        selections: this.characterSelections,
        timeLeft: this.timeLeft,
      } : null,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        alive: p.alive,
        isBot: p.isBot,
        role: (this.phase === PHASES.GAME_OVER || !p.alive) ? p.role : undefined,
        team: this.phase === PHASES.GAME_OVER ? p.team : undefined,
        heavyInjury: p.heavyInjury,
        isGuarding: p.isGuarding,
        weaverIndex: p.weaverIndex,
        // v2.0: 表层身份（选人完成后公开）
        characterId: this.phase !== PHASES.LOBBY ? p.characterId : undefined,
      })),
      votes: this.phase === PHASES.VOTE ? this.votes : {},
      voteResults: this.voteResults,
      nightLog: this.nightLog,
      dayLog: this.dayLog,
      hunterDayShoot: this.hunterDayShoot,
      discussionOrder: this.phase === PHASES.DISCUSSION ? this.discussionOrder : [],
      currentSpeakerId: this.phase === PHASES.DISCUSSION ? this.currentSpeakerId : null,
      discussionTimeLeft: this.phase === PHASES.DISCUSSION ? this.discussionTimeLeft : 0,
    };
  }

  getPrivateState(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return null;

    // 从私密日志中提取帷幕学者察灵结果 { targetId: 'GOOD'|'WOLF' }
    const seerCheckResults = {};
    const myLogs = this.privateLogs[playerId] || [];
    for (const entry of myLogs) {
      if (entry.type === 'seer_check' && entry.target && entry.result) {
        seerCheckResults[entry.target] = entry.result;
      }
    }

    return {
      ...this.getPublicState(),
      myRole: player.role,
      myTeam: player.team,
      myPrivateState: player.toPrivateJSON(),
      privateLog: myLogs,
      seerCheckResults,  // { targetPlayerId: 'GOOD'|'WOLF' }
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
      minPlayers: this.minPlayers,
      customRoleConfig: this.customRoleConfig,
      enableBots: this.enableBots,
      botCount: this.botCount,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        alive: p.alive,
        isBot: p.isBot,
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
    if (requestor && requestor.role === 'SPIRIT_WEAVER' && count >= 3) {
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
