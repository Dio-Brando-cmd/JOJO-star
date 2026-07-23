// ============================================================
// TraitSystem — 外在特质结算引擎
// 处理表层身份特质对游戏逻辑的影响
// 覆盖：生存判定、移动规则、投票规则、信息获取等
// ============================================================

import { TRAIT_TYPES, ROLES, CHARACTER_IDENTITIES } from './constants.js';

export class TraitSystem {
  constructor(game) {
    this.game = game;
  }

  /**
   * 为玩家应用表层身份的特质
   * @param {Player} player
   * @param {string} characterId
   */
  applyCharacter(player, characterId) {
    const charDef = CHARACTER_IDENTITIES[characterId];
    if (!charDef) return false;

    player.characterId = characterId;
    player.characterTraits = charDef.externalTraits.map(t => ({
      ...t,
      active: true,        // 特质是否生效
      usedThisRound: false, // 本回合是否已使用
    }));

    return true;
  }

  /**
   * 检查玩家是否有某个特质
   */
  hasTrait(player, traitName) {
    if (!player.characterTraits) return false;
    return player.characterTraits.some(t => t.name === traitName && t.active);
  }

  /**
   * 检查特质是否可用（存在 + 未冷却 + 本回合未使用）
   */
  canUseTrait(player, traitName) {
    const trait = player.characterTraits?.find(t => t.name === traitName);
    if (!trait || !trait.active) return false;
    if (trait.usedThisRound) return false;
    const cooldown = player.traitCooldowns?.[traitName] || 0;
    if (cooldown > 0) return false;
    return true;
  }

  /**
   * 标记特质已使用
   */
  markTraitUsed(player, traitName, cooldownTurns = 0) {
    const trait = player.characterTraits?.find(t => t.name === traitName);
    if (trait) trait.usedThisRound = true;
    if (cooldownTurns > 0 && player.traitCooldowns) {
      player.traitCooldowns[traitName] = cooldownTurns;
    }
  }

  /**
   * 重置所有玩家的本回合特质使用标记
   */
  resetRoundTraits() {
    for (const p of this.game.players) {
      if (p.characterTraits) {
        for (const t of p.characterTraits) {
          t.usedThisRound = false;
        }
      }
      if (p.traitCooldowns) {
        p.tickCooldowns?.();
      }
    }
  }

  // ==========================================
  //  生存特质结算
  // ==========================================

  /**
   * 检查"老兵之躯"等生存特质：致命伤有概率变为重伤
   * @returns {boolean} 是否触发了生存特质
   */
  checkSurvivalTrait(player, damageSource) {
    if (!player.characterTraits) return false;

    // 老兵之躯（西格德）：15%概率重伤而非死亡
    if (this.canUseTrait(player, '老兵之躯')) {
      if (Math.random() < 0.15) {
        player.heavyInjury = true;
        this.markTraitUsed(player, '老兵之躯', 2); // 冷却2回合
        this._logTraitTrigger(player, '老兵之躯', '重伤而非死亡');
        return true; // 活下来了（重伤）
      }
    }

    // 英雄之躯（赫克托）：守护姿态下25%不受重伤
    if (this.canUseTrait(player, '英雄之躯') && player.isGuarding) {
      if (Math.random() < 0.25) {
        this.markTraitUsed(player, '英雄之躯', 3);
        this._logTraitTrigger(player, '英雄之躯', '守护中完全抵御攻击');
        return true;
      }
    }

    return false;
  }

  // ==========================================
  //  移动/行动特质结算
  // ==========================================

  /**
   * 获取玩家在当前环境下的移动速度倍率
   */
  getMovementModifier(player) {
    let mod = 1.0;

    if (!player.characterTraits) return mod;

    // 自然亲和（莫莉安）：室外+10%，室内-5%
    if (this.hasTrait(player, '自然亲和')) {
      mod += 0.10; // 简化处理，默认室外
    }

    // 猎手步伐（斯卡蒂）：移动时脚步声减半（不影响速度本身）
    // 魔狼之血（哈尔瓦德）：移速+30%（在狼形态下，不在此处处理）

    return mod;
  }

  /**
   * 获取玩家的隐匿等级
   */
  getStealthLevel(player) {
    let level = 0;

    if (!player.characterTraits) return level;

    // 猎手步伐（斯卡蒂）：+3 隐匿
    if (this.hasTrait(player, '猎手步伐')) level += 3;

    // 自然亲和（莫莉安）：室外 +2
    if (this.hasTrait(player, '自然亲和')) level += 2;

    return Math.min(level, 10);
  }

  /**
   * 获取玩家是否可以追踪某人
   */
  canTrack(player, target) {
    // 莽撞（西格德）：必然留下踪迹
    if (this.hasTrait(target, '莽撞')) {
      return true;
    }
    return false;
  }

  // ==========================================
  //  社交/投票特质结算
  // ==========================================

  /**
   * 检查"魅惑之声"：讨论发言时不能被跳过
   */
  canBeSkippedDuringDiscussion(player) {
    if (this.hasTrait(player, '魅惑之声')) {
      return false;
    }
    return true;
  }

  /**
   * 检查"战吼"：可打断别人发言
   */
  canInterruptDiscussion(player) {
    return this.canUseTrait(player, '战吼');
  }

  /**
   * 检查"荣誉枷锁"：不能投票给已知好人
   */
  canVoteFor(player, target) {
    if (!this.hasTrait(player, '荣誉枷锁')) return true;
    // 已知的守幕者阵营玩家不能投
    if (target.team === 'VEIL_KEEPERS' && player.knownGoodPlayers?.includes(target.id)) {
      return false;
    }
    return true;
  }

  /**
   * 检查"异教徒"：被投票时额外计入0.5票
   */
  getVoteWeightModifier(player) {
    if (this.hasTrait(player, '异教徒')) {
      return 0.5;
    }
    return 0;
  }

  /**
   * 检查"戒律"：不能投票给第一晚查出的狼人
   */
  canVoteEarlyWolf(player, target) {
    if (!this.hasTrait(player, '戒律')) return true;
    if (player.earlyCheckedWolf === target.id) return false;
    return true;
  }

  // ==========================================
  //  信息获取特质结算
  // ==========================================

  /**
   * 冥界视觉（卡赫特）：查验类能力准确率+20%
   */
  getSeerBonus(player) {
    if (this.hasTrait(player, '冥界视觉')) {
      return 0.20;
    }
    return 0;
  }

  /**
   * 狼之嗅觉（罗慕路斯）：感知附近狼人
   */
  getWolfSense(player) {
    if (!this.hasTrait(player, '狼之嗅觉')) return null;

    const alivePlayers = this.game.players.filter(p => p.alive && p.id !== player.id);
    const nearbyWolves = alivePlayers.filter(p => p.isWolf());

    if (nearbyWolves.length === 0) return { detected: false, message: '你没有感知到狼人的气息' };

    // 模糊方向——只说"有"不说"谁"
    return {
      detected: true,
      message: '你隐约感觉到附近有狼人的气息……',
      vagueDirection: nearbyWolves.length === 1 ? '一股' : '多股',
    };
  }

  /**
   * 织网（莉莉安）：帷幕低语线索准确率+50%
   */
  getEavesdropBonus(player) {
    if (this.hasTrait(player, '织网')) {
      return 0.50;
    }
    return 0;
  }

  /**
   * 人缘（艾拉）：知道更多人的夜晚去向
   */
  getSocialInfoBonus(player) {
    if (!this.hasTrait(player, '人缘')) return null;

    // 随机获知一个出门玩家的去向
    const outPlayers = this.game.players.filter(p =>
      p.alive && p.id !== player.id && p.nightAction === 'GO_OUT'
    );
    if (outPlayers.length === 0) return null;

    const target = outPlayers[Math.floor(Math.random() * outPlayers.length)];
    return {
      type: 'social_info',
      message: `你听说${target.name || target.weaverName || '某人'}今晚出门了`,
    };
  }

  // ==========================================
  //  弱点特质结算
  // ==========================================

  /**
   * 月狂（罗慕路斯）：满月之夜有概率失控
   */
  checkMoonMadness(player, round) {
    if (!this.hasTrait(player, '月狂')) return false;
    // 每3晚一次满月
    if (round % 3 !== 0) return false;
    // 30%概率失控
    if (Math.random() < 0.30) {
      this._logTraitTrigger(player, '月狂', '满月之夜，行动失控');
      return true;
    }
    return false;
  }

  /**
   * 银之恐惧（哈尔瓦德）：被守卫筑垒的屋子不能进入
   */
  canEnterHouse(player, houseId) {
    if (!this.hasTrait(player, '银之恐惧')) return true;
    // 检查该屋子是否被守卫筑垒
    const guard = this.game.players.find(p =>
      p.role === ROLES.VEIL_GUARDIAN && p.alive && p.fortifiedTarget === houseId
    );
    if (guard) return false;
    return true;
  }

  /**
   * 纤弱（芙蕾雅）：被蚀者噬灵时无法自行逃脱
   */
  isFrail(player) {
    return this.hasTrait(player, '纤弱');
  }

  // ==========================================
  //  日志
  // ==========================================

  _logTraitTrigger(player, traitName, effect) {
    if (!this.game.privateLogs) return;
    if (!this.game.privateLogs[player.id]) {
      this.game.privateLogs[player.id] = [];
    }
    this.game.privateLogs[player.id].push({
      type: 'trait_trigger',
      trait: traitName,
      effect,
      timestamp: Date.now(),
    });
  }
}
