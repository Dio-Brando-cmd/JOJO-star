// ============================================================
// 表层身份类 — Character
// 管理玩家选择的表层身份（外表人物），包含背景故事和外在特质
// 用于第二步"双重身份"系统
// ============================================================

import { CHARACTER_IDENTITIES, TRAIT_TYPES } from './constants.js';

export class Character {
  /**
   * @param {string} characterId — 如 'SIGURD', 'FREYJA' 等
   */
  constructor(characterId) {
    const def = CHARACTER_IDENTITIES[characterId];
    if (!def) {
      throw new Error(`Unknown character identity: ${characterId}`);
    }

    this.id = def.id;
    this.name = def.name;
    this.title = def.title;
    this.origin = def.origin;
    this.gender = def.gender;
    this.story = def.story;
    this.externalTraits = def.externalTraits.map(t => ({ ...t })); // 浅拷贝
    this.recommendedHiddenRoles = [...def.recommendedHiddenRoles];

    // 运行时状态
    this.traitCooldowns = {};    // {traitName: remainingTurns}
    this.activeTraitUses = {};   // {traitName: timesUsedThisGame}
  }

  /**
   * 获取所有主动特质
   */
  getActiveTraits() {
    return this.externalTraits.filter(t => t.type === TRAIT_TYPES.ACTIVE);
  }

  /**
   * 获取所有被动特质
   */
  getPassiveTraits() {
    return this.externalTraits.filter(t =>
      t.type === TRAIT_TYPES.PASSIVE || t.type === TRAIT_TYPES.SURVIVAL
    );
  }

  /**
   * 获取所有弱点特质
   */
  getWeaknessTraits() {
    return this.externalTraits.filter(t => t.type === TRAIT_TYPES.WEAKNESS);
  }

  /**
   * 获取社交特质
   */
  getSocialTraits() {
    return this.externalTraits.filter(t => t.type === TRAIT_TYPES.SOCIAL);
  }

  /**
   * 检查特质是否在冷却中
   */
  isOnCooldown(traitName) {
    return (this.traitCooldowns[traitName] || 0) > 0;
  }

  /**
   * 设置特质冷却
   */
  setCooldown(traitName, turns) {
    this.traitCooldowns[traitName] = turns;
  }

  /**
   * 使用特质（记录使用次数+设置冷却）
   */
  useTrait(traitName, cooldownTurns = 0) {
    this.activeTraitUses[traitName] = (this.activeTraitUses[traitName] || 0) + 1;
    if (cooldownTurns > 0) {
      this.setCooldown(traitName, cooldownTurns);
    }
  }

  /**
   * 每回合冷却-1
   */
  tickCooldowns() {
    for (const key of Object.keys(this.traitCooldowns)) {
      if (this.traitCooldowns[key] > 0) {
        this.traitCooldowns[key]--;
      }
    }
  }

  /**
   * 获取特质摘要（供客户端展示）
   */
  getTraitSummaries() {
    return this.externalTraits.map(t => ({
      name: t.name,
      type: t.type,
      effect: t.effect,
      icon: t.icon,
      onCooldown: this.isOnCooldown(t.name),
      cooldownRemaining: this.traitCooldowns[t.name] || 0,
      timesUsed: this.activeTraitUses[t.name] || 0,
    }));
  }

  /**
   * 序列化为JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      title: this.title,
      origin: this.origin,
      gender: this.gender,
      story: this.story,
      traits: this.getTraitSummaries(),
      recommendedHiddenRoles: this.recommendedHiddenRoles,
    };
  }

  /**
   * 获取简短描述（选人界面用）
   */
  getShortDescription() {
    const activeCount = this.getActiveTraits().length;
    const weaknessCount = this.getWeaknessTraits().length;
    return `${this.title} | ${this.origin} | ${activeCount}主动/${weaknessCount}弱点`;
  }
}

/**
 * 根据推荐度匹配表层身份和里层身份
 * @param {string} hiddenRole — 里层身份（如'HUNTER'）
 * @param {string[]} availableCharacters — 尚未被选走的表层身份ID列表
 * @returns {string|null} 推荐的characterId，或null
 */
export function matchCharacterToRole(hiddenRole, availableCharacters) {
  if (!availableCharacters || availableCharacters.length === 0) return null;

  // 优先推荐匹配的
  const recommended = availableCharacters.filter(cid => {
    const def = CHARACTER_IDENTITIES[cid];
    return def && def.recommendedHiddenRoles.includes(hiddenRole);
  });

  if (recommended.length > 0) {
    // 随机选一个推荐的（增加变数）
    return recommended[Math.floor(Math.random() * recommended.length)];
  }

  // 无推荐则随机分配
  return availableCharacters[Math.floor(Math.random() * availableCharacters.length)];
}
