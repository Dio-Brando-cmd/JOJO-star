// ============================================================
// 用户管理器 — SQLite 存储（2026-09-20 从 JSON 迁移）
// 注册/登录/统计/游戏回放。SQLite(WAL) 保证原子性、可查询、抗损坏。
// 旧 JSON (users.json/replays.json) 首次启动自动迁移进 SQLite 并备份 .bak。
// ============================================================

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
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
  const fallback = path.join(__dirname, '..', '..', 'data');
  try { fs.mkdirSync(fallback, { recursive: true }); } catch (e) {}
  return fallback;
}

// 允许通过环境变量覆盖数据目录（部署/测试用）
const DATA_DIR = process.env.VEILLAND_DATA_DIR || resolveDataDir();
const DB_FILE = path.join(DATA_DIR, 'veilland.db');
const USERS_FILE = path.join(DATA_DIR, 'users.json');      // 旧数据，仅迁移用
const REPLAYS_FILE = path.join(DATA_DIR, 'replays.json');  // 旧数据，仅迁移用
const USER_SALT = process.env.USER_PASSWORD_SALT || 'veilland-user-salt-2.13';
const MAX_REPLAYS_PER_USER = 5;
const BCRYPT_COST = 10;   // bcrypt 计算成本（10 = 默认，约 50-100ms/次）

export class UserManager {
  constructor() {
    this.sessions = new Map();  // socketId -> username（内存态，不持久化）
    this.db = new Database(DB_FILE);
    this.db.pragma('journal_mode = WAL');
    this._initSchema();
    this._migrateFromJson();
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS replays (
        username TEXT PRIMARY KEY,
        data TEXT NOT NULL DEFAULT '[]'
      );
    `);
  }

  // 一次性迁移：users.json / replays.json → SQLite（仅当 users 表为空时）
  _migrateFromJson() {
    const { n } = this.db.prepare('SELECT COUNT(*) AS n FROM users').get();
    if (n > 0) return;

    let migrated = 0;

    if (fs.existsSync(USERS_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
        const insert = this.db.prepare(
          'INSERT OR IGNORE INTO users (username, password_hash, data) VALUES (?, ?, ?)'
        );
        const tx = this.db.transaction((entries) => {
          for (const [name, user] of Object.entries(entries)) {
            const { password, username, ...rest } = user;
            insert.run(name, password || '', JSON.stringify(rest));
          }
        });
        tx(data);
        migrated = Object.keys(data).length;
      } catch (e) {
        console.error('[用户] 迁移 users.json 失败:', e.message);
      }
    }

    if (fs.existsSync(REPLAYS_FILE)) {
      try {
        const replays = JSON.parse(fs.readFileSync(REPLAYS_FILE, 'utf-8'));
        const insert = this.db.prepare(
          'INSERT OR IGNORE INTO replays (username, data) VALUES (?, ?)'
        );
        const tx = this.db.transaction((entries) => {
          for (const [name, list] of Object.entries(entries)) {
            insert.run(name, JSON.stringify(list));
          }
        });
        tx(replays);
      } catch (e) {
        console.error('[用户] 迁移 replays.json 失败:', e.message);
      }
    }

    if (migrated > 0) {
      console.log(`[用户] 已从 JSON 迁移到 SQLite (${migrated} 用户)`);
      // 迁移成功后备份旧 JSON，避免下次误判 + 可回滚
      try {
        if (fs.existsSync(USERS_FILE)) fs.copyFileSync(USERS_FILE, USERS_FILE + '.bak');
        if (fs.existsSync(REPLAYS_FILE)) fs.copyFileSync(REPLAYS_FILE, REPLAYS_FILE + '.bak');
      } catch (e) { /* 备份失败不阻塞 */ }
    }
  }

  hashPassword(password) {
    return crypto.createHmac('sha256', USER_SALT).update(password).digest('hex');
  }

  _getRow(username) {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
  }

  _userFromRow(row) {
    let data = {};
    try { data = JSON.parse(row.data || '{}'); } catch (e) {}
    return { username: row.username, ...data };
  }

  // 读-改-写一个用户（返回是否找到）
  _updateUser(username, mutate) {
    const row = this._getRow(username);
    if (!row) return false;
    const user = this._userFromRow(row);
    mutate(user);
    this.db.prepare('UPDATE users SET data = ? WHERE username = ?')
      .run(JSON.stringify(user), username);
    return true;
  }

  // ==================== 注册 ====================
  async register(username, password) {
    if (!username || typeof username !== 'string') return { error: '用户名格式不合法' };
    const name = username.trim();
    if (name.length < 2 || name.length > 12) return { error: '用户名需2-12个字符' };
    if (/[<>"'&/\\]/.test(name)) return { error: '用户名包含非法字符' };
    if (this._getRow(name)) return { error: '用户名已被注册' };

    if (!password || typeof password !== 'string' || password.length < 6) {
      return { error: '密码至少需要6个字符' };
    }

    const stats = { gamesPlayed: 0, wins: 0, losses: 0, winRate: 0 };
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    this.db.prepare('INSERT INTO users (username, password_hash, data) VALUES (?, ?, ?)')
      .run(name, hash, JSON.stringify({ createdAt: Date.now(), lastLogin: null, stats }));

    console.log(`[用户] 注册: ${name}`);
    return { success: true, user: { username: name, stats } };
  }

  // ==================== 登录 ====================
  async login(username, password) {
    const name = username?.trim();
    if (!name) return { error: '请输入用户名' };

    const row = this._getRow(name);
    if (!row) return { error: '用户名不存在' };

    // 旧版哈希是 HMAC-SHA256（64位hex），新版是 bcrypt（$2 开头）
    let ok = false;
    if (row.password_hash.startsWith('$2')) {
      ok = await bcrypt.compare(password || '', row.password_hash);
    } else {
      ok = row.password_hash === this.hashPassword(password || '');
      if (ok) {
        // 旧哈希验证通过 → 就地升级为 bcrypt（下次登录走 bcrypt 分支）
        const newHash = await bcrypt.hash(password, BCRYPT_COST);
        this.db.prepare('UPDATE users SET password_hash = ? WHERE username = ?')
          .run(newHash, name);
      }
    }
    if (!ok) return { error: '密码错误' };

    const user = this._userFromRow(row);
    user.lastLogin = Date.now();
    this.db.prepare('UPDATE users SET data = ? WHERE username = ?')
      .run(JSON.stringify(user), name);

    console.log(`[用户] 登录: ${name}`);
    return { success: true, user: { username: name, stats: user.stats, createdAt: user.createdAt } };
  }

  // ==================== 会话管理 ====================
  setSession(socketId, username) {
    this.sessions.set(socketId, username);
  }

  getUserBySocket(socketId) {
    const name = this.sessions.get(socketId);
    if (!name) return null;
    const row = this._getRow(name);
    return row ? this._userFromRow(row) : null;
  }

  clearSession(socketId) {
    this.sessions.delete(socketId);
  }

  // ==================== 统计 ====================
  updateStats(username, won) {
    this._updateUser(username, (user) => {
      if (!user.stats) user.stats = { gamesPlayed: 0, wins: 0, losses: 0, winRate: 0 };
      user.stats.gamesPlayed++;
      if (won === true) user.stats.wins++; else user.stats.losses++;
      user.stats.winRate = user.stats.gamesPlayed > 0
        ? Math.round((user.stats.wins / user.stats.gamesPlayed) * 100)
        : 0;
    });
  }

  // ==================== 游戏回放 ====================
  saveGameReplay(replayData) {
    if (!replayData || !replayData.players) return;

    const upsert = this.db.prepare(
      'INSERT INTO replays (username, data) VALUES (?, ?) ' +
      'ON CONFLICT(username) DO UPDATE SET data = excluded.data'
    );
    const getRow = this.db.prepare('SELECT data FROM replays WHERE username = ?');

    const tx = this.db.transaction(() => {
      for (const p of replayData.players) {
        // 只储存已注册用户
        if (!this._getRow(p.name)) continue;

        const existing = [];
        const row = getRow.get(p.name);
        if (row) { try { existing.push(...JSON.parse(row.data)); } catch (e) {} }

        const entry = {
          roomId: replayData.roomId,
          winner: replayData.winner,
          reason: replayData.reason,
          myRole: p.role,
          myTeam: p.team,
          alive: p.alive,
          totalPlayers: replayData.players.length,
          round: replayData.round || 1,
          players: replayData.players.map(pl => ({ name: pl.name, role: pl.role, alive: pl.alive })),
          date: replayData.date || Date.now(),
        };

        existing.unshift(entry);
        if (existing.length > MAX_REPLAYS_PER_USER) existing.length = MAX_REPLAYS_PER_USER;
        upsert.run(p.name, JSON.stringify(existing));
      }
    });
    tx();

    console.log(`[回放] 已保存房间 ${replayData.roomId} 的回放 (${replayData.players.length} 名玩家)`);
  }

  // 获取用户回放列表
  getReplays(username) {
    const row = this.db.prepare('SELECT data FROM replays WHERE username = ?').get(username);
    if (!row) return [];
    try { return JSON.parse(row.data); } catch (e) { return []; }
  }

  // ==================== 用户信息 ====================
  getProfile(username) {
    const row = this._getRow(username);
    if (!row) return null;
    const user = this._userFromRow(row);
    return {
      username: user.username,
      stats: { ...(user.stats || {}) },
      createdAt: user.createdAt,
      replays: this.getReplays(username),
    };
  }
}
