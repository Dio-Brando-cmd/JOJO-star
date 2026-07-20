// ============================================================
// SeasonManager.js — 赛季管理器
// 赛季: 3个月周期，软重置MMR，奖励结算
// ============================================================

export class SeasonManager {
  constructor(dbManager) {
    this.db = dbManager;
    this.SEASON_DURATION_MS = 90 * 24 * 60 * 60 * 1000; // 90天
  }

  /** 初始化第一个赛季 */
  initializeFirstSeason() {
    const data = this.db.getSeasonData();
    if (!data.current || !data.current.id) {
      data.current = {
        id: 1,
        name: '第一赛季: 帷幕初开',
        number: 1,
        startDate: Date.now(),
        isActive: true,
      };
      data.history = [];
      this.db.saveSeasonData(data);
    }
    return data.current;
  }

  /** 获取当前赛季 */
  getCurrentSeason() {
    return this.db.getSeasonData().current;
  }

  /** 检查赛季是否到期 */
  checkSeasonExpiry() {
    const data = this.db.getSeasonData();
    const season = data.current;
    if (!season || !season.isActive) return false;

    if (Date.now() - season.startDate > this.SEASON_DURATION_MS) {
      this._endSeason(data);
      this._startNewSeason(data);
      return true;
    }
    return false;
  }

  /** 开始新赛季 */
  startNewSeason(name) {
    const data = this.db.getSeasonData();
    if (data.current?.isActive) {
      this._endSeason(data);
    }
    this._startNewSeason(data, name);
    return data.current;
  }

  _endSeason(data) {
    const season = data.current;
    season.endDate = Date.now();
    season.isActive = false;
    data.history.push({ ...season });
  }

  _startNewSeason(data, name) {
    const newNumber = (data.current?.number || 0) + 1;
    data.current = {
      id: newNumber,
      name: name || `第${newNumber}赛季`,
      number: newNumber,
      startDate: Date.now(),
      isActive: true,
    };

    // 软重置所有玩家MMR
    const users = this.db.getUsers();
    for (const username of Object.keys(users)) {
      const u = users[username];
      if (u.ranked) {
        // 软重置: MMR向1000压缩75%
        u.ranked.mmr = Math.round(1000 + (u.ranked.mmr - 1000) * 0.75);
        u.ranked.tier = 'BRONZE';
        u.ranked.division = 'III';
        u.ranked.gamesPlayed = 0;
        u.ranked.wins = 0;
        u.ranked.losses = 0;
        u.ranked.placementComplete = false;
        u.ranked.demotionShield = 5;
      }
    }
    this.db.saveUsers(users);
    this.db.saveSeasonData(data);
  }

  /** 获取所有赛季 */
  getSeasonHistory() {
    const data = this.db.getSeasonData();
    return {
      current: data.current,
      history: data.history || [],
    };
  }
}
