// ============================================================
// RankManager.js — 排位系统管理器
// 处理: MMR更新/段位晋升降级/排行榜/排位赛结算
// ============================================================

import { ELOCalculator } from './ELOCalculator.js';

export class RankManager {
  constructor(dbManager) {
    this.db = dbManager;
  }

  /**
   * 处理一局排位赛结果
   */
  async processRankedMatch(matchData) {
    const { winnerTeam, players, hasBots } = matchData;
    const results = [];

    // 分组
    const winners = players.filter(p => p.team === winnerTeam);
    const losers = players.filter(p => p.team !== winnerTeam);
    const enemyMMRs = losers.map(p => this._getPlayerMMR(p) || 1000);

    for (const player of players) {
      if (player.isBot) continue;

      const won = player.team === winnerTeam;
      const user = this.db.getUser(player.username);
      if (!user?.ranked) continue;

      const delta = ELOCalculator.calculateMMRChange({
        playerMMR: user.ranked.mmr || 1000,
        enemyMMRs: won ? enemyMMRs : winners.map(p => this._getPlayerMMR(p) || 1000),
        won,
        gamesPlayed: user.ranked.gamesPlayed || 0,
        totalPlayers: players.length,
        hasBots: !!hasBots,
        rolePerf: player.perf || {},
        role: player.role,
      });

      const newMMR = (user.ranked.mmr || 1000) + delta;
      const newTier = ELOCalculator.getTier(newMMR);
      const newDivision = ELOCalculator.getDivision(newMMR);

      // 晋升/降级检测
      const oldTier = user.ranked.tier || 'BRONZE';
      const tierChanged = newTier !== oldTier;

      // 降级保护
      let finalTier = newTier;
      let finalMMR = newMMR;
      if (tierChanged && this._isDemotion(oldTier, newTier) && (user.ranked.demotionShield || 0) > 0) {
        finalTier = oldTier;
        user.ranked.demotionShield--;
      } else if (tierChanged && this._isPromotion(oldTier, newTier)) {
        user.ranked.demotionShield = 3; // 晋升后3局保护
      }

      // 保存
      await this.db.updateRankedStats(player.username, delta, won, finalTier, newDivision);

      results.push({
        username: player.username,
        role: player.role,
        mmrChange: delta,
        newMMR: finalMMR,
        tier: finalTier,
        division: newDivision,
        tierChanged,
        won,
      });
    }

    // 保存比赛记录
    await this.db.saveMatch({
      roomCode: matchData.roomCode,
      matchType: matchData.matchType || 'RANKED',
      winnerTeam,
      totalPlayers: players.length,
      timestamp: Date.now(),
      players: players.map(p => ({ username: p.username, role: p.role, team: p.team, won: p.team === winnerTeam })),
    });

    return results;
  }

  /** 获取排行榜 */
  getLeaderboard(limit = 100, offset = 0) {
    return this.db.getLeaderboard(limit, offset);
  }

  /** 获取灵格排行榜 */
  getSpiritLeaderboard(limit = 100) {
    return this.db.getLeaderboardBySpiritGrade(limit);
  }

  /** 获取玩家档案 */
  getPlayerProfile(username) {
    const user = this.db.getUser(username);
    if (!user) return null;
    return {
      username,
      stats: user.stats,
      spiritGrade: user.spiritGrade,
      ranked: user.ranked,
      roleStats: user.roleStats,
    };
  }

  _getPlayerMMR(player) {
    if (!player || !player.username) return 1000;
    const user = this.db.getUser(player.username);
    return user?.ranked?.mmr || 1000;
  }

  _isPromotion(oldTier, newTier) {
    const order = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'LEGEND'];
    return order.indexOf(newTier) > order.indexOf(oldTier);
  }

  _isDemotion(oldTier, newTier) {
    return this._isPromotion(newTier, oldTier);
  }
}
