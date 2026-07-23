// ============================================================
// 用户管理器 — JSON文件存储，注册/登录/统计/游戏回放
// ============================================================

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 数据目录：优先用同级的 data/，回退到模块上两级（兼容 src/auth → server/data）
function resolveDataDir() {
  const candidates = [
    path.join(__dirname, '..', 'data'),                  // auth/../data → server/data (生产 + 开发)
    path.join(__dirname, '..', '..', 'data'),            // auth/../../data → project/data (兜底)
    path.join(__dirname, 'data'),                        // auth/data (最后兜底)
  ];
  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch (e) { /* try next */ }
  }
  // 最后的兜底
  const fallback = path.join(__dirname, '..', '..', 'data');
  try { fs.mkdirSync(fallback, { recursive: true }); } catch (e) {}
  return fallback;
}

const DATA_DIR = resolveDataDir();
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const REPLAYS_FILE = path.join(DATA_DIR, 'replays.json');
const USER_SALT = process.env.USER_PASSWORD_SALT || 'veilland-user-salt-2.13';
const MAX_REPLAYS_PER_USER = 5;

export class UserManager {
  constructor() {
    this.users = new Map();     // username -> user object
    this.sessions = new Map();  // socketId -> username
    this.replays = {};          // username -> [replay objects]
    this._writeQueue = Promise.resolve(); // 写队列，串行化避免并发损坏
    this._savePending = false;
    this._replaySavePending = false;
    this._ensureDataDir();
    this._load();
  }

  _ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  _load() {
    // 加载用户
    try {
      if (fs.existsSync(USERS_FILE)) {
        const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
        for (const [name, user] of Object.entries(data)) {
          this.users.set(name, user);
        }
        console.log(`[用户] 已加载 ${this.users.size} 个用户`);
      }
    } catch (e) {
      console.error('[用户] 加载失败:', e.message);
    }
    // 加载回放
    try {
      if (fs.existsSync(REPLAYS_FILE)) {
        this.replays = JSON.parse(fs.readFileSync(REPLAYS_FILE, 'utf-8'));
        console.log(`[回放] 已加载回放数据`);
      }
    } catch (e) {
      console.error('[回放] 加载失败:', e.message);
      this.replays = {};
    }
  }

  _save() {
    if (this._savePending) return;
    this._savePending = true;
    this._writeQueue = this._writeQueue.then(() => {
      try {
        const data = {};
        for (const [name, user] of this.users) {
          data[name] = user;
        }
        fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
      } catch (e) {
        console.error('[用户] 保存失败:', e.message);
      } finally {
        this._savePending = false;
      }
    });
  }

  _saveReplays() {
    if (this._replaySavePending) return;
    this._replaySavePending = true;
    this._writeQueue = this._writeQueue.then(() => {
      try {
        fs.writeFileSync(REPLAYS_FILE, JSON.stringify(this.replays, null, 2), 'utf-8');
      } catch (e) {
        console.error('[回放] 保存失败:', e.message);
      } finally {
        this._replaySavePending = false;
      }
    });
  }

  hashPassword(password) {
    return crypto.createHmac('sha256', USER_SALT).update(password).digest('hex');
  }

  // ==================== 注册 ====================
  register(username, password) {
    if (!username || typeof username !== 'string') return { error: '用户名格式不合法' };
    const name = username.trim();
    if (name.length < 2 || name.length > 12) return { error: '用户名需2-12个字符' };
    if (/[<>"'&/\\]/.test(name)) return { error: '用户名包含非法字符' };
    if (this.users.has(name)) return { error: '用户名已被注册' };

    if (!password || typeof password !== 'string' || password.length < 4) {
      return { error: '密码至少需要4个字符' };
    }

    const user = {
      username: name,
      password: this.hashPassword(password),
      createdAt: Date.now(),
      stats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
      },
      lastLogin: null,
    };

    this.users.set(name, user);
    this._save();
    console.log(`[用户] 注册: ${name}`);
    return { success: true, user: { username: name, stats: user.stats } };
  }

  // ==================== 登录 ====================
  login(username, password) {
    const name = username?.trim();
    if (!name) return { error: '请输入用户名' };

    const user = this.users.get(name);
    if (!user) return { error: '用户名不存在' };

    const hashed = this.hashPassword(password || '');
    if (user.password !== hashed) return { error: '密码错误' };

    user.lastLogin = Date.now();
    this._save();
    console.log(`[用户] 登录: ${name}`);
    return {
      success: true,
      user: {
        username: name,
        stats: user.stats,
        createdAt: user.createdAt,
      },
    };
  }

  // ==================== 会话管理 ====================
  setSession(socketId, username) {
    this.sessions.set(socketId, username);
  }

  getUserBySocket(socketId) {
    const name = this.sessions.get(socketId);
    if (!name) return null;
    return this.users.get(name) || null;
  }

  clearSession(socketId) {
    this.sessions.delete(socketId);
  }

  // ==================== 统计 ====================
  updateStats(username, won) {
    const user = this.users.get(username);
    if (!user) return;
    user.stats.gamesPlayed++;
    if (won) user.stats.wins++;
    else user.stats.losses++;
    user.stats.winRate = user.stats.gamesPlayed > 0
      ? Math.round((user.stats.wins / user.stats.gamesPlayed) * 100)
      : 0;
    this._save();
  }

  // ==================== 游戏回放 ====================
  /**
   * 保存一场游戏回放
   * replayData: { roomId, winner, reason, players: [{name, role, alive, team}], round, date }
   */
  saveGameReplay(replayData) {
    if (!replayData || !replayData.players) return;

    for (const p of replayData.players) {
      // 只储存已注册用户
      if (!this.users.has(p.name)) continue;

      if (!this.replays[p.name]) {
        this.replays[p.name] = [];
      }

      const entry = {
        roomId: replayData.roomId,
        winner: replayData.winner,
        reason: replayData.reason,
        myRole: p.role,
        myTeam: p.team,
        alive: p.alive,
        totalPlayers: replayData.players.length,
        round: replayData.round || 1,
        players: replayData.players.map(pl => ({
          name: pl.name,
          role: pl.role,
          alive: pl.alive,
        })),
        date: replayData.date || Date.now(),
      };

      this.replays[p.name].unshift(entry);

      // 保留最近5场
      if (this.replays[p.name].length > MAX_REPLAYS_PER_USER) {
        this.replays[p.name] = this.replays[p.name].slice(0, MAX_REPLAYS_PER_USER);
      }
    }

    this._saveReplays();
    console.log(`[回放] 已保存房间 ${replayData.roomId} 的回放 (${replayData.players.length} 名玩家)`);
  }

  // 获取用户回放列表
  getReplays(username) {
    return this.replays[username] || [];
  }

  // ==================== 用户信息 ====================
  getProfile(username) {
    const user = this.users.get(username);
    if (!user) return null;
    return {
      username: user.username,
      stats: { ...user.stats },
      createdAt: user.createdAt,
      replays: this.getReplays(username),
    };
  }
}
