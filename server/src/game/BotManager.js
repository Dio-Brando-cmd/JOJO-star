// ============================================================
// 人机管理器 — AI智能决策（v2.0 扩展版）
// 覆盖所有升级后的角色能力
// ============================================================

import { ROLES, NIGHT_ACTIONS, NIGHT_STEPS, VILLAGER_TYPES, ALPHA_ACTIONS } from './constants.js';

export class BotManager {
  constructor(game) {
    this.game = game;
    this._timers = new Map();
    this.memory = {
      checkedPlayers: new Map(),
      knownWolves: new Set(),
      knownGods: new Set(),
      attackHistory: [],
      voteHistory: [],
      deathHistory: [],
      suspicion: new Map(),
      howlHeard: [],          // 听到嚎叫的狼人
      trapLocations: new Set(), // 已知陷阱位置
      fortifiedHouses: new Set(), // 已知筑垒屋子
    };
  }

  getAliveBots() {
    return this.game.players.filter(p => p.alive && p.isBot);
  }

  // ==================== 记忆更新 ====================
  updateMemory() {
    for (const entry of this.game.nightLog) {
      if (entry.type === 'death' && entry.player) {
        const dead = this.game.players.find(p => p.id === entry.player);
        if (dead) {
          this.memory.deathHistory.push({ round: this.game.round, playerId: entry.player, role: dead.role });
          this.memory.suspicion.delete(entry.player);
        }
      }
    }
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
        if (entry.type === 'wolf_howl_heard') {
          this.memory.howlHeard.push(entry.howler);
        }
        if (entry.type === 'hunter_trap' || entry.type === 'old_hunter_trap') {
          this.memory.trapLocations.add(entry.target);
        }
        if (entry.type === 'guard_fortify') {
          this.memory.fortifiedHouses.add(entry.target);
        }
      }
    }
    for (const p of this.game.players) {
      if (!p.alive && p.role && p.role !== ROLES.VILLAGER && p.role !== ROLES.WEREWOLF && p.role !== ROLES.ALPHA_WOLF) {
        this.memory.knownGods.add(p.id);
      }
    }
  }

  // ==================== 投票 ====================
  submitBotVote(bot) {
    if (!bot.alive || !bot.isBot || bot.halfAlive) return;
    const alivePlayers = this.game.players.filter(p => p.alive && p.id !== bot.id);
    if (alivePlayers.length === 0) { this.game.submitVote(bot.id, null); return; }
    const target = this._pickVoteTarget(bot, alivePlayers);
    this.game.submitVote(bot.id, target?.id || null);
  }

  _pickVoteTarget(bot, alivePlayers) {
    if (bot.isWolf()) {
      const nonWolves = alivePlayers.filter(p => !this.memory.knownWolves.has(p.id));
      if (nonWolves.length > 0) {
        const gods = nonWolves.filter(p => this.memory.knownGods.has(p.id));
        if (gods.length > 0) return gods[Math.floor(Math.random() * gods.length)];
        nonWolves.sort((a, b) => (this.memory.suspicion.get(b.id) || 0) - (this.memory.suspicion.get(a.id) || 0));
        if ((this.memory.suspicion.get(nonWolves[0].id) || 0) > 0) return nonWolves[0];
        return nonWolves[Math.floor(Math.random() * nonWolves.length)];
      }
      return alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    }
    const knownWolves = alivePlayers.filter(p => this.memory.knownWolves.has(p.id));
    if (knownWolves.length > 0) return knownWolves[Math.floor(Math.random() * knownWolves.length)];
    alivePlayers.sort((a, b) => (this.memory.suspicion.get(b.id) || 0) - (this.memory.suspicion.get(a.id) || 0));
    if ((this.memory.suspicion.get(alivePlayers[0].id) || 0) > 20) return alivePlayers[0];
    if (Math.random() < 0.3) return null;
    return alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
  }

  // ==================== 夜晚行动 ====================
  submitBotNightAction(bot, step) {
    if (!bot.alive || !bot.isBot || bot.halfAlive) return;
    const action = this._decideNightAction(bot, step);
    if (action) {
      this.game.submitNightAction(bot.id, action.action, action.target, action.ability);
    }
  }

  autoActForStep(step) {
    const bots = this.game.players.filter(p => {
      if (!p.alive || !p.isBot || p.halfAlive) return false;
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

  // ==================== 讨论 ====================
  skipBotDiscussion(bot) {
    if (!bot.alive || !bot.isBot || bot.halfAlive) return;
    if (this.game.phase === 'DISCUSSION' && this.game.currentSpeakerId === bot.id) {
      setTimeout(() => {
        if (Math.random() < 0.15) this._botChat(bot);
        setTimeout(() => {
          this.game.skipDiscussionSpeaker(bot.id);
          if (this.game._io) this.game._io.to(this.game.id).emit('game:state', this.game.getPublicState());
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
    } else if (bot.isVillager()) {
      const typeMsgs = {
        [VILLAGER_TYPES.OLD_HUNTER]: ['我这双老眼还看得清...', '我见过太多狼了'],
        [VILLAGER_TYPES.MERCHANT]: ['我听到了一些风声...', '消息就是力量'],
        [VILLAGER_TYPES.STORYTELLER]: ['让我讲个故事...', '从前有只狼...'],
        [VILLAGER_TYPES.BLACKSMITH]: ['我的铁锤可以砸碎任何东西', '门锁好了，安心睡吧'],
        [VILLAGER_TYPES.WEAVER]: ['我听到了一些细微的声响...', '每一根线都有它的去向'],
      };
      const vtMsgs = typeMsgs[bot.villagerType] || ['我是村民，听神职带队', '大家跟预言家走'];
      msgs.push(...vtMsgs);
    } else if (bot.isGod()) {
      msgs.push('我有一些信息但先不说', '请大家理性投票', '注意观察投票行为');
    }
    return msgs;
  }

  // ==================== 核心决策引擎 ====================
  _decideNightAction(bot, step) {
    this.updateMemory();
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

  _pickWolfKillTarget(bot, targets) {
    const nonWolves = targets.filter(p => !this.memory.knownWolves.has(p.id));
    if (nonWolves.length === 0) return null;

    // 避开筑垒的屋子
    const safeTargets = nonWolves.filter(p => !this.memory.fortifiedHouses.has(p.currentHouse || p.id));
    const pool = safeTargets.length > 0 ? safeTargets : nonWolves;

    const knownGod = pool.filter(p => this.memory.knownGods.has(p.id));
    if (knownGod.length > 0 && Math.random() < 0.7) return knownGod[Math.floor(Math.random() * knownGod.length)];
    const seers = pool.filter(p => p.role === ROLES.SEER);
    if (seers.length > 0 && Math.random() < 0.5) return seers[Math.floor(Math.random() * seers.length)];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _pickImportantTarget(bot, targets) {
    const suspicious = targets.filter(p => (this.memory.suspicion.get(p.id) || 0) > 10);
    if (suspicious.length > 0 && Math.random() < 0.6) return suspicious[Math.floor(Math.random() * suspicious.length)];
    const unchecked = targets.filter(p => !this.memory.checkedPlayers.has(p.id));
    if (unchecked.length > 0 && Math.random() < 0.7) return unchecked[Math.floor(Math.random() * unchecked.length)];
    return targets[Math.floor(Math.random() * targets.length)];
  }

  // ---- 各角色行动（扩展版） ----
  _hunterAction(bot, targets, rt) {
    if (this.game.round < 2 || !bot.canAct) {
      return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
    }

    const roll = Math.random();
    // 30% 设陷阱
    if (roll < 0.30 && rt) {
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: rt.id,
        ability: { useTrap: true, trapTarget: rt.id },
      };
    }
    // 35% 出门观察+可能开枪
    if (roll < 0.65 && rt) {
      const observeTarget = this._pickImportantTarget(bot, targets) || rt;
      const useRifle = bot.rifleUsable && Math.random() < 0.4;
      return {
        action: NIGHT_ACTIONS.GO_OUT,
        target: observeTarget.id,
        ability: {
          hasRifle: bot.hasRifle,
          hasBlunderbuss: bot.hasBlunderbuss && Math.random() < 0.5,
          useRifle,
          rifleTarget: useRifle ? observeTarget.id : null,
          observeTarget: observeTarget.id,
        },
      };
    }
    return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
  }

  _alphaWolfAction(bot, targets, rt) {
    if (!bot.isTransformed && !bot.hasUsedInfect) {
      const infectTarget = this._pickWolfKillTarget(bot, targets) || rt;
      if (infectTarget && Math.random() < 0.65) {
        // 15%概率同时编织假身份
        const useFakeId = Math.random() < 0.15;
        const fakeRoles = [ROLES.SEER, ROLES.GUARD, ROLES.HUNTER];
        return {
          action: NIGHT_ACTIONS.USE_ABILITY,
          target: infectTarget.id,
          ability: {
            transform: true,
            infect: true,
            fakeIdentity: useFakeId,
            fakeIdentityRole: useFakeId ? fakeRoles[Math.floor(Math.random() * fakeRoles.length)] : null,
          },
        };
      }
      return { action: NIGHT_ACTIONS.USE_ABILITY, target: rt?.id || null, ability: { transform: true } };
    }
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
    const roll = Math.random();
    // 40% 守护
    if (roll < 0.40 && rt) {
      const guardTarget = this._pickImportantTarget(bot, targets) || rt;
      return { action: NIGHT_ACTIONS.USE_ABILITY, target: guardTarget.id, ability: { guard: true } };
    }
    // 25% 巡逻
    if (roll < 0.65) {
      return { action: NIGHT_ACTIONS.PATROL, target: null, ability: { patrol: true } };
    }
    // 15% 筑垒
    if (roll < 0.80 && rt) {
      return { action: NIGHT_ACTIONS.FORTIFY, target: rt.id, ability: { fortify: true } };
    }
    // 10% 舍身（限选重要角色）
    if (roll < 0.90 && rt) {
      const gods = targets.filter(p => this.memory.knownGods.has(p.id));
      if (gods.length > 0) {
        const sacrifice = gods[Math.floor(Math.random() * gods.length)];
        return { action: NIGHT_ACTIONS.SACRIFICE, target: sacrifice.id, ability: { sacrifice: true } };
      }
    }
    return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
  }

  _werewolfAction(bot, targets, rt) {
    const roll = Math.random();
    // 10% 嚎叫（冷却中跳过）
    if (roll < 0.10 && bot.howlCooldown <= 0) {
      return { action: NIGHT_ACTIONS.HOWL, target: null, ability: { howl: true } };
    }
    // 12% 伪装
    if (roll < 0.22 && rt) {
      return { action: NIGHT_ACTIONS.DISGUISE, target: rt.id, ability: { disguise: true } };
    }
    // 65% 刀人
    if (roll < 0.87 && rt) {
      const killTarget = this._pickWolfKillTarget(bot, targets) || rt;
      const trackScent = Math.random() < 0.4;
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: killTarget.id,
        ability: { kill: true, trackScent },
      };
    }
    return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
  }

  _seerAction(bot, targets, rt) {
    const roll = Math.random();
    // 65% 正常查验
    if (roll < 0.65 && rt) {
      const checkTarget = this._pickImportantTarget(bot, targets) || rt;
      const useDreamFragment = Math.random() < 0.3;
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: checkTarget.id,
        ability: { check: true, dreamFragment: useDreamFragment },
      };
    }
    // 15% 灵视（查验死人）
    if (roll < 0.80) {
      const deadPlayers = this.game.players.filter(p => !p.alive && !this.memory.checkedPlayers.has(p.id));
      if (deadPlayers.length > 0) {
        const spiritTarget = deadPlayers[Math.floor(Math.random() * deadPlayers.length)];
        return {
          action: NIGHT_ACTIONS.USE_ABILITY,
          target: null,
          ability: { spiritVision: true, spiritVisionTarget: spiritTarget.id },
        };
      }
    }
    return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
  }

  _poisonWitchAction(bot, targets, rt) {
    const knownWolf = targets.find(p => this.memory.knownWolves.has(p.id));
    const roll = Math.random();

    // 毒雾陷阱 25%
    if (roll < 0.25 && rt) {
      const fogTarget = knownWolf || rt;
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: fogTarget.id,
        ability: { poisonFog: true, poisonFogTarget: fogTarget.id },
      };
    }
    // 烈性毒药（有足够材料）
    if (roll < 0.55 && rt && (bot.poisonMaterials || 2) >= 2) {
      const poisonTarget = knownWolf || rt;
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: poisonTarget.id,
        ability: { lethalPoison: true, lethalPoisonTarget: poisonTarget.id },
      };
    }
    // 药水 15%
    if (roll < 0.70 && rt && bot.hasPotion) {
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
    const roll = Math.random();

    // 诊断 20%
    if (roll < 0.20 && rt) {
      const diagTarget = this._pickImportantTarget(bot, targets) || rt;
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: diagTarget.id,
        ability: { diagnose: true },
      };
    }
    // 万能药 20%
    if (roll < 0.40 && bot.hasPotion && rt) {
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: rt.id,
        ability: { heal: true, healTarget: rt.id },
      };
    }
    // 毒药 25%
    if (roll < 0.65 && bot.hasPoison && rt) {
      const poisonTarget = knownWolf || rt;
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: poisonTarget.id,
        ability: { poison: true, poisonTarget: poisonTarget.id },
      };
    }
    // 药草园 15%
    if (roll < 0.80 && !bot.herbGardenPlanted) {
      return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: { plantHerbGarden: true } };
    }
    // 战场急救 10%
    if (roll < 0.90 && rt) {
      return {
        action: NIGHT_ACTIONS.USE_ABILITY,
        target: rt.id,
        ability: { battlefieldAid: true },
      };
    }
    return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
  }

  _villagerAction(bot, targets, rt) {
    const roll = Math.random();

    switch (bot.villagerType) {
      case VILLAGER_TYPES.OLD_HUNTER:
        if (roll < 0.35 && !bot.doorFortified) return { action: NIGHT_ACTIONS.TRAP_SET, target: null, ability: null };
        if (roll < 0.70 && rt) return { action: NIGHT_ACTIONS.GO_OUT, target: rt.id, ability: null };
        return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };

      case VILLAGER_TYPES.MERCHANT:
        if (roll < 0.50 && rt) {
          const second = targets.filter(t => t.id !== rt.id)[0];
          return {
            action: NIGHT_ACTIONS.GO_OUT,
            target: rt.id,
            ability: second ? { secondVisit: true, secondTarget: second.id } : null,
          };
        }
        return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };

      case VILLAGER_TYPES.HERBALIST:
        if (roll < 0.60 && rt) {
          return { action: NIGHT_ACTIONS.HERBAL_REMEDY, target: rt.id, ability: null };
        }
        return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };

      case VILLAGER_TYPES.NIGHT_WATCHER:
        if (roll < 0.65) return { action: NIGHT_ACTIONS.NIGHT_WATCH, target: null, ability: null };
        if (roll < 0.80 && rt) return { action: NIGHT_ACTIONS.GO_OUT, target: rt.id, ability: null };
        return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };

      case VILLAGER_TYPES.BLACKSMITH:
        if (roll < 0.45 && !bot.doorFortified) return { action: NIGHT_ACTIONS.FORTIFY_DOOR, target: null, ability: null };
        if (roll < 0.70 && rt) return { action: NIGHT_ACTIONS.GO_OUT, target: rt.id, ability: null };
        return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };

      case VILLAGER_TYPES.WEAVER:
        if (roll < 0.60 && rt) return { action: NIGHT_ACTIONS.EAVESDROP, target: rt.id, ability: null };
        return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };

      case VILLAGER_TYPES.BAKER:
        if (roll < 0.60 && rt) return { action: NIGHT_ACTIONS.GO_OUT, target: rt.id, ability: null };
        return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };

      default: // STORYTELLER 或未指定
        if (roll < 0.55 && rt) return { action: NIGHT_ACTIONS.GO_OUT, target: rt.id, ability: null };
        return { action: NIGHT_ACTIONS.SLEEP, target: null, ability: null };
    }
  }

  cleanup() {
    for (const timer of this._timers.values()) clearTimeout(timer);
    this._timers.clear();
  }
}
