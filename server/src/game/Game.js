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

// ==================== 3D 灵焰仪式配置 (守幕者采集 5 处灵焰 → 广场引导) ====================

const SPIRIT_FLAME_SPOTS = [
  { id: 'well',     name: '水井',   x: -5,  z: -8  },
  { id: 'smith',    name: '铁匠铺', x: 10,  z: 5   },
  { id: 'tower',    name: '观测塔', x: 36,  z: -30 },
  { id: 'cemetery', name: '墓地',   x: 0,   z: 48  },
  { id: 'cottage',  name: '村舍',   x: -28, z: -16 },
];
const RITUAL_CENTER = { x: 0, z: 0 };   // 广场
const RITUAL_RADIUS = 5;                // 引导需站在广场半径内
const FLAME_COLLECT_RADIUS = 3;         // 采集判定半径
const RITUAL_CHANNEL_SECONDS = 12;      // 引导时长
const ATTACK_RANGE = 2.5;               // 蚀者噬灵近距判定 (服务端强制, 防远程/穿墙击杀)

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
    this.flameTrackerDayShoot = null;
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

    // 给每个灵织者编号以区分
    let weaverIdx = 1;
    this.players.forEach((player, i) => {
      player.role = shuffled[i];
      player.team = ROLE_TEAM[shuffled[i]];
      if (shuffled[i] === ROLES.SPIRIT_WEAVER) {
        player.weaverIndex = weaverIdx++;
      }
      // 初始化灵痕追猎者：第二晚才能行动，携带全部武器
      if (shuffled[i] === ROLES.FLAME_TRACKER) {
        player.canAct = false;
        player.hasRifle = true;
        player.hasBlunderbuss = true;
        player.rifleUsable = true;
        player.blunderbussUsable = true;
      }
      // 愈灵师有两瓶药
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
          (p.role === ROLES.NETHER_MONK && (p.isTransformed || p.hasUsedCorrupt)));
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

  // ---- v2.0: 开始游戏 → 房主配置的角色为所有玩家（含人机）统一随机分配 ----
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

    // 所有玩家（人类+人机）统一随机分配表层身份——房主选择的角色池覆盖所有人
    const shuffledChars = [...this.availableCharacters];
    this.shuffleArray(shuffledChars);
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      const pick = shuffledChars[i];
      this.characterSelections[p.id] = pick;
      this._applyCharacterToPlayer(p, pick);
    }

    // 跳过选人阶段，直接进入身份分配
    this._finalizeCharacterSelection();
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
    this._phaseTimeout = setTimeout(() => {
      if (this.phase !== PHASES.PROLOGUE) return; // 已返回大厅/阶段已变 → 不复活幽灵局
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
    let weaverIdx = 1;
    for (const { player, role } of assignments) {
      player.role = role;
      player.team = ROLE_TEAM[role];

      if (role === ROLES.SPIRIT_WEAVER) {
        player.weaverIndex = weaverIdx;
        const nameData = getWeaverName(weaverIdx);
        player.weaverName = nameData.name;
        player.weaverTitle = nameData.title;
        player.weaverType = nameData.weaverType;
        weaverIdx++;
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

  /**
   * 计算本局总座位数（人类玩家 + 人机）。
   * 需在补人机之前调用（此时 players 仅含人类玩家）。
   */
  getEffectivePlayerCount() {
    const human = this.players.length;
    if (!this.enableBots) return human;
    const botTarget = this.botCount > 0
      ? human + this.botCount
      : Math.max(human, this.minBots);
    return Math.min(botTarget, this.maxPlayers);
  }

  // 自动补足人机
  _autoFillBots() {
    const effective = this.getEffectivePlayerCount();
    const need = Math.max(0, effective - this.players.length);
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
    // 生成夜晚叙事（含"指引"低语）
    this.nightNarrative = this.storyManager.generateNightNarrative(this.round);

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

    // 灵焰仪式状态初始化 (守幕者采集 5 处灵焰 → 广场引导)
    this.spiritFlames = SPIRIT_FLAME_SPOTS.map(s => ({ ...s, collected: false }));
    this._ritual = null;
    this._clearRitualTimeout();

    // 设置120秒夜晚自由时间
    this.timeLeft = 120;
    this.broadcastPhaseChange();

    if (this._io) {
      this._io.to(this.id).emit('game:3dNightStart', {
        timeLeft: this.timeLeft,
        round: this.round,
        nightStep: 'FREE_ROAM',
        // 只广播阵营(蚀者/守幕者), 不暴露具体职业 — 否则蚀者会提前得知
        // 谁是唯一能短铳反杀的 FLAME_TRACKER, 毁掉反制玩法
        players: this.players.filter(p => p.alive).map(p => ({
          id: p.id,
          name: p.name,
          alive: p.alive,
          team: p.team,
          characterId: p.characterId,
        })),
      });
    }

    // 广播灵焰初始状态 (含地标坐标 + 采集数 + 仪式状态)
    this._broadcastFlames();

    // 120秒后强制天亮
    this._phaseTimeout = setTimeout(() => {
      if (this.phase !== PHASES.NIGHT) return;
      this._end3DNight();
    }, 120000);

    // 人机AI: 蚀者追猎 / 守幕者逃离 (自由移动夜)
    this._start3DBotAI();
  }

  /** 3D模式夜晚结束 → 判定胜负, 未分胜负则进入下一轮追逃夜 */
  _end3DNight() {
    this._clearPhaseTimeout();
    this._stop3DBotAI();
    this._clearRitualTimeout();
    this._ritual = null;
    if (this.phase !== PHASES.NIGHT) return;

    // 3D追逃没有 2D 桌游的白天/讨论/投票阶段: 直接判定胜负,
    // 未分胜负则进入下一轮追逃夜 (灵焰重置、死者保持出局), 形成多回合追逃。
    // 胜利判定走 _check3DWin (守幕者全灭→蚀者胜 / 蚀者全灭→守幕者胜),
    // 守幕者灵焰仪式胜利已在 start3DRitual 的引导计时里单独 endGame。
    this._check3DWin();
    if (this.phase === PHASES.GAME_OVER) return;

    this.round++;
    this.enterNight();
  }

  // ==================== 3D 人机AI (自由移动夜) ====================

  /** 启动人机AI: 初始化位置 + 250ms 一跳 */
  _start3DBotAI() {
    this._stop3DBotAI();
    const bots = this.players.filter(p => p.alive && p.isBot);
    if (bots.length === 0) return;

    // 初始化人机位置 (均匀分布在村庄内, 避免重叠)
    bots.forEach((bot, i) => {
      const angle = (i / bots.length) * Math.PI * 2 + i * 0.7;
      const radius = 12 + (i % 4) * 8;
      const x = Math.round(Math.cos(angle) * radius * 10) / 10;
      const z = Math.round(Math.sin(angle) * radius * 10) / 10;
      this.positionSync.updatePosition(bot.id, { x, y: 0, z, rotY: 0, isMoving: false, isSprinting: false });
    });

    this._3dBotInterval = setInterval(() => this._tick3DBots(), 250);
  }

  _stop3DBotAI() {
    if (this._3dBotInterval) {
      clearInterval(this._3dBotInterval);
      this._3dBotInterval = null;
    }
  }

  _tick3DBots() {
    if (this.phase !== PHASES.NIGHT || this.gameMode !== 'THIRD_PERSON') return;
    const bots = this.players.filter(p => p.alive && p.isBot);
    if (bots.length === 0) return;

    const alive = this.players.filter(p => p.alive);
    const keepers = alive.filter(p => !p.isCorrupted());
    // 一次 O(k²) 预计算孤立度, 避免在分配循环里对每个蚀者重复扫描 (O(c·k²) → O(k²+c·k))
    const isolation = new Map();
    for (const k of keepers) isolation.set(k.id, this._isolationScore(k, keepers));

    const targets = this._assign3DTargets(bots, keepers, isolation);   // 蚀者分摊目标 (优先引导者/孤立者)
    for (const bot of bots) {
      const move = this._compute3DBotMove(bot, alive, targets.get(bot.id));
      if (!move) continue;
      this.positionSync.updatePosition(bot.id, move);
      if (move.attackId) this.submit3DAttack(bot.id, move.attackId);
      if (move.collectFlameId) this.collect3DFlame(bot.id, move.collectFlameId);
      if (move.startRitual) this.start3DRitual(bot.id);
    }
  }

  /** 蚀者分摊目标: 每个蚀者追不同守幕者, 优先仪式引导者/孤立者 (贪心分配) */
  _assign3DTargets(corruptedBots, keepers, isolation) {
    const channellerId = this._ritual ? this._ritual.playerId : null;
    const map = new Map();
    const claimed = new Set();

    for (const bot of corruptedBots) {
      const bpos = this.positionSync.getPlayerPosition(bot.id) || { x: 0, z: 0 };
      let best = null, bestScore = Infinity;
      for (const k of keepers) {
        if (claimed.has(k.id)) continue;
        const kpos = this.positionSync.getPlayerPosition(k.id);
        if (!kpos) continue;                       // 真人未上报坐标 → 跳过
        let score = Math.hypot(kpos.x - bpos.x, kpos.z - bpos.z);
        if (k.id === channellerId) score -= 25;    // 引导者最高优先级
        if (k.isHidden) score += 8;                // 藏匿者次要
        score += isolation.get(k.id) || 0;         // 孤立者轻加权 (预计算)
        if (score < bestScore) { bestScore = score; best = k; }
      }
      if (best) { claimed.add(best.id); map.set(bot.id, best); }
    }
    return map;
  }

  /** 守幕者孤立度: 离最近同伴越远得分越低(越优先被追), 返回负值 */
  _isolationScore(keeper, keepers) {
    const kpos = this.positionSync.getPlayerPosition(keeper.id);
    if (!kpos) return 0;
    let nearest = Infinity;
    for (const o of keepers) {
      if (o.id === keeper.id) continue;
      const opos = this.positionSync.getPlayerPosition(o.id);
      if (!opos) continue;
      nearest = Math.min(nearest, Math.hypot(opos.x - kpos.x, opos.z - kpos.z));
    }
    return nearest === Infinity ? 0 : -nearest * 0.2;
  }

  /** 计算单个人的下一步移动 (蚀者追猎 / 守幕者逃离+藏匿+采集灵焰+引导仪式) */
  _compute3DBotMove(bot, alive, assignedTarget) {
    const pos = this.positionSync.getPlayerPosition(bot.id) || { x: 0, y: 0, z: 0, rotY: 0 };
    const now = Date.now();
    const DT = 0.25;                                       // tick 间隔 (秒)
    const SPEED = bot.isCorrupted() ? 4.5 : 4.0;           // 真人冲刺 6m/s, 人机稍慢便于逃脱
    const BOUND = 55;                                      // 地图边界
    const ATTACK_RANGE = 2.5;                              // 蚀者噬灵近距判定
    const FLEE_RADIUS = 14;                                // 守幕者感知猎手的距离
    const HIDE_RADIUS = 7;                                 // 猎手逼近时守幕者就地藏匿的距离
    const HIDE_COOLDOWN = 6000;                            // 藏匿冷却 (ms)

    let tx = pos.x, tz = pos.z;
    let attackId = null, collectFlameId = null, startRitual = false;

    if (bot.isCorrupted()) {
      // 蚀者: 追分摊到的目标 (优先引导者/孤立者), 贴脸噬灵
      let target = assignedTarget || null;
      if (!target) {
        const prey = alive.filter(p => !p.isCorrupted());
        const visiblePrey = prey.filter(p => !p.isHidden);
        const pool = visiblePrey.length > 0 ? visiblePrey : prey;
        const near = this._nearest3D(pool, pos);
        target = near ? near.p : null;
      }
      const tpos = target ? this.positionSync.getPlayerPosition(target.id) : null;
      if (tpos) {
        const d = Math.hypot(tpos.x - pos.x, tpos.z - pos.z);
        if (d <= ATTACK_RANGE) {
          if (!bot._lastAttackTime || now - bot._lastAttackTime >= 8000) attackId = target.id;
        } else {
          const step = Math.min(d, SPEED * DT);
          const wobble = (Math.random() - 0.5) * 0.7;
          const dx = (tpos.x - pos.x) / d;
          const dz = (tpos.z - pos.z) / d;
          tx = pos.x + dx * step - dz * wobble * step;
          tz = pos.z + dz * step + dx * wobble * step;
        }
      }
    } else {
      // 守幕者: 引导仪式 > 藏匿/逃离 > 采集灵焰 > 走向广场 > 游荡
      const hunters = alive.filter(p => p.isCorrupted());
      const hunter = this._nearest3D(hunters, pos);
      const hunterDist = hunter ? Math.hypot(hunter.pos.x - pos.x, hunter.pos.z - pos.z) : Infinity;
      const channelling = this._ritual && this._ritual.playerId === bot.id;

      if (channelling) {
        // 正在引导 → 原地不动 (死亡/走远由 start3DRitual 定时器裁决)
        tx = pos.x; tz = pos.z;
      } else if (bot.isHidden) {
        if (hunterDist > HIDE_RADIUS * 1.8) {
          bot.isHidden = false; bot._hideSpot = null; bot._lastHideTime = now;
        }
        tx = pos.x; tz = pos.z;
      } else if (hunterDist < HIDE_RADIUS) {
        // 猎手逼近 → 概率就地藏匿, 否则逃离
        let hid = false;
        if (!bot._lastHideTime || now - bot._lastHideTime >= HIDE_COOLDOWN) {
          if (Math.random() < 0.45) {
            this.submit3DHide(bot.id, 'bot_hide');
            bot._lastHideTime = now;
            hid = true;
          }
        }
        if (hid) {
          tx = pos.x; tz = pos.z;
        } else {
          const dx = pos.x - hunter.pos.x, dz = pos.z - hunter.pos.z;
          const len = Math.hypot(dx, dz) || 1;
          tx = pos.x + dx / len * SPEED * DT;
          tz = pos.z + dz / len * SPEED * DT;
        }
      } else if (hunterDist < FLEE_RADIUS) {
        const dx = pos.x - hunter.pos.x, dz = pos.z - hunter.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        tx = pos.x + dx / len * SPEED * DT;
        tz = pos.z + dz / len * SPEED * DT;
      } else {
        // 无威胁 → 采集灵焰 / 走向仪式圈
        const flames = this.spiritFlames || [];
        const uncollected = flames.filter(f => !f.collected);
        if (uncollected.length > 0) {
          const flame = this._nearestFlame(uncollected, pos);
          if (flame) {
            const d = Math.hypot(flame.x - pos.x, flame.z - pos.z);
            if (d <= FLAME_COLLECT_RADIUS) {
              collectFlameId = flame.id;
            } else {
              const step = Math.min(d, SPEED * DT);
              tx = pos.x + (flame.x - pos.x) / d * step;
              tz = pos.z + (flame.z - pos.z) / d * step;
            }
          }
        } else {
          const d = Math.hypot(RITUAL_CENTER.x - pos.x, RITUAL_CENTER.z - pos.z);
          if (d <= RITUAL_RADIUS) {
            startRitual = true;
          } else {
            const step = Math.min(d, SPEED * DT);
            tx = pos.x + (RITUAL_CENTER.x - pos.x) / d * step;
            tz = pos.z + (RITUAL_CENTER.z - pos.z) / d * step;
          }
        }
      }
    }

    // 边界钳制
    tx = Math.max(-BOUND, Math.min(BOUND, tx));
    tz = Math.max(-BOUND, Math.min(BOUND, tz));

    const dxf = tx - pos.x, dzf = tz - pos.z;
    const moved = Math.hypot(dxf, dzf) > 0.01;
    const rotY = moved ? Math.atan2(dxf, dzf) * 180 / Math.PI : (pos.rotY || 0);

    return {
      x: Math.round(tx * 10) / 10,
      y: 0,
      z: Math.round(tz * 10) / 10,
      rotY: Math.round(rotY * 10) / 10,
      isMoving: moved,
      isSprinting: bot.isCorrupted() && moved,
      attackId,
      collectFlameId,
      startRitual,
    };
  }

  /** 找距 pos 最近的未采集灵焰 */
  _nearestFlame(flames, pos) {
    let best = null, bestD = Infinity;
    for (const f of flames) {
      const d = Math.hypot(f.x - pos.x, f.z - pos.z);
      if (d < bestD) { bestD = d; best = f; }
    }
    return best;
  }

  /** 找距 pos 最近的玩家 (需已有坐标) */
  _nearest3D(players, pos) {
    let best = null, bestD = Infinity;
    for (const p of players) {
      const pp = this.positionSync.getPlayerPosition(p.id);
      if (!pp) continue;   // 真人未上报/断线等, 跳过
      const d = Math.hypot(pp.x - pos.x, pp.z - pos.z);
      if (d < bestD) { bestD = d; best = { p, pos: pp }; }
    }
    return best;
  }

  /** 3D模式: 蚀者噬灵目标 */
  submit3DAttack(corruptedId, targetId) {
    if (this.phase !== PHASES.NIGHT || this.gameMode !== 'THIRD_PERSON') return null;

    const corrupted = this.getPlayer(corruptedId);
    const target = this.getPlayer(targetId);
    if (!corrupted || !target || !corrupted.alive || !target.alive) return null;
    if (!corrupted.isCorrupted()) return null; // 只有蚀者能攻击
    if (target.isCorrupted()) return { success: false, reason: 'FRIENDLY_FIRE' }; // 蚀者不可噬灵队友

    // 反作弊: 距离校验 (蚀者只能在近距噬灵, 防远程/穿墙击杀)
    const apos = this.positionSync.getPlayerPosition(corruptedId);
    const tpos = this.positionSync.getPlayerPosition(targetId);
    if (!apos || !tpos) return null;
    if (Math.hypot(tpos.x - apos.x, tpos.z - apos.z) > ATTACK_RANGE) {
      return { success: false, reason: 'TOO_FAR' };
    }

    // 检查是否在攻击冷却中
    const now = Date.now();
    if (corrupted._lastAttackTime && now - corrupted._lastAttackTime < 8000) {
      return { success: false, reason: 'COOLDOWN' };
    }

    corrupted._lastAttackTime = now;

    // 检查目标是否有短铳反击
    if (target.role === 'FLAME_TRACKER' && target.blunderbussUsable) {
      corrupted.alive = false;
      corrupted._killedBy = targetId;
      target.blunderbussUsable = false;
      this._check3DWin();
      return { success: true, result: 'COUNTERED', victim: corruptedId, killer: targetId };
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
    target._killedBy = corruptedId;
    // 若被杀者是仪式引导者 → 取消仪式
    if (this._ritual && this._ritual.playerId === targetId) this._cancel3DRitual('引导者被噬灵');
    this._check3DWin();
    return { success: true, result: 'KILLED', victim: targetId, killer: corruptedId };
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

  // ==================== 3D 灵焰仪式 ====================

  /** 3D模式: 守幕者采集灵焰 (距未采集灵焰 ≤ FLAME_COLLECT_RADIUS) */
  collect3DFlame(playerId, flameId) {
    if (this.phase !== PHASES.NIGHT || this.gameMode !== 'THIRD_PERSON') return { success: false, reason: 'NOT_NIGHT' };
    const player = this.getPlayer(playerId);
    if (!player || !player.alive || player.isCorrupted()) return { success: false, reason: 'INVALID' };

    const flame = (this.spiritFlames || []).find(f => f.id === flameId);
    if (!flame) return { success: false, reason: 'UNKNOWN_FLAME' };
    if (flame.collected) return { success: false, reason: 'ALREADY_COLLECTED' };

    const pos = this.positionSync.getPlayerPosition(playerId);
    if (!pos) return { success: false, reason: 'NO_POSITION' };
    if (Math.hypot(pos.x - flame.x, pos.z - flame.z) > FLAME_COLLECT_RADIUS) return { success: false, reason: 'TOO_FAR' };

    flame.collected = true;
    this._broadcastFlames();
    return { success: true };
  }

  /** 3D模式: 守幕者在广场引导灵焰仪式 (需全部灵焰已采集, 12s 后守幕者胜) */
  start3DRitual(playerId) {
    if (this.phase !== PHASES.NIGHT || this.gameMode !== 'THIRD_PERSON') return { success: false, reason: 'NOT_NIGHT' };
    const player = this.getPlayer(playerId);
    if (!player || !player.alive || player.isCorrupted()) return { success: false, reason: 'INVALID' };

    const flames = this.spiritFlames || [];
    const allCollected = flames.length > 0 && flames.every(f => f.collected);
    if (!allCollected) return { success: false, reason: 'FLAMES_INCOMPLETE' };

    const pos = this.positionSync.getPlayerPosition(playerId);
    if (!pos) return { success: false, reason: 'NO_POSITION' };
    if (Math.hypot(pos.x - RITUAL_CENTER.x, pos.z - RITUAL_CENTER.z) > RITUAL_RADIUS) return { success: false, reason: 'TOO_FAR' };

    if (this._ritual && this._ritual.playerId === playerId) return { success: true, started: true };

    this._ritual = { playerId, startedAt: Date.now() };
    this._broadcastFlames();

    // 12s 引导完成 → 守幕者胜 (期间死亡/走远则取消)
    this._ritualTimeout = setTimeout(() => {
      if (this.phase !== PHASES.NIGHT || this.gameMode !== 'THIRD_PERSON') return;
      if (!this._ritual || this._ritual.playerId !== playerId) return;
      const p = this.getPlayer(playerId);
      if (!p || !p.alive) return;
      const pp = this.positionSync.getPlayerPosition(playerId);
      if (!pp || Math.hypot(pp.x - RITUAL_CENTER.x, pp.z - RITUAL_CENTER.z) > RITUAL_RADIUS) {
        this._cancel3DRitual('引导者走远');
        return;
      }
      this.endGame(TEAMS.VEIL_KEEPERS, '守幕者完成灵焰仪式');
    }, RITUAL_CHANNEL_SECONDS * 1000);

    return { success: true, started: true };
  }

  /** 取消当前仪式引导 */
  _cancel3DRitual(reason) {
    this._clearRitualTimeout();
    if (this._ritual) {
      this._ritual = null;
      this._broadcastFlames();
    }
  }

  _clearRitualTimeout() {
    if (this._ritualTimeout) {
      clearTimeout(this._ritualTimeout);
      this._ritualTimeout = null;
    }
  }

  /** 3D模式: 击杀后即时判定胜利 (守幕者全灭 → 蚀者胜; 蚀者全灭 → 守幕者胜) */
  _check3DWin() {
    if (this.gameMode !== 'THIRD_PERSON' || this.phase !== PHASES.NIGHT) return;
    const aliveKeepers = this.players.filter(p => p.alive && !p.isCorrupted());
    const aliveCorrupted = this.players.filter(p => p.alive && p.isCorrupted());
    if (aliveKeepers.length === 0) {
      this.endGame(TEAMS.CORRUPTED, '守幕者全部被吞噬');
    } else if (aliveCorrupted.length === 0) {
      this.endGame(TEAMS.VEIL_KEEPERS, '蚀者全部被消灭');
    }
  }

  /** 广播灵焰/仪式状态 (采集数 + 地标 + 仪式) */
  _broadcastFlames() {
    if (this._io) this._io.to(this.id).emit('game:flameUpdate', this._flameState());
  }

  _flameState() {
    const flames = this.spiritFlames || [];
    return {
      flames: flames.map(f => ({ id: f.id, name: f.name, x: f.x, z: f.z, collected: f.collected })),
      collected: flames.filter(f => f.collected).length,
      total: flames.length,
      ritual: this._ritual ? { playerId: this._ritual.playerId, startedAt: this._ritual.startedAt, duration: RITUAL_CHANNEL_SECONDS } : null,
    };
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
      // 蚀者相认日志分发给相关蚀者
      if (entry.type === 'corrupted_united' && entry.corrupted) {
        for (const wid of entry.corrupted) {
          if (!this.privateLogs[wid]) this.privateLogs[wid] = [];
          this.privateLogs[wid].push(entry);
        }
      }
    }

    // 检查灵痕追猎者第二晚起可以行动
    if (this.round >= 2) {
      const flameTracker = this.players.find(p => p.role === ROLES.FLAME_TRACKER && p.alive);
      if (flameTracker) flameTracker.canAct = true;
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
    this.flameTrackerDayShoot = null;
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
    // (存到 _phaseTimeout 以便 returnToLobby/阶段切换时取消; 重入锁在回调内释放, 防止 2s 窗口内二次结算)
    this._phaseTimeout = setTimeout(() => {
      this._resolvingVotes = false;
      // 检查胜利条件
      this.checkWinCondition();

      if (this.phase !== PHASES.GAME_OVER) {
        this.round++;
        this.enterNight();
      }
    }, 2000);
    } catch (e) {
      // 异常路径: 释放重入锁并继续抛出
      this._resolvingVotes = false;
      throw e;
    }
  }

  // ==================== 灵痕追猎者白天开枪 ====================

  flameTrackerDayShootTarget(targetId) {
    // P0修复: 只能在DAY阶段开枪 + 灵痕追猎者必须在世 + 未开过枪
    if (this.phase !== PHASES.DAY) return false;
    if (this.flameTrackerDayShoot) return false; // 已开过枪
    const flameTracker = this.players.find(p => p.role === ROLES.FLAME_TRACKER && p.alive);
    if (!flameTracker || !flameTracker.hasRifle || !flameTracker.rifleUsable) return false;

    const target = this.getPlayer(targetId);
    if (!target || !target.alive) return false;

    target.alive = false;
    flameTracker.hasRifle = false;
    flameTracker.rifleUsable = false;
    this.flameTrackerDayShoot = targetId;
    // 记录到 dayLog（不会在夜晚被清除）
    this.dayLog.push({ type: 'flame_tracker_day_shoot', player: flameTracker.id, target: targetId, msg: `追猎者射击击杀了 ${target.name}` });

    this.checkWinCondition();
    return true;
  }

  // ==================== 胜利条件 ====================

  checkWinCondition() {
    const aliveCorrupted = this.players.filter(p =>
      p.alive && (p.role === ROLES.CORRUPTED ||
        (p.role === ROLES.NETHER_MONK && (p.isTransformed || p.hasUsedCorrupt)))
    );
    // 未蚀变/未堕化冥僧人算作守幕者方
    const aliveKeepers = this.players.filter(p =>
      p.alive && (p.team === TEAMS.VEIL_KEEPERS ||
        (p.role === ROLES.NETHER_MONK && !p.isTransformed && !p.hasUsedCorrupt))
    );

    if (aliveCorrupted.length === 0) {
      this.endGame(TEAMS.VEIL_KEEPERS, '所有蚀者已出局');
    } else if (aliveCorrupted.length >= aliveKeepers.length) {
      this.endGame(TEAMS.CORRUPTED, '蚀者数量不少于守幕者，蚀者获胜');
    }
  }

  endGame(winnerTeam, reason) {
    if (this.phase === PHASES.GAME_OVER) return;   // 防止重复结算
    this.phase = PHASES.GAME_OVER;
    const ending = this.storyManager.generateEnding(winnerTeam, this.players, this.round);
    this.gameResult = { winner: winnerTeam, reason, ending };
    this._clearPhaseTimeout();
    this._stop3DBotAI();
    this._clearRitualTimeout();
    this.broadcastGameOver();

    // 5 分钟后若无在线真人玩家则自动清理房间 (防房间泄漏, 见 GameManager.scheduleGameCleanup)
    this._gameManager?.scheduleGameCleanup?.(this.id);

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

    // 停止位置同步 + 人机AI
    this._stopPositionSync();
    this._stop3DBotAI();
    this._clearRitualTimeout();
    this._ritual = null;

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
      p.hasUsedCorrupt = false;
      p.hasKilled = false;
      p.corruptedByNetherMonk = false;
      p.willBecomeCorrupted = false;
      p.protectTarget = null;
      p.isProtecting = false;
      p.heavyInjury = false;
      p.halfAlive = false;
      p.whoKnowsVeilGuardianHeavyInjury = [];
      p.knownCorrupted = [];
      p.corruptedOpenEyesTogether = [];
      p.corruptedKillTarget = null;
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
    this._resolvingVotes = false;
    this.nightLog = [];
    this.privateLogs = {};
    this.nightStep = null;
    this.nightStepIndex = 0;
    this.flameTrackerDayShoot = null;
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
      ending: this.gameResult.ending,
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
        isProtecting: p.isProtecting,
        weaverIndex: p.weaverIndex,
        // v2.0: 表层身份（选人完成后公开）
        characterId: this.phase !== PHASES.LOBBY ? p.characterId : undefined,
      })),
      votes: this.phase === PHASES.VOTE ? this.votes : {},
      voteResults: this.voteResults,
      nightLog: this.nightLog,
      nightNarrative: this.nightNarrative || null,
      dayLog: this.dayLog,
      flameTrackerDayShoot: this.flameTrackerDayShoot,
      discussionOrder: this.phase === PHASES.DISCUSSION ? this.discussionOrder : [],
      currentSpeakerId: this.phase === PHASES.DISCUSSION ? this.currentSpeakerId : null,
      discussionTimeLeft: this.phase === PHASES.DISCUSSION ? this.discussionTimeLeft : 0,
    };
  }

  getPrivateState(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return null;

    // 从私密日志中提取帷幕学者察灵结果 { targetId: 'GOOD'|'CORRUPTED' }
    const seerCheckResults = {};
    const myLogs = this.privateLogs[playerId] || [];
    for (const entry of myLogs) {
      if (entry.type === 'veil_scholar_check' && entry.target && entry.result) {
        seerCheckResults[entry.target] = entry.result;
      }
    }

    return {
      ...this.getPublicState(),
      myRole: player.role,
      myTeam: player.team,
      myPrivateState: player.toPrivateJSON(),
      privateLog: myLogs,
      seerCheckResults,  // { targetPlayerId: 'GOOD'|'CORRUPTED' }
      // 只返回该玩家应看到的信息
      players: this.players.map(p => {
        const base = {
          id: p.id,
          name: p.name,
          alive: p.alive,
          heavyInjury: p.heavyInjury,
          isProtecting: p.isProtecting,
        };
        // 自己的信息
        if (p.id === playerId) {
          base.role = p.role;
          return base;
        }
        // 蚀者相认后可以看到彼此的role
        if (player.knownCorrupted?.includes(p.id)) {
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
      effectivePlayerCount: this.getEffectivePlayerCount(),
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
    // 如果是灵织者因人多被赶回家，只告诉"很多人"
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
