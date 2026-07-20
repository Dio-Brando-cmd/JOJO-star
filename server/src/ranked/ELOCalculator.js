// ============================================================
// ELOCalculator.js — MMR/ELO 计算引擎
// 核心: 基于团队胜负 + 个人贡献的MMR变化计算
// ============================================================

import { ROLES } from '../game/constants.js';

export class ELOCalculator {
  /**
   * 计算单局MMR变化
   * @param {number} playerMMR - 当前MMR
   * @param {number[]} enemyMMRs - 敌方队伍MMR列表
   * @param {boolean} won - 是否胜利
   * @param {number} gamesPlayed - 已参与的排位赛局数
   * @param {number} totalPlayers - 本局总玩家数
   * @param {boolean} hasBots - 是否有AI
   * @param {object} rolePerf - { kills, livesSaved, correctChecks, correctVotes, survived }
   * @param {string} role - 使用的角色
   * @returns {number} MMR变化值 [-150, +150]
   */
  static calculateMMRChange({ playerMMR, enemyMMRs, won, gamesPlayed,
    totalPlayers = 12, hasBots = false, rolePerf = {}, role }) {

    // 敌方平均MMR
    const avgEnemyMMR = enemyMMRs.length > 0
      ? enemyMMRs.reduce((a, b) => a + b, 0) / enemyMMRs.length
      : playerMMR;

    // 预期胜率 (ELO公式)
    const expectedScore = 1 / (1 + Math.pow(10, (avgEnemyMMR - playerMMR) / 400));

    // K因子 (渐进降低)
    const K = this.getKFactor(gamesPlayed);

    // 匹配系数
    const matchFactor = this.getMatchFactor(totalPlayers, hasBots);

    // 角色加成
    const roleBonus = this.getRoleBonus(role, rolePerf);

    // 基础变化
    const actualScore = won ? 1.0 : 0.0;
    let delta = K * (actualScore - expectedScore) * matchFactor * roleBonus;

    // Placement阶段加速 (前5局)
    if (!won && gamesPlayed < 5) {
      delta *= 0.5; // 输了扣一半
    }

    // 钳制
    delta = Math.max(-150, Math.min(150, Math.round(delta)));

    return delta;
  }

  /** K因子: 场次越多变化越小 */
  static getKFactor(gamesPlayed) {
    if (gamesPlayed < 10) return 60;    // 定级
    if (gamesPlayed < 30) return 50;
    if (gamesPlayed < 100) return 40;
    return 30;                           // 稳定期
  }

  /** 匹配系数: 人少/有AI降低权重 */
  static getMatchFactor(totalPlayers, hasBots) {
    let factor = 1.0;
    if (totalPlayers < 8) factor *= 0.85;
    if (hasBots) factor *= 0.90;
    return factor;
  }

  /** 角色加成: 基于个人表现微调 */
  static getRoleBonus(role, perf) {
    let bonus = 1.0;
    if (!perf) return bonus;

    switch (role) {
      case ROLES.WEREWOLF:
      case ROLES.ALPHA_WOLF:
        bonus += (perf.kills || 0) * 0.02;
        if (perf.survived) bonus += 0.02;
        break;
      case ROLES.SEER:
        bonus += (perf.correctChecks || 0) * 0.03;
        break;
      case ROLES.GUARD:
        bonus += (perf.livesSaved || 0) * 0.04;
        break;
      case ROLES.HUNTER:
        bonus += (perf.kills || 0) * 0.04;
        break;
      case ROLES.POISON_WITCH:
      case ROLES.HEAL_WITCH:
        bonus += (perf.kills || 0) * 0.03;
        bonus += (perf.livesSaved || 0) * 0.03;
        break;
      case ROLES.VILLAGER:
        bonus += (perf.correctVotes || 0) * 0.02;
        break;
    }
    return Math.min(1.2, Math.max(0.9, bonus));
  }

  /** MMR → 段位 */
  static getTier(mmr) {
    if (mmr >= 8000) return 'LEGEND';
    if (mmr >= 6500) return 'DIAMOND';
    if (mmr >= 5000) return 'PLATINUM';
    if (mmr >= 3500) return 'GOLD';
    if (mmr >= 2000) return 'SILVER';
    return 'BRONZE';
  }

  /** MMR → 小段 */
  static getDivision(mmr) {
    const tierMin = {
      BRONZE: 0, SILVER: 2000, GOLD: 3500,
      PLATINUM: 5000, DIAMOND: 6500, LEGEND: 8000,
    };
    const tier = this.getTier(mmr);
    const base = tierMin[tier] || 0;
    const offset = mmr - base;
    if (offset >= 1000) return 'I';
    if (offset >= 500) return 'II';
    return 'III';
  }

  /** 段位+小段 → MMR范围 */
  static getMMRRange(tier, division) {
    const base = {
      BRONZE: 0, SILVER: 2000, GOLD: 3500,
      PLATINUM: 5000, DIAMOND: 6500, LEGEND: 8000,
    };
    const min = (base[tier] || 0) + { III: 0, II: 500, I: 1000 }[division];
    const max = min + 499;
    return { min, max };
  }
}
