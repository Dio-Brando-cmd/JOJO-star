// ============================================================
// 人机管理器 — AI机器人智能决策（v1.5.1 增强版）
// ============================================================

import { ROLES, NIGHT_ACTIONS, NIGHT_STEPS } from './constants.js';

export class BotManager {
  constructor(game) {
    this.game = game;
    this._timers = new Map();
    // 人机共享记忆：记录关键事件供策略参考
    this.memory = {
      checkedPlayers: new Map(),   // playerId -> 'GOOD'|'WOLF' (预言家查验记录)
      knownWolves: new Set(),      // 已知狼人ID
      knownGods: new Set(),        // 已知神职ID
      attackHistory: [],           // [{round, target, result}]
      voteHistory: [],             // [{round, voter, target}]
      deathHistory: [],            // [{round, playerId, role}]
      suspicion: new Map(),        // playerId -> score (越高越可疑)
    };
  }

  getAliveBots() {
    return this.game.players.filter(p => p.alive && p.isBot);
  }

  // ==================== 记忆更新 ====================

  updateMemory() {
    // 从公开日志提取死亡信息
    for (const entry of this.game.nightLog) {
      if (entry.type === 'death' && entry.player) {
        const dead = this.game.players.find(p => p.id === entry.player);
        if (dead) {
          this.memory.deathHistory.push({ round: this.game.round, playerId: entry.player, role: dead.role });
          this.memory.suspicion.delete(entry.player);
        }
      }
    }
    // 从私密日志提取查验信息（通过扫描所有机器人的 privateLogs）
    for (const bot of this.getAliveBots()) {
      const logs = this.game.privateLogs[bot.id] || [];
      for (const entry of logs) {
        if (entry.type === 'seer_check' && entry.target && entry.result) {
          this.memory.checkedPlayers.set(entry.target, entry.result);
          if (entry.result === 'WOLF') {
            this.memory.knownWolves.add(entry.target);
            this.memory.suspicion.set(entry.target, (this.memory.suspicion.get(entry.target) || 0) + 50);
          }
        }
        if (entry.type === 'wolf_meet' || entry.type === 'wolves_united') {
          if (entry.wolves) entry.wolves.forEach(w => this.memory.knownWolves.add(w));
        }
      }
    }
    // 标记已知神职
    for (const p of this.game.players) {
      if (!p.alive && p.role && p.role !== ROLES.VILLAGER && p.role !== ROLES.WEREWOLF && p.role !== ROLES.ALPHA_WOLF) {
        this.memory.knownGods.add(p.id);
      }
    }
  }

  // ==================== 投票提交 ====================

  submitBotVote(bot) {
    if (!bot.alive || !bot.isBot) return;

    const alivePlayers = this.game.players.filter(p => p.alive && p.id !== bot.id);
    if (alivePlayers.length === 0) {
      this.game.submitVote(bot.id, null);
      return;
    }

    // 智能投票：优先投可疑目标
    const target = this._pickVoteTarget(bot, alivePlayers);
    this.game.submitVote(bot.id, target?.id || null);
  }

  _pickVoteTarget(bot, alivePlayers) {
    // 1. 狼人阵营：避开已知同伴，投好人
    if (bot.isWolf()) {
      const nonWolves = alivePlayers.filter(p => !this.memory.knownWolves.has(p.id));
      if (nonWolves.length > 0) {
        // 优先投已知神职
        const gods = nonWolves.filter(p => this.memory.knownGods.has(p.id));
        if (gods.length > 0) return gods[Math.floor(Math.random() * gods.length)];
        // 投可疑度最高的
        nonWolves.sort((a, b) => (this.memory.suspicion.get(b.id) || 0) - (this.memory.suspicion.get(a.id) || 0));
        if ((this.memory.suspicion.get(nonWolves[0].id) || 0) > 0) return nonWolves[0];
        return nonWolves[Math.floor(Math.random() * nonWolves.length)];
      }
      return alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    }

    // 2. 好人阵营：优先投已知狼人
    const knownWolves = alivePlayers.filter(p => this.memory.knownWolves.has(p.id));
    if (knownWolves.length > 0) {
      return knownWolves[Math.floor(Math.random() * knownWolves.length)];
    }
    // 投可疑度最高的
    alivePlayers.sort((a, b) => (this.memory.suspicion.get(b.id) || 0) - (this.memory.suspicion.get(a.id) || 0));
    if ((this.memory.suspicion.get(alivePlayers[0].id) || 0) > 20) return alivePlayers[0];
    // 30% 弃权，70% 随机
    if (Math.random() < 0.3) return null;
    return alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
  }

  // ==================== 夜晚行动 ====================

  submitBotNightAction(bot, step) {
    if (!bot.alive || !bot.isBot) return;
    const action = this._decideNightAction(bot, step);
    if (action) {
      this.game.submitNightAction(bot.id, action.action, action.target, action.ability);
    }
  }

  autoActForStep(step) {
    const bots = this.game.players.filter(p => {
      if (!p.alive || !p.isBot) return false;
      return this._isBotInStep(p, step);
    });

    for (const bot of bots) {
      if (bot.nightAction !== null) continue;
      const delay = 1000 + Math.floor(Math.random() * 3000);
      const timer = setTimeout(() => {
        this.submitBotNightAction(bot, step);
        this._checkStepComplete(step);
      }, delay);
      this._timers.set(bot.id + '_' + step, timer);
    }
  }

  _checkStepComplete(step) {
    if (this.game.phase !== 'NIGHT') return;
    if (this.game.nightStep !== step) return;
    const playersInStep = this.game._getPlayersForStep(step);
    const allDone = playersInStep.length > 0 && playersInStep.every(p => p.nightAction !== null);
    if (allDone) this.game.advanceNightStep();
  }

  _isBotInStep(bot, step) {
    const playersInStep = this.game._getPlayersForStep(step);
    return playersInStep.some(p => p.id === bot.id);
  }

  // ==================== 讨论阶段 ====================

  skipBotDiscussion(bot) {
    if (!bot.alive || !bot.isBot) return;
    if (this.game.phase === 'DISCUSSION' && this.game.currentSpeakerId === bot.id) {
      setTimeout(() => {
        // 偶尔"发言"（发送聊天消息）
        if (Math.random() < 0.15) {
          this._botChat(bot);
        }
        setTimeout(() => {
          this.game.skipDiscussionSpeaker(bot.id);
          if (this.game._io) {
            this.game._io.to(this.game.id).emit('game:state', this.game.getPublicState());
          }
        }, 1500 + Math.floor(Math.random() * 2000));
      }, 500 + Math.floor(Math.random() * 1000));
    }
  }

  _botChat(bot) {
    if (!this.game._io) return;
    const msgs = this._getChatMessages(bot);
    if (msgs.length === 0) return;
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    this.game._io.to(this.game.id).emit('chat:message', {
      playerId: bot.id,
      playerName: bot.name,
      message: msg,
      timestamp: Date.now(),
    });
  }

  _getChatMessages(bot) {
    const checked = [...this.memory.checkedPlayers.entries()];
    const msgs = [];
    if (bot.isWolf()) {
      msgs.push('我觉得XX很可疑...', '我是普通村民，没什么信息', '大家冷静分析', '我怀疑有人带节奏');
    } else if (bot.role === ROLES.SEER && checked.length > 0) {
      const [target, result] = checked[checked.length - 1];
      const targetName = this.game.getPlayer(target)?.name || '某人';
      msgs.push(`我查验了${targetName}，是${result === 'GOOD' ? '好人' : '狼人'}！`);
    } else if (bot.role === ROLES.VILLAGER) {
      msgs.push('我是村民，听神职带队', '大家跟预言家走', '我觉得昨晚的情况值得分析');
    } else if (bot.isGod()) {
      msgs.push('我有一些信息但先不说', '请大家理性投票', '注意观察投票行为');
    }
    return msgs;
  }

  // ==================== 核心决策引擎 ====================

  _decideNightAction(bot, step) {
    this.updateMemory(); // 每次决策前更新记忆

    const targets = this.game.players.filter(p => p.alive && p.id !== bot.id);
    const randomTarget = targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)] : null;

    switch (bot.role) {
      case ROLES.HUNTER:     return this._hunterAction(bot, targets, randomTarget);
      case ROLES.ALPHA_WOLF: return this._alphaWolfAction(bot, targets, randomTarget);
      case ROLES.GUARD:      return this._guardAction(bot, targets, randomTarget);
      case ROLES.WEREWOLF:   return this._werewolfAction(bot, targets, randomTarget);
      case ROLES.SEER:       return this._seerAction(bot, targets, randomTarget);
      case ROLES.POISON_WITCH: return this._poisonWitchAction(bot, targets, randomTarget);
      case ROLES.HEAL_WITCH:   return this._healWitchAction(bot, targets, randomTarget);
      case ROLES.VILLAGER:   return this._villagerAction(bot, targets, randomTarget);
      default: return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
    }
  }

  // ---- 辅助：智能选择目标 ----

  /** 狼人选择击杀目标：避开已知狼人，优先杀神职和预言家 */
  _pickWolfKillTarget(bot, targets) {
    const nonWolves = targets.filter(p => !this.memory.knownWolves.has(p.id));
    if (nonWolves.length === 0) return null;

    // 优先杀已暴露的神职
    const knownGod = nonWolves.filter(p => this.memory.knownGods.has(p.id));
    if (knownGod.length > 0 && Math.random() < 0.7) {
      return knownGod[Math.floor(Math.random() * knownGod.length)];
    }
    // 优先杀预言家（查验结果中有狼人的）
    const seers = nonWolves.filter(p => p.role === ROLES.SEER);
    if (seers.length > 0 && Math.random() < 0.5) {
      return seers[Math.floor(Math.random() * seers.length)];
    }
    // 随机选非狼人
    return nonWolves[Math.floor(Math.random() * nonWolves.length)];
  }

  /** 神职选择保护/查验目标：优先保护高价值角色 */
  _pickImportantTarget(bot, targets) {
    // 优先查验/保护可疑度高的
    const suspicious = targets.filter(p => (this.memory.suspicion.get(p.id) || 0) > 10);
    if (suspicious.length > 0 && Math.random() < 0.6) {
      return suspicious[Math.floor(Math.random() * suspicious.length)];
    }
    // 优先查验未查过的
    const unchecked = targets.filter(p => !this.memory.checkedPlayers.has(p.id));
    if (unchecked.length > 0 && Math.random() < 0.7) {
      return unchecked[Math.floor(Math.random() * unchecked.length)];
    }
    return targets[Math.floor(Math.random() * targets.length)];
  }

  // ---- 各角色行动 ----

  _hunterAction(bot, targets, rt) {
    if (this.game.round < 2 || !bot.canAct) {
      return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
    }
    // 60% 概率出门观察
    if (Math.random() < 0.6 && rt) {
      const observeTarget = this._pickImportantTarget(bot, targets) || rt;
      const useRifle = bot.rifleUsable && Math.random() < 0.5;
      return {
        action: NIGHT_ACTIONS.GO_OUT,
        target: observeTarget.id,
        ability: {
          hasRifle: bot.hasRifle,
          hasBlunderbuss: bot.hasBlunderbuss && Math.random() < 0.6,
          useRifle,
          rifleTarget: useRifle ? observeTarget.id : null,
        },
      };
    }
    return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
  }

  _alphaWolfAction(bot, targets, rt) {
    if (!bot.isTransformed && !bot.hasUsedInfect) {
      // 优先感染：选非狼人目标
      const infectTarget = this._pickWolfKillTarget(bot, targets) || rt;
      if (infectTarget && Math.random() < 0.7) {
        return {
          action: NIGHT_ACTIONS.USE_ABILITY,
          target: infectTarget.id,
          ability: { transform: true, infect: true },
        };
      }
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: rt?.id || null,
        ability: { transform: true },
      };
    }
    // 已变身 → 刀人（在 WEREWOLF 步骤执行）
    if (bot.isTransformed && rt && Math.random() < 0.85) {
      const killTarget = this._pickWolfKillTarget(bot, targets) || rt;
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: killTarget.id,
        ability: { kill: true, killTarget: killTarget.id },
      };
    }
    return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
  }

  _guardAction(bot, targets, rt) {
    if (rt && Math.random() < 0.75) {
      const guardTarget = this._pickImportantTarget(bot, targets) || rt;
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: guardTarget.id,
        ability: { guard: true },
      };
    }
    return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
  }

  _werewolfAction(bot, targets, rt) {
    if (rt && Math.random() < 0.8) {
      const killTarget = this._pickWolfKillTarget(bot, targets) || rt;
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: killTarget.id,
        ability: { kill: true },
      };
    }
    return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
  }

  _seerAction(bot, targets, rt) {
    if (rt && Math.random() < 0.85) {
      const checkTarget = this._pickImportantTarget(bot, targets) || rt;
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: checkTarget.id,
        ability: { check: true },
      };
    }
    return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
  }

  _poisonWitchAction(bot, targets, rt) {
    // 优先毒已知狼人
    const knownWolf = targets.find(p => this.memory.knownWolves.has(p.id));
    const usePoison = bot.hasPoison && this.game.round >= 2 && Math.random() < (knownWolf ? 0.8 : 0.35);
    const usePotion = bot.hasPotion && Math.random() < 0.25;

    if (usePoison && rt) {
      const poisonTarget = knownWolf || rt;
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: poisonTarget.id,
        ability: { lethalPoison: true, lethalPoisonTarget: poisonTarget.id },
      };
    }
    if (usePotion && rt) {
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: rt.id,
        ability: { potion: true, potionTarget: rt.id },
      };
    }
    return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
  }

  _healWitchAction(bot, targets, rt) {
    const knownWolf = targets.find(p => this.memory.knownWolves.has(p.id));
    const useHeal = bot.hasPotion && Math.random() < 0.25;
    const usePoison = bot.hasPoison && this.game.round >= 2 && Math.random() < (knownWolf ? 0.8 : 0.35);

    if (useHeal && rt) {
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: rt.id,
        ability: { heal: true, healTarget: rt.id },
      };
    }
    if (usePoison && rt) {
      const poisonTarget = knownWolf || rt;
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: poisonTarget.id,
        ability: { poison: true, poisonTarget: poisonTarget.id },
      };
    }
    return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
  }

  _villagerAction(bot, targets, rt) {
    if (rt && Math.random() < 0.55) {
      // 优先去可疑玩家的屋子
      const suspect = targets.find(p => (this.memory.suspicion.get(p.id) || 0) > 15);
      const visitTarget = suspect || rt;
      return { action: NIGHT_ACTIONS.GO_OUT, target: visitTarget.id, ability: null };
    }
    return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
  }

  // ==================== 清理 ====================

  cleanup() {
    for (const timer of this._timers.values()) clearTimeout(timer);
    this._timers.clear();
  }
}
