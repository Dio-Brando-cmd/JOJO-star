// ============================================================
// 用户管理器 — JSON文件存储，注册/登录/统计
// ============================================================

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const USER_SALT = 'werewolf-user-salt-2024-v2';

export class UserManager {
  constructor() {
    this.users = new Map(); // username -> user object
    this.sessions = new Map(); // socketId -> username
    this._ensureDataDir();
    this._load();
  }

  _ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  _load() {
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
  }

  _save() {
    try {
      const data = {};
      for (const [name, user] of this.users) {
        data[name] = user;
      }
      fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[用户] 保存失败:', e.message);
    }
  }

  hashPassword(password) {
    return crypto.createHmac('sha256', USER_SALT).update(password).digest('hex');
  }

  // 注册
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

  // 登录
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

  // 绑定会话
  setSession(socketId, username) {
    this.sessions.set(socketId, username);
  }

  // 获取当前用户
  getUserBySocket(socketId) {
    const name = this.sessions.get(socketId);
    if (!name) return null;
    return this.users.get(name) || null;
  }

  // 清除会话
  clearSession(socketId) {
    this.sessions.delete(socketId);
  }

  // 更新统计
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

  // 获取用户信息
  getProfile(username) {
    const user = this.users.get(username);
    if (!user) return null;
    return {
      username: user.username,
      stats: { ...user.stats },
      createdAt: user.createdAt,
    };
  }
}
