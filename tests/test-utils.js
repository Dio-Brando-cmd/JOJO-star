// ============================================================
// 狼人杀 性能测试工具库
// 提供模拟玩家连接、游戏操作、性能测量等基础设施
// ============================================================

import { io } from 'socket.io-client';
import { createServer } from '../server/src/app.js';

// ===== 配置 =====
const DEFAULT_SERVER_URL = 'http://localhost:4000';
const DEFAULT_TIMEOUT = 15000;

// ===== 性能计时器 =====
export class PerfTimer {
  constructor(label) {
    this.label = label;
    this.startTime = Date.now();
    this.marks = [];
  }

  mark(name) {
    this.marks.push({ name, time: Date.now() - this.startTime });
    return this;
  }

  end() {
    const total = Date.now() - this.startTime;
    return { label: this.label, total, marks: this.marks };
  }

  static format(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

// ===== 测试报告 =====
export class TestReport {
  constructor(name) {
    this.name = name;
    this.results = [];
    this.startTime = Date.now();
  }

  addResult(test, passed, detail = '') {
    this.results.push({ test, passed, detail, time: Date.now() - this.startTime });
  }

  summary() {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = Date.now() - this.startTime;
    return {
      name: this.name,
      total: this.results.length,
      passed,
      failed,
      duration: total,
      results: this.results,
    };
  }

  print() {
    const s = this.summary();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${s.name}`);
    console.log(`${'='.repeat(60)}`);
    for (const r of s.results) {
      const icon = r.passed ? '✅' : '❌';
      console.log(`  ${icon} ${r.test}${r.detail ? ` — ${r.detail}` : ''}`);
    }
    console.log(`${'='.repeat(60)}`);
    console.log(`  通过: ${s.passed}/${s.total} | 失败: ${s.failed} | 耗时: ${PerfTimer.format(s.duration)}`);
    console.log(`${'='.repeat(60)}\n`);
    return s;
  }
}

// ===== 模拟玩家 =====
export class SimPlayer {
  constructor(name, serverUrl = DEFAULT_SERVER_URL) {
    this.name = name;
    this.serverUrl = serverUrl;
    this.socket = null;
    this.connected = false;
    this.playerId = null;
    this.gameState = null;
    this.privateState = null;
    this.chatMessages = [];
    this.events = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket'],
        reconnection: false,
        timeout: DEFAULT_TIMEOUT,
      });

      const timeout = setTimeout(() => {
        reject(new Error(`[${this.name}] 连接超时`));
      }, DEFAULT_TIMEOUT);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.connected = true;
        this.playerId = this.socket.id;
        this._setupListeners();
        resolve(this);
      });

      this.socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  _setupListeners() {
    this.socket.on('game:state', (state) => { this.gameState = state; });
    this.socket.on('game:privateState', (state) => { this.privateState = state; });
    this.socket.on('game:started', (data) => { this.events.push({ type: 'game:started', data }); });
    this.socket.on('game:phaseChange', (data) => { this.events.push({ type: 'game:phaseChange', data }); });
    this.socket.on('game:nightStep', (data) => { this.events.push({ type: 'game:nightStep', data }); });
    this.socket.on('game:voteResults', (data) => { this.events.push({ type: 'game:voteResults', data }); });
    this.socket.on('game:over', (data) => { this.events.push({ type: 'game:over', data }); });
    this.socket.on('chat:message', (msg) => { this.chatMessages.push(msg); });
    this.socket.on('disconnect', () => { this.connected = false; });
  }

  // 认证
  async register(username, password) {
    return this._emit('auth:register', { username, password });
  }

  async login(username, password) {
    return this._emit('auth:login', { username, password });
  }

  // 房间操作
  async createRoom(options = {}) {
    return this._emit('room:create', {
      playerName: this.name,
      isPrivate: options.isPrivate || false,
      password: options.password || null,
      maxPlayers: options.maxPlayers || 12,
      roleConfig: options.roleConfig || null,
    });
  }

  async joinRoom(roomCode, password = null) {
    return this._emit('room:join', { roomCode, playerName: this.name, password });
  }

  async leaveRoom() {
    this.socket.emit('room:leave');
  }

  async backToLobby() {
    this.socket.emit('room:backToLobby');
  }

  // 游戏操作
  async startGame(roleConfig = null) {
    return this._emit('game:start', { roleConfig });
  }

  async submitNightAction(action, target, ability = null) {
    return this._emit('night:action', { action, target, ability });
  }

  async skipNightStep() {
    this.socket.emit('night:skip');
  }

  async startVote() {
    this.socket.emit('day:startVote');
  }

  async submitVote(targetId) {
    this.socket.emit('vote:submit', { targetId });
  }

  async hunterDayShoot(targetId) {
    this.socket.emit('hunter:dayShoot', { targetId });
  }

  // 聊天
  async sendChat(message) {
    this.socket.emit('chat:message', { message });
  }

  // 大厅
  async getLobbyList() {
    return this._emit('lobby:list', {});
  }

  // 通用 emit（带回调等待）
  _emit(event, data, timeoutMs = DEFAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error(`[${this.name}] 未连接`));
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error(`[${this.name}] ${event} 超时`));
      }, timeoutMs);

      this.socket.emit(event, data, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
    });
  }

  // 等待特定事件
  waitForEvent(eventType, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[${this.name}] 等待事件 ${eventType} 超时`));
      }, timeoutMs);

      const check = () => {
        const idx = this.events.findIndex(e => e.type === eventType);
        if (idx >= 0) {
          clearTimeout(timer);
          resolve(this.events[idx]);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  async disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }

  async waitForDisconnect(timeoutMs = 10000) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      this.socket.on('disconnect', () => {
        clearTimeout(timer);
        this.connected = false;
        resolve(true);
      });
    });
  }
}

// ===== 批量创建玩家 =====
export async function createPlayers(count, serverUrl, namePrefix = 'TestPlayer') {
  const players = [];
  for (let i = 0; i < count; i++) {
    const name = `${namePrefix}${i + 1}`;
    const player = new SimPlayer(name, serverUrl);
    await player.connect();
    players.push(player);
    console.log(`  玩家 ${name} 已连接 (${i + 1}/${count})`);
  }
  return players;
}

// ===== 断开所有玩家 =====
export async function disconnectAll(players) {
  for (const p of players) {
    await p.disconnect();
  }
}

// ===== 等待指定毫秒 =====
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== 启动本地测试服务器 =====
export async function startTestServer(port = 4001) {
  return new Promise((resolve, reject) => {
    const { server } = createServer();
    server.listen(port, () => {
      console.log(`🧪 测试服务器运行在端口 ${port}`);
      resolve({ server, port, url: `http://localhost:${port}` });
    });
    server.on('error', reject);
  });
}

// ===== 统计收集 =====
export class StatsCollector {
  constructor() {
    this.latencies = [];
    this.errors = [];
    this.phaseTransitions = [];
    this.startTime = Date.now();
  }

  recordLatency(operation, ms) {
    this.latencies.push({ operation, ms, time: Date.now() });
  }

  recordError(operation, error) {
    this.errors.push({ operation, error, time: Date.now() });
  }

  recordPhaseTransition(from, to, ms) {
    this.phaseTransitions.push({ from, to, ms, time: Date.now() });
  }

  summary() {
    const latencies = this.latencies.map(l => l.ms);
    latencies.sort((a, b) => a - b);
    return {
      totalOperations: this.latencies.length,
      totalErrors: this.errors.length,
      avgLatency: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
      p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
      p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
      min: latencies[0] || 0,
      max: latencies[latencies.length - 1] || 0,
      phaseTransitions: this.phaseTransitions.length,
      duration: Date.now() - this.startTime,
    };
  }

  print() {
    const s = this.summary();
    console.log(`\n  📊 性能统计:`);
    console.log(`     操作总数: ${s.totalOperations}`);
    console.log(`     错误数:   ${s.totalErrors}`);
    console.log(`     平均延迟: ${PerfTimer.format(s.avgLatency)}`);
    console.log(`     P50延迟:  ${PerfTimer.format(s.p50)}`);
    console.log(`     P95延迟:  ${PerfTimer.format(s.p95)}`);
    console.log(`     P99延迟:  ${PerfTimer.format(s.p99)}`);
    console.log(`     最小延迟: ${PerfTimer.format(s.min)}`);
    console.log(`     最大延迟: ${PerfTimer.format(s.max)}`);
    console.log(`     阶段转换: ${s.phaseTransitions}`);
    console.log(`     总耗时:   ${PerfTimer.format(s.duration)}`);
  }
}

// ===== 游戏协议常量（与服务器保持一致） =====
export const ROLES = {
  CORRUPTED: 'WEREWOLF',
  NETHER_MONK: 'ALPHA_WOLF',
  VEIL_SCHOLAR: 'SEER',
  HERBAL_SAGE: 'POISON_WITCH',
  SPIRIT_MENDER: 'HEAL_WITCH',
  VILLAGER: 'VILLAGER',
  VEIL_GUARDIAN: 'GUARD',
  FLAME_TRACKER: 'HUNTER',
};

export const PHASES = {
  LOBBY: 'LOBBY',
  NIGHT: 'NIGHT',
  DAY: 'DAY',
  VOTE: 'VOTE',
  GAME_OVER: 'GAME_OVER',
};

export const NIGHT_ACTIONS = {
  GO_OUT: 'GO_OUT',
  USE_ABILITY: 'USE_ABILITY',
  SLEEP: 'SLEEP',
};

// ===== 辅助：自动玩完一局完整游戏 =====
export async function autoPlayGame(players, room, stats = null) {
  const report = new TestReport(`自动游戏 - ${room}`);
  const timer = new PerfTimer('auto_game');

  // 找到房主（第一个玩家）和其他玩家
  const host = players[0];

  try {
    // 创建房间
    timer.mark('create_room_start');
    const createResult = await host.createRoom();
    if (stats) stats.recordLatency('create_room', Date.now() - timer.startTime);
    report.addResult('房间创建', createResult.success, createResult.roomCode);
    if (!createResult.success) return report;

    const roomCode = createResult.roomCode;
    timer.mark('create_room_done');

    // 其他玩家加入
    for (let i = 1; i < players.length; i++) {
      const joinResult = await players[i].joinRoom(roomCode);
      report.addResult(`玩家${i + 1}加入`, joinResult.success);
    }
    timer.mark('all_joined');

    // 开始游戏
    const startResult = await host.startGame();
    report.addResult('游戏开始', startResult.success);
    if (!startResult.success) return report;
    timer.mark('game_started');

    // 等待游戏进行…自动监听阶段变化
    const gameOver = await Promise.race([
      host.waitForEvent('game:over', 120000),
      sleep(120000).then(() => null),
    ]);

    if (gameOver) {
      timer.mark('game_over');
      report.addResult('游戏完成', true, `${players.length}名玩家`);
    } else {
      report.addResult('游戏完成', false, '超时（2分钟）');
    }

  } catch (e) {
    report.addResult('游戏异常', false, e.message);
    if (stats) stats.recordError('game', e.message);
  }

  timer.end();
  return report;
}

// ===== 日志工具 =====
export function logSection(title) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(50)}`);
}

export function logInfo(msg) {
  console.log(`  ℹ️  ${msg}`);
}

export function logSuccess(msg) {
  console.log(`  ✅ ${msg}`);
}

export function logError(msg) {
  console.log(`  ❌ ${msg}`);
}

export function logWarn(msg) {
  console.log(`  ⚠️  ${msg}`);
}
