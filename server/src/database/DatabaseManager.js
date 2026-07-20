// ============================================================
// DatabaseManager.js — 数据持久化层
// 当前: JSON文件 + 写队列(原子写入) | 后续: SQLite迁移
// 设计: 接口与SQLite兼容, 迁移时改实现即可
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class DatabaseManager {
  constructor(dataDir) {
    this.dataDir = dataDir || path.join(__dirname, '..', 'data');
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });

    this._writeQueue = Promise.resolve(); // 串行写队列
    this._cache = {};                      // 内存缓存
  }

  // ---- 原子写入 ----
  async _atomicWrite(filename, data) {
    const filepath = path.join(this.dataDir, filename);
    const tmp = filepath + '.tmp';
    const bak = filepath + '.bak';

    // 串行化: 防止并发写损坏
    this._writeQueue = this._writeQueue.then(async () => {
      try {
        // 写临时文件
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
        // 备份旧文件
        if (fs.existsSync(filepath)) fs.copyFileSync(filepath, bak);
        // 原子替换
        fs.renameSync(tmp, filepath);
      } catch (e) {
        console.error(`[DB] Write failed for ${filename}:`, e.message);
        // 回退
        if (fs.existsSync(bak)) fs.copyFileSync(bak, filepath);
        throw e;
      }
    });
    return this._writeQueue;
  }

  _readJSON(filename, defaultValue = {}) {
    const filepath = path.join(this.dataDir, filename);
    try {
      if (!fs.existsSync(filepath)) return defaultValue;
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch (e) {
      console.error(`[DB] Read failed for ${filename}:`, e.message);
      return defaultValue;
    }
  }

  // ==================== 用户 ====================

  getUsers() {
    if (!this._cache.users) this._cache.users = this._readJSON('users.json', {});
    return this._cache.users;
  }

  async saveUsers(users) {
    this._cache.users = users;
    await this._atomicWrite('users.json', users);
  }

  getUser(username) {
    return this.getUsers()[username] || null;
  }

  async createUser(username, passwordHash) {
    const users = this.getUsers();
    if (users[username]) return null;
    users[username] = {
      username,
      password: passwordHash,
      createdAt: Date.now(),
      stats: { gamesPlayed: 0, wins: 0, losses: 0, winRate: 0 },
      // v2.9: 灵格系统
      spiritGrade: { grade: 'MORTAL', score: 0, peak: 0 },
      // v2.9: 排位数据
      ranked: { mmr: 1000, peakMmr: 1000, tier: 'BRONZE', division: 'III',
                gamesPlayed: 0, wins: 0, losses: 0,
                placementComplete: false, placementWins: 0, placementLosses: 0,
                demotionShield: 0 },
      seasonStats: {},
      roleStats: {},
      lastLogin: Date.now(),
    };
    await this.saveUsers(users);
    return users[username];
  }

  async updateUserStats(username, won) {
    const users = this.getUsers();
    const u = users[username];
    if (!u) return;
    u.stats.gamesPlayed++;
    if (won) u.stats.wins++; else u.stats.losses++;
    u.stats.winRate = Math.round((u.stats.wins / u.stats.gamesPlayed) * 100);

    // 更新灵格分数
    const delta = won ? 25 : -15;
    if (!u.spiritGrade) u.spiritGrade = { grade: 'MORTAL', score: 0, peak: 0 };
    u.spiritGrade.score = Math.max(0, (u.spiritGrade.score || 0) + delta);
    if (u.spiritGrade.score > (u.spiritGrade.peak || 0)) u.spiritGrade.peak = u.spiritGrade.score;
    u.spiritGrade.grade = this._computeSpiritGrade(u.spiritGrade.score);

    await this.saveUsers(users);
  }

  async updateRankedStats(username, mmrChange, won, tier, division) {
    const users = this.getUsers();
    const u = users[username];
    if (!u || !u.ranked) return;
    u.ranked.gamesPlayed++;
    if (won) u.ranked.wins++; else u.ranked.losses++;
    u.ranked.mmr = Math.max(0, (u.ranked.mmr || 1000) + mmrChange);
    if (u.ranked.mmr > (u.ranked.peakMmr || 1000)) u.ranked.peakMmr = u.ranked.mmr;
    if (tier) u.ranked.tier = tier;
    if (division) u.ranked.division = division;

    // Placement
    if (!u.ranked.placementComplete && u.ranked.gamesPlayed >= 5) {
      u.ranked.placementComplete = true;
    }

    await this.saveUsers(users);
  }

  async updateRoleStats(username, role, won, contribution) {
    const users = this.getUsers();
    const u = users[username];
    if (!u) return;
    if (!u.roleStats) u.roleStats = {};
    if (!u.roleStats[role]) {
      u.roleStats[role] = { played: 0, wins: 0, killsScored: 0, livesSaved: 0, correctChecks: 0, contribution: 0 };
    }
    u.roleStats[role].played++;
    if (won) u.roleStats[role].wins++;
    u.roleStats[role].contribution += contribution || 0;
    await this.saveUsers(users);
  }

  // ==================== 匹配 ====================

  getMatchHistory() {
    return this._readJSON('matches.json', []);
  }

  async saveMatch(matchData) {
    const matches = this.getMatchHistory();
    matches.push(matchData);
    // 只保留最近 200 场
    if (matches.length > 200) matches.splice(0, matches.length - 200);
    await this._atomicWrite('matches.json', matches);
  }

  getMatchmakingQueue() {
    return this._readJSON('matchmaking_queue.json', { queue: [] });
  }

  async saveMatchmakingQueue(queue) {
    await this._atomicWrite('matchmaking_queue.json', { queue });
  }

  // ==================== 赛季 ====================

  getSeasonData() {
    return this._readJSON('seasons.json', {
      current: { id: 1, name: '第一赛季: 帷幕初开', number: 1, startDate: Date.now(), isActive: true },
      history: [],
    });
  }

  async saveSeasonData(data) {
    await this._atomicWrite('seasons.json', data);
  }

  // ==================== 排行榜 ====================

  getLeaderboard(limit = 100, offset = 0) {
    const users = this.getUsers();
    const entries = Object.values(users)
      .filter(u => u.ranked && u.ranked.gamesPlayed >= 5)
      .map(u => ({
        username: u.username,
        mmr: u.ranked?.mmr || 1000,
        tier: u.ranked?.tier || 'BRONZE',
        division: u.ranked?.division || 'III',
        gamesPlayed: u.ranked?.gamesPlayed || 0,
        winRate: u.ranked?.gamesPlayed > 0
          ? Math.round((u.ranked.wins / u.ranked.gamesPlayed) * 100) : 0,
      }))
      .sort((a, b) => b.mmr - a.mmr);

    return entries.slice(offset, offset + limit);
  }

  getLeaderboardBySpiritGrade(limit = 100) {
    const users = this.getUsers();
    return Object.values(users)
      .filter(u => u.spiritGrade && u.spiritGrade.score > 0)
      .map(u => ({
        username: u.username,
        grade: u.spiritGrade?.grade || 'MORTAL',
        score: u.spiritGrade?.score || 0,
        peak: u.spiritGrade?.peak || 0,
        gamesPlayed: u.stats?.gamesPlayed || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ==================== 灵格计算 ====================

  _computeSpiritGrade(score) {
    if (score >= 5500) return 'LEGENDARY';
    if (score >= 3500) return 'DIVINE';
    if (score >= 2000) return 'HEROIC';
    if (score >= 1000) return 'AWAKENED';
    return 'MORTAL';
  }
}
